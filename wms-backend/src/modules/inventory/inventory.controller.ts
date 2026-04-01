import { Controller, Get, Post, Put, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';

@ApiTags('Base Data')
@Controller('api')
export class InventoryController {
  constructor(private prisma: PrismaService) {}

  // ============ LOT INVENTORY ============
  @Get('lots')
  @ApiOperation({ summary: 'Listar inventario por lote' })
  async getLots(
    @Query('skuId') skuId?: string,
    @Query('estadoCalidad') estadoCalidad?: string,
    @Query('almacenId') almacenId?: string,
  ) {
    const where: any = {};
    if (skuId) where.skuId = skuId;
    if (estadoCalidad) where.estadoCalidad = estadoCalidad;
    if (almacenId) where.ubicacion = { almacenId };

    return this.prisma.lotInventory.findMany({
      where,
      include: {
        sku: { select: { codigoDynamics: true, descripcion: true, categoria: true, temperaturaRequerida: true } },
        ubicacion: { select: { codigo: true, zona: true } },
      },
      orderBy: { fechaVencimiento: 'asc' }, // FEFO
    });
  }

  @Get('lots/:id')
  @ApiOperation({ summary: 'Obtener detalle de lote' })
  async getLot(@Param('id') id: string) {
    return this.prisma.lotInventory.findUnique({
      where: { id },
      include: {
        sku: true,
        ubicacion: true,
        hojasManejo: true,
        movimientos: { take: 20, orderBy: { fechaHora: 'desc' } },
      },
    });
  }

  @Post('lots')
  @ApiOperation({ summary: 'Registrar nuevo lote (recepción)' })
  async createLot(@Body() data: any) {
    return this.prisma.lotInventory.create({
      data,
      include: { sku: true, ubicacion: true },
    });
  }

  @Put('lots/:id')
  @ApiOperation({ summary: 'Actualizar lote (calidad, cantidad, ubicación)' })
  async updateLot(@Param('id') id: string, @Body() data: any) {
    return this.prisma.lotInventory.update({
      where: { id },
      data,
      include: { sku: true, ubicacion: true },
    });
  }

  // ============ HANDLING UNITS ============
  @Get('handling-units')
  @ApiOperation({ summary: 'Listar Handling Units (HU/LPN)' })
  async getHandlingUnits(@Query('lotId') lotId?: string) {
    const where: any = {};
    if (lotId) where.lotId = lotId;

    return this.prisma.handlingUnit.findMany({
      where,
      include: { lote: { include: { sku: { select: { descripcion: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('handling-units')
  @ApiOperation({ summary: 'Crear Handling Unit' })
  async createHU(@Body() data: any) {
    return this.prisma.handlingUnit.create({
      data,
      include: { lote: true },
    });
  }

  // ============ DASHBOARD STATS ============
  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Estadísticas del dashboard' })
  async getDashboardStats(@Query('almacenId') almacenId?: string) {
    const locationWhere: any = almacenId ? { almacenId } : {};

    const lotWhere: any = almacenId ? { ubicacion: { almacenId } } : {};

    const [skuCount, lotCount, locationCount, locations, pendingOrders, lotsByExpiry] = await Promise.all([
      this.prisma.skuMaster.count({ where: { activo: true } }),
      this.prisma.lotInventory.count({ where: lotWhere }),
      this.prisma.location.count({ where: locationWhere }),
      this.prisma.location.findMany({ where: locationWhere }),
      this.prisma.outboundOrder.count({ where: { estado: 'PENDIENTE' } }),
      this.prisma.lotInventory.findMany({
        where: { ...lotWhere, fechaVencimiento: { not: null } },
        select: { fechaVencimiento: true },
      }),
    ]);

    const totalCapacity = locations.reduce((s, l) => s + l.capacidad, 0);
    const totalOccupied = locations.reduce((s, l) => s + l.ocupacion, 0);
    const fillRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 1000) / 10 : 0;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringLots = lotsByExpiry.filter(
      (l) => l.fechaVencimiento && l.fechaVencimiento <= sevenDaysFromNow,
    ).length;

    return {
      skusActivos: skuCount,
      lotesEnStock: lotCount,
      ubicaciones: locationCount,
      fillRate,
      pedidosPendientes: pendingOrders,
      lotesPorVencer: expiringLots,
    };
  }
}
