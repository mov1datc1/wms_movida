import { Controller, Get, Post, Put, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';

@ApiTags('Operations')
@Controller('api')
export class OperationsController {
  constructor(private prisma: PrismaService) {}

  // Helper: Create audit log entry
  private async audit(usuario: string, accion: string, entidad: string, entidadId?: string, detalle?: string) {
    await this.prisma.auditLog.create({
      data: { usuario, accion, entidad, entidadId, detalle },
    });
  }

  // ============ RECEPCIÓN ============
  @Post('reception')
  @ApiOperation({ summary: 'Registrar recepción de materia prima' })
  async registerReception(@Body() data: {
    skuId: string;
    lote: string;
    fechaVencimiento?: string;
    cantidad: number;
    proveedor: string;
    tipoHu: string;
    ubicacionId: string;
    almacenId: string;
    usuario: string;
    notas?: string;
  }) {
    const lot = await this.prisma.lotInventory.create({
      data: {
        skuId: data.skuId,
        lote: data.lote,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        proveedorNombre: data.proveedor,
        estadoCalidad: 'LIBERADO',
        cantidadDisponible: data.cantidad,
        ubicacionId: data.ubicacionId,
      },
    });

    const hu = await this.prisma.handlingUnit.create({
      data: {
        tipoHu: data.tipoHu,
        lotId: lot.id,
        cantidad: data.cantidad,
        uom: 'UN',
        ubicacionActual: data.ubicacionId,
      },
    });

    const movement = await this.prisma.inventoryMovement.create({
      data: {
        tipoMovimiento: 'ENTRADA',
        almacenId: data.almacenId,
        skuId: data.skuId,
        lotId: lot.id,
        huId: hu.id,
        toLocationId: data.ubicacionId,
        cantidad: data.cantidad,
        usuario: data.usuario,
        motivo: data.notas || `Recepción OC — ${data.proveedor}`,
      },
    });

    await this.prisma.location.update({
      where: { id: data.ubicacionId },
      data: { ocupacion: { increment: Math.min(data.cantidad, 10) }, estado: 'OCUPADO' },
    });

    await this.audit(data.usuario, 'RECEPCION', 'LotInventory', lot.id,
      `Lote: ${data.lote}, Cant: ${data.cantidad}, SKU: ${data.skuId}, Proveedor: ${data.proveedor}`);

    return { success: true, lot, handlingUnit: hu, movement,
      message: `Recepción registrada: Lote ${data.lote}, HU ${hu.codigo}` };
  }

  // ============ MOVEMENTS ============
  @Get('movements')
  @ApiOperation({ summary: 'Listar movimientos de inventario (historial auditable)' })
  async getMovements(
    @Query('tipo') tipo?: string,
    @Query('almacenId') almacenId?: string,
    @Query('skuId') skuId?: string,
    @Query('usuario') usuario?: string,
    @Query('limit') limit?: string,
  ) {
    const where: any = {};
    if (tipo) where.tipoMovimiento = tipo;
    if (almacenId) where.almacenId = almacenId;
    if (skuId) where.skuId = skuId;
    if (usuario) where.usuario = { contains: usuario, mode: 'insensitive' };

    return this.prisma.inventoryMovement.findMany({
      where,
      include: {
        sku: { select: { codigoDynamics: true, descripcion: true } },
        fromLocation: { select: { codigo: true, zona: true } },
        toLocation: { select: { codigo: true, zona: true } },
        almacen: { select: { codigo: true, nombre: true } },
        lote: { select: { lote: true } },
      },
      orderBy: { fechaHora: 'desc' },
      take: parseInt(limit || '100'),
    });
  }

  @Post('movements')
  @ApiOperation({ summary: 'Registrar movimiento manual (trasiego, ajuste, transferencia entre almacenes)' })
  async createMovement(@Body() data: {
    tipoMovimiento: string;
    almacenId?: string;
    skuId: string;
    lotId?: string;
    huId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    cantidad: number;
    usuario: string;
    motivo?: string;
    documentoOrigen?: string;
  }) {
    const movement = await this.prisma.inventoryMovement.create({
      data,
      include: { sku: true, fromLocation: true, toLocation: true },
    });

    // If it's a trasiego (internal move), update lot location
    if (data.tipoMovimiento === 'TRASIEGO' && data.lotId && data.toLocationId) {
      await this.prisma.lotInventory.update({
        where: { id: data.lotId },
        data: { ubicacionId: data.toLocationId },
      });
    }

    // If it's a transfer between warehouses
    if (data.tipoMovimiento === 'TRANSFERENCIA' && data.lotId && data.toLocationId) {
      await this.prisma.lotInventory.update({
        where: { id: data.lotId },
        data: { ubicacionId: data.toLocationId },
      });
    }

    await this.audit(data.usuario, data.tipoMovimiento, 'InventoryMovement', movement.id,
      `Tipo: ${data.tipoMovimiento}, Cant: ${data.cantidad}, SKU: ${data.skuId}`);

    return movement;
  }

  // ============ ORDERS ============
  @Get('orders')
  @ApiOperation({ summary: 'Listar órdenes de salida' })
  async getOrders(
    @Query('estado') estado?: string,
    @Query('restauranteId') restauranteId?: string,
  ) {
    const where: any = {};
    if (estado) where.estado = estado;
    if (restauranteId) where.restauranteId = restauranteId;

    return this.prisma.outboundOrder.findMany({
      where,
      include: {
        restaurante: { select: { nombre: true, zona: true } },
        lineas: { include: { sku: { select: { codigoDynamics: true, descripcion: true } } } },
        trackingEvents: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ prioridad: 'asc' }, { fechaCompromiso: 'asc' }],
    });
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crear orden de salida' })
  async createOrder(@Body() data: any) {
    const { lineas, ...orderData } = data;
    const order = await this.prisma.outboundOrder.create({
      data: { ...orderData, lineas: { create: lineas } },
      include: { restaurante: true, lineas: { include: { sku: true } } },
    });

    await this.audit(data.usuario || 'Sistema', 'CREAR_ORDEN', 'OutboundOrder', order.id,
      `Restaurante: ${order.restauranteId}, Líneas: ${lineas?.length || 0}`);

    return order;
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Actualizar estado de orden' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { estado: string; usuario?: string },
  ) {
    const updateData: any = { estado: body.estado };
    if (body.estado === 'DESPACHADO') updateData.fechaDespacho = new Date();

    const order = await this.prisma.outboundOrder.update({
      where: { id },
      data: updateData,
      include: { restaurante: true },
    });

    await this.audit(body.usuario || 'Sistema', `ORDEN_${body.estado}`, 'OutboundOrder', id,
      `Estado: ${body.estado}`);

    return order;
  }

  // ============ DISPATCH TRACKING (despachador updates) ============
  @Post('orders/:id/dispatch')
  @ApiOperation({ summary: 'Confirmar despacho de orden (despachador)' })
  async dispatchOrder(
    @Param('id') id: string,
    @Body() data: { despachador: string; vehiculoPlaca?: string; notas?: string },
  ) {
    const order = await this.prisma.outboundOrder.update({
      where: { id },
      data: {
        estado: 'DESPACHADO',
        despachador: data.despachador,
        fechaDespacho: new Date(),
        vehiculoPlaca: data.vehiculoPlaca,
        estadoEntrega: 'EN_RUTA',
      },
      include: { restaurante: true },
    });

    await this.prisma.dispatchTracking.create({
      data: { orderId: id, estado: 'SALIDA_CEDIS', usuario: data.despachador, notas: data.notas },
    });

    await this.audit(data.despachador, 'DESPACHO', 'OutboundOrder', id,
      `Vehículo: ${data.vehiculoPlaca || 'N/A'}`);

    return { success: true, order };
  }

  @Post('orders/:id/tracking')
  @ApiOperation({ summary: 'Actualizar estado de entrega (despachador en ruta)' })
  async updateDeliveryTracking(
    @Param('id') id: string,
    @Body() data: {
      estado: string;
      usuario: string;
      notas?: string;
      latitud?: number;
      longitud?: number;
      firmaBase64?: string;
      nombreFirmante?: string;
    },
  ) {
    const tracking = await this.prisma.dispatchTracking.create({
      data: {
        orderId: id,
        estado: data.estado,
        usuario: data.usuario,
        notas: data.notas,
        latitud: data.latitud,
        longitud: data.longitud,
        firmaBase64: data.firmaBase64,
        nombreFirmante: data.nombreFirmante,
      },
    });

    const orderUpdate: any = { estadoEntrega: data.estado };
    if (data.estado === 'ENTREGADO') {
      orderUpdate.estado = 'ENTREGADO';
      orderUpdate.fechaEntrega = new Date();
      orderUpdate.firmaReceptor = data.firmaBase64;
      orderUpdate.nombreReceptor = data.nombreFirmante;
      orderUpdate.notasEntrega = data.notas;
    }

    await this.prisma.outboundOrder.update({
      where: { id },
      data: orderUpdate,
    });

    await this.audit(data.usuario, `ENTREGA_${data.estado}`, 'OutboundOrder', id,
      `Estado: ${data.estado}${data.nombreFirmante ? `, Firmó: ${data.nombreFirmante}` : ''}`);

    return { success: true, tracking };
  }

  @Get('orders/:id/tracking')
  @ApiOperation({ summary: 'Ver historial de tracking de entrega' })
  async getOrderTracking(@Param('id') id: string) {
    return this.prisma.dispatchTracking.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============ PUTAWAY / REASSIGN ============
  @Put('lots/:id/reassign')
  @ApiOperation({ summary: 'Reasignar ubicación de un lote' })
  async reassignLocation(
    @Param('id') id: string,
    @Body() { ubicacionId, usuario }: { ubicacionId: string; usuario: string },
  ) {
    const lot = await this.prisma.lotInventory.findUnique({
      where: { id },
      include: { ubicacion: true },
    });
    if (!lot) throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);

    const updated = await this.prisma.lotInventory.update({
      where: { id },
      data: { ubicacionId },
      include: { ubicacion: true, sku: true },
    });

    await this.prisma.inventoryMovement.create({
      data: {
        tipoMovimiento: 'TRASIEGO',
        skuId: lot.skuId,
        lotId: id,
        fromLocationId: lot.ubicacionId,
        toLocationId: ubicacionId,
        cantidad: lot.cantidadDisponible,
        usuario,
        motivo: 'Reasignación de ubicación',
      },
    });

    await this.audit(usuario, 'TRASIEGO', 'LotInventory', id,
      `De: ${lot.ubicacion?.codigo || 'N/A'} → Nueva ubicación`);

    return { success: true, lot: updated };
  }

  // ============ INTER-WAREHOUSE TRANSFER ============
  @Post('transfers')
  @ApiOperation({ summary: 'Transferir lote entre almacenes' })
  async interWarehouseTransfer(@Body() data: {
    lotId: string;
    fromLocationId: string;
    toLocationId: string;
    cantidad: number;
    usuario: string;
    motivo?: string;
  }) {
    try {
      const lot = await this.prisma.lotInventory.findUnique({
        where: { id: data.lotId },
        include: { sku: true, ubicacion: true },
      });
      if (!lot) throw new HttpException('Lote no encontrado', HttpStatus.NOT_FOUND);
      if (lot.cantidadDisponible < data.cantidad) {
        throw new HttpException('Cantidad insuficiente en lote', HttpStatus.BAD_REQUEST);
      }

      const toLocation = await this.prisma.location.findUnique({ where: { id: data.toLocationId } });
      if (!toLocation) throw new HttpException('Ubicación destino no encontrada', HttpStatus.NOT_FOUND);

      // If transferring full quantity, move the lot
      if (data.cantidad >= lot.cantidadDisponible) {
        await this.prisma.lotInventory.update({
          where: { id: data.lotId },
          data: { ubicacionId: data.toLocationId },
        });
      } else {
        // Partial: reduce source, create new lot at destination
        await this.prisma.lotInventory.update({
          where: { id: data.lotId },
          data: { cantidadDisponible: { decrement: data.cantidad } },
        });
        await this.prisma.lotInventory.create({
          data: {
            skuId: lot.skuId,
            lote: lot.lote,
            fechaVencimiento: lot.fechaVencimiento,
            proveedorNombre: lot.proveedorNombre,
            estadoCalidad: lot.estadoCalidad,
            cantidadDisponible: data.cantidad,
            ubicacionId: data.toLocationId,
          },
        });
      }

      const movement = await this.prisma.inventoryMovement.create({
        data: {
          tipoMovimiento: 'TRANSFERENCIA',
          skuId: lot.skuId,
          lotId: data.lotId,
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          cantidad: data.cantidad,
          usuario: data.usuario,
          motivo: data.motivo || 'Transferencia entre almacenes',
        },
        include: { sku: true, fromLocation: true, toLocation: true },
      });

      await this.audit(data.usuario, 'TRANSFERENCIA', 'LotInventory', data.lotId,
        `Cant: ${data.cantidad}, De: ${lot.ubicacion?.codigo || 'N/A'} → ${toLocation.codigo}`);

      return { success: true, movement };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Error en transferencia: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ============ TRACEABILITY ============
  @Get('traceability')
  @ApiOperation({ summary: 'Consultar trazabilidad de lotes' })
  async getTraceability(@Query('lote') lote?: string, @Query('skuId') skuId?: string) {
    const where: any = {};
    if (skuId) where.skuId = skuId;

    return this.prisma.traceabilityLink.findMany({
      where,
      include: {
        sku: { select: { codigoDynamics: true, descripcion: true } },
        lote: { select: { lote: true, fechaVencimiento: true, proveedorNombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('traceability')
  @ApiOperation({ summary: 'Registrar enlace de trazabilidad' })
  async createTraceability(@Body() data: any) {
    return this.prisma.traceabilityLink.create({ data });
  }

  // ============ AUDIT LOG ============
  @Get('audit-log')
  @ApiOperation({ summary: 'Consultar historial de auditoría' })
  async getAuditLog(
    @Query('usuario') usuario?: string,
    @Query('accion') accion?: string,
    @Query('limit') limit?: string,
  ) {
    const where: any = {};
    if (usuario) where.usuario = { contains: usuario, mode: 'insensitive' };
    if (accion) where.accion = accion;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '100'),
    });
  }
}
