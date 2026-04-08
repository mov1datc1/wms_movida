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

  // ============ INBOUND ORDERS (from BC Purchase Orders) ============
  @Get('inbound-orders')
  @ApiOperation({ summary: 'Listar órdenes de compra sincronizadas de BC' })
  async getInboundOrders(
    @Query('estado') estado?: string,
    @Query('numero') numero?: string,
  ) {
    const where: any = {};
    if (estado) where.estado = estado;
    if (numero) where.numeroDynamics = { contains: numero, mode: 'insensitive' };

    return this.prisma.inboundOrder.findMany({
      where,
      include: {
        lineas: {
          include: { sku: { select: { codigoDynamics: true, descripcion: true, categoria: true, temperaturaRequerida: true, uomBase: true } } },
        },
      },
      orderBy: [{ estado: 'asc' }, { fechaOrden: 'desc' }],
    });
  }

  @Get('inbound-orders/:id')
  @ApiOperation({ summary: 'Detalle de orden de compra' })
  async getInboundOrder(@Param('id') id: string) {
    return this.prisma.inboundOrder.findUnique({
      where: { id },
      include: {
        lineas: {
          include: { sku: { select: { codigoDynamics: true, descripcion: true, categoria: true, temperaturaRequerida: true, uomBase: true } } },
        },
      },
    });
  }

  // ============ RECEPCIÓN (with InboundOrder support) ============
  @Post('reception')
  @ApiOperation({ summary: 'Registrar recepción de materia prima (puede ser contra una OC de BC)' })
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
    inboundOrderLineId?: string;  // Link to BC PO line (optional)
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

    // ── Update InboundOrderLine if receiving against a PO ──
    if (data.inboundOrderLineId) {
      const line = await this.prisma.inboundOrderLine.findUnique({
        where: { id: data.inboundOrderLineId },
        include: { inboundOrder: true },
      });

      if (line) {
        const newRecibida = line.cantidadRecibida + data.cantidad;
        const lineEstado = newRecibida >= line.cantidadEsperada ? 'COMPLETO' : 'PARCIAL';

        await this.prisma.inboundOrderLine.update({
          where: { id: data.inboundOrderLineId },
          data: {
            cantidadRecibida: newRecibida,
            estado: lineEstado,
            loteAsignado: data.lote,
            ubicacionId: data.ubicacionId,
          },
        });

        // Check if ALL lines of the InboundOrder are complete
        const allLines = await this.prisma.inboundOrderLine.findMany({
          where: { inboundOrderId: line.inboundOrderId },
        });
        const allComplete = allLines.every(l =>
          l.id === data.inboundOrderLineId
            ? newRecibida >= l.cantidadEsperada
            : l.cantidadRecibida >= l.cantidadEsperada
        );
        const anyReceived = allLines.some(l =>
          l.id === data.inboundOrderLineId
            ? newRecibida > 0
            : l.cantidadRecibida > 0
        );

        await this.prisma.inboundOrder.update({
          where: { id: line.inboundOrderId },
          data: { estado: allComplete ? 'RECIBIDO' : anyReceived ? 'PARCIAL' : 'PENDIENTE' },
        });
      }
    }

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
  @ApiOperation({ summary: 'Confirmar despacho de orden (despachador) — descuenta inventario y libera ubicaciones' })
  async dispatchOrder(
    @Param('id') id: string,
    @Body() data: { despachador: string; vehiculoPlaca?: string; notas?: string },
  ) {
    // Get order with lines
    const fullOrder = await this.prisma.outboundOrder.findUnique({
      where: { id },
      include: { lineas: { include: { sku: true } }, restaurante: true },
    });
    if (!fullOrder) throw new HttpException('Orden no encontrada', HttpStatus.NOT_FOUND);

    // ── Decrement inventory per line using FEFO ──
    for (const line of fullOrder.lineas) {
      let remaining = line.cantidadSolicitada;

      // Get available lots for this SKU, ordered by expiration (FEFO)
      const lots = await this.prisma.lotInventory.findMany({
        where: { skuId: line.skuId, cantidadDisponible: { gt: 0 }, estadoCalidad: 'LIBERADO' },
        orderBy: { fechaVencimiento: 'asc' },
        include: { ubicacion: true },
      });

      for (const lot of lots) {
        if (remaining <= 0) break;

        const toTake = Math.min(remaining, lot.cantidadDisponible);
        remaining -= toTake;

        // Decrement lot inventory
        await this.prisma.lotInventory.update({
          where: { id: lot.id },
          data: { cantidadDisponible: { decrement: toTake } },
        });

        // If lot is now empty, free the location
        if (toTake >= lot.cantidadDisponible && lot.ubicacionId) {
          // Check if location has other lots with stock
          const otherLots = await this.prisma.lotInventory.count({
            where: { ubicacionId: lot.ubicacionId, cantidadDisponible: { gt: 0 }, id: { not: lot.id } },
          });

          if (otherLots === 0) {
            await this.prisma.location.update({
              where: { id: lot.ubicacionId },
              data: { ocupacion: 0, estado: 'DISPONIBLE' },
            });
          } else {
            // Decrement occupancy
            await this.prisma.location.update({
              where: { id: lot.ubicacionId },
              data: { ocupacion: { decrement: 1 } },
            });
          }
        }

        // Create SALIDA movement for traceability
        await this.prisma.inventoryMovement.create({
          data: {
            tipoMovimiento: 'SALIDA',
            skuId: line.skuId,
            lotId: lot.id,
            fromLocationId: lot.ubicacionId || undefined,
            cantidad: toTake,
            usuario: data.despachador,
            motivo: `Despacho orden #${fullOrder.origenDynamics || id} → ${fullOrder.restaurante.nombre}`,
          },
        });

        this.audit(data.despachador, 'SALIDA_INVENTARIO', 'LotInventory', lot.id,
          `SKU: ${line.sku.descripcion}, Qty: -${toTake}, Lote: ${lot.lote}`);
      }

      // Update the line's assigned quantity
      await this.prisma.outboundOrderLine.update({
        where: { id: line.id },
        data: { cantidadAsignada: line.cantidadSolicitada - remaining },
      });
    }

    // ── Update order status ──
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

      // ── Update location occupancy ──
      // Decrement origin location
      if (data.fromLocationId) {
        const remainingLotsAtOrigin = await this.prisma.lotInventory.count({
          where: { ubicacionId: data.fromLocationId, cantidadDisponible: { gt: 0 } },
        });
        if (remainingLotsAtOrigin === 0) {
          await this.prisma.location.update({
            where: { id: data.fromLocationId },
            data: { ocupacion: 0, estado: 'DISPONIBLE' },
          });
        }
      }
      // Increment destination location
      await this.prisma.location.update({
        where: { id: data.toLocationId },
        data: { ocupacion: { increment: 1 }, estado: 'OCUPADO' },
      });

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

  // ============ CYCLE COUNT ============
  @Get('cycle-counts')
  @ApiOperation({ summary: 'Listar conteos cíclicos' })
  async getCycleCounts(@Query('estado') estado?: string) {
    const where: any = {};
    if (estado) where.estado = estado;

    return this.prisma.cycleCount.findMany({
      where,
      include: {
        lineas: {
          include: { sku: { select: { codigoDynamics: true, descripcion: true, categoria: true } } },
        },
      },
      orderBy: { fechaProgramada: 'desc' },
    });
  }

  @Get('cycle-counts/:id')
  @ApiOperation({ summary: 'Detalle de conteo cíclico' })
  async getCycleCount(@Param('id') id: string) {
    return this.prisma.cycleCount.findUnique({
      where: { id },
      include: {
        lineas: {
          include: { sku: { select: { codigoDynamics: true, descripcion: true, categoria: true, uomBase: true } } },
          orderBy: { estado: 'asc' },
        },
      },
    });
  }

  @Post('cycle-counts')
  @ApiOperation({ summary: 'Crear conteo cíclico (genera líneas desde inventario actual)' })
  async createCycleCount(@Body() data: {
    nombre: string;
    tipo: string;
    clasificacion?: string;
    fechaProgramada: string;
    almacenId?: string;
    asignadoA?: string;
    notas?: string;
    usuario?: string;
  }) {
    // Generate code
    const count = await this.prisma.cycleCount.count();
    const codigo = `CC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Get current inventory by SKU (grouped)
    const lots = await this.prisma.lotInventory.findMany({
      where: { cantidadDisponible: { gt: 0 }, estadoCalidad: 'LIBERADO' },
      include: { sku: true, ubicacion: true },
    });

    // Group by SKU+location for counting
    const lineMap = new Map<string, { skuId: string; ubicacionId: string | null; lote: string; total: number }>();
    for (const lot of lots) {
      const key = data.tipo === 'LOTE'
        ? `${lot.skuId}-${lot.lote}`
        : data.tipo === 'UBICACION'
          ? `${lot.skuId}-${lot.ubicacionId}`
          : lot.skuId;

      if (lineMap.has(key)) {
        lineMap.get(key)!.total += lot.cantidadDisponible;
      } else {
        lineMap.set(key, {
          skuId: lot.skuId,
          ubicacionId: lot.ubicacionId,
          lote: data.tipo === 'LOTE' ? lot.lote : '',
          total: lot.cantidadDisponible,
        });
      }
    }

    const cc = await this.prisma.cycleCount.create({
      data: {
        codigo,
        nombre: data.nombre,
        tipo: data.tipo || 'SKU',
        clasificacion: data.clasificacion || 'A',
        fechaProgramada: new Date(data.fechaProgramada),
        almacenId: data.almacenId,
        asignadoA: data.asignadoA,
        notas: data.notas,
        lineas: {
          create: Array.from(lineMap.values()).map(item => ({
            skuId: item.skuId,
            ubicacionId: item.ubicacionId,
            lote: item.lote || null,
            cantidadSistema: item.total,
          })),
        },
      },
      include: {
        lineas: { include: { sku: { select: { codigoDynamics: true, descripcion: true } } } },
      },
    });

    await this.audit(data.usuario || 'Sistema', 'CREAR_CONTEO', 'CycleCount', cc.id,
      `${codigo}: ${cc.lineas.length} líneas, tipo: ${data.tipo}`);

    return cc;
  }

  @Put('cycle-counts/:id/start')
  @ApiOperation({ summary: 'Iniciar conteo cíclico' })
  async startCycleCount(@Param('id') id: string) {
    return this.prisma.cycleCount.update({
      where: { id },
      data: { estado: 'EN_PROGRESO', fechaInicio: new Date() },
    });
  }

  @Put('cycle-counts/:countId/lines/:lineId/count')
  @ApiOperation({ summary: 'Registrar conteo físico de una línea' })
  async recordCount(
    @Param('countId') countId: string,
    @Param('lineId') lineId: string,
    @Body() data: { cantidadFisica: number; contadoPor: string; notas?: string },
  ) {
    const line = await this.prisma.cycleCountLine.findUnique({ where: { id: lineId } });
    if (!line) throw new HttpException('Línea no encontrada', HttpStatus.NOT_FOUND);

    const discrepancia = data.cantidadFisica - line.cantidadSistema;
    const porcentajeDisc = line.cantidadSistema > 0
      ? (discrepancia / line.cantidadSistema) * 100
      : data.cantidadFisica > 0 ? 100 : 0;

    const updated = await this.prisma.cycleCountLine.update({
      where: { id: lineId },
      data: {
        cantidadFisica: data.cantidadFisica,
        discrepancia,
        porcentajeDisc: Math.round(porcentajeDisc * 100) / 100,
        estado: 'CONTADO',
        contadoPor: data.contadoPor,
        contadoEn: new Date(),
        notas: data.notas,
      },
      include: { sku: { select: { codigoDynamics: true, descripcion: true } } },
    });

    // Check if all lines are counted
    const allLines = await this.prisma.cycleCountLine.findMany({ where: { cycleCountId: countId } });
    const allCounted = allLines.every(l => l.id === lineId ? true : l.estado !== 'PENDIENTE');
    if (allCounted) {
      await this.prisma.cycleCount.update({
        where: { id: countId },
        data: { estado: 'COMPLETADO' },
      });
    }

    return updated;
  }

  @Put('cycle-counts/:id/close')
  @ApiOperation({ summary: 'Cerrar conteo y generar ajustes de inventario' })
  async closeCycleCount(
    @Param('id') id: string,
    @Body() body: { usuario: string; aplicarAjustes?: boolean },
  ) {
    const cc = await this.prisma.cycleCount.findUnique({
      where: { id },
      include: { lineas: { include: { sku: true } } },
    });
    if (!cc) throw new HttpException('Conteo no encontrado', HttpStatus.NOT_FOUND);

    // Optionally apply adjustments to inventory
    if (body.aplicarAjustes) {
      for (const line of cc.lineas) {
        if (line.discrepancia && line.discrepancia !== 0 && line.cantidadFisica != null) {
          // Find lots for this SKU and adjust quantity
          const lots = await this.prisma.lotInventory.findMany({
            where: { skuId: line.skuId, cantidadDisponible: { gt: 0 } },
            orderBy: { fechaVencimiento: 'asc' }, // FEFO order
          });

          if (lots.length > 0) {
            // Simple strategy: adjust the first lot's available qty
            const firstLot = lots[0];
            const newQty = Math.max(0, firstLot.cantidadDisponible + line.discrepancia);
            await this.prisma.lotInventory.update({
              where: { id: firstLot.id },
              data: { cantidadDisponible: newQty },
            });
          }

          // Create adjustment movement for traceability
          await this.prisma.inventoryMovement.create({
            data: {
              tipoMovimiento: 'AJUSTE',
              skuId: line.skuId,
              cantidad: Math.abs(line.discrepancia),
              usuario: body.usuario,
              motivo: `Ajuste conteo cíclico ${cc.codigo}: ${line.discrepancia > 0 ? 'Sobrante +' : 'Faltante -'}${Math.abs(line.discrepancia)} UN (Sistema: ${line.cantidadSistema}, Físico: ${line.cantidadFisica})`,
              almacenId: cc.almacenId,
            },
          });

          await this.prisma.cycleCountLine.update({
            where: { id: line.id },
            data: { estado: 'AJUSTADO' },
          });
        }
      }
    }

    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: { estado: 'CERRADO', fechaCierre: new Date() },
      include: { lineas: { include: { sku: true } } },
    });

    await this.audit(body.usuario, 'CERRAR_CONTEO', 'CycleCount', id,
      `${cc.codigo}: ${body.aplicarAjustes ? 'Ajustes aplicados' : 'Sin ajustes'}`);

    return updated;
  }
}
