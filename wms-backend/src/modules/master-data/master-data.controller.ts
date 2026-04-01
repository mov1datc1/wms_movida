import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';

@ApiTags('Base Data')
@Controller('api')
export class MasterDataController {
  constructor(private prisma: PrismaService) {}

  // ============ WAREHOUSES ============
  @Get('warehouses')
  @ApiOperation({ summary: 'Listar almacenes' })
  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      include: { _count: { select: { locations: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Obtener almacén por ID' })
  async getWarehouse(@Param('id') id: string) {
    return this.prisma.warehouse.findUnique({
      where: { id },
      include: { locations: true },
    });
  }

  // ============ SKUs ============
  @Get('skus')
  @ApiOperation({ summary: 'Listar catálogo de SKUs' })
  async getSkus(
    @Query('categoria') categoria?: string,
    @Query('temperatura') temperatura?: string,
    @Query('activo') activo?: string,
  ) {
    const where: any = {};
    if (categoria) where.categoria = categoria;
    if (temperatura) where.temperaturaRequerida = temperatura;
    if (activo !== undefined) where.activo = activo === 'true';

    return this.prisma.skuMaster.findMany({
      where,
      orderBy: { codigoDynamics: 'asc' },
    });
  }

  @Get('skus/:id')
  @ApiOperation({ summary: 'Obtener SKU por ID' })
  async getSku(@Param('id') id: string) {
    return this.prisma.skuMaster.findUnique({
      where: { id },
      include: { lotes: true },
    });
  }

  @Post('skus')
  @ApiOperation({ summary: 'Crear SKU' })
  async createSku(@Body() data: any) {
    const sku = await this.prisma.skuMaster.create({ data });
    await this.prisma.auditLog.create({
      data: {
        usuario: data.usuario || 'Jonathan P.',
        accion: 'CREAR_SKU',
        entidad: 'SkuMaster',
        entidadId: sku.id,
        detalle: `SKU: ${sku.codigoDynamics} — ${sku.descripcion}`,
      },
    });
    return sku;
  }

  @Put('skus/:id')
  @ApiOperation({ summary: 'Actualizar SKU' })
  async updateSku(@Param('id') id: string, @Body() data: any) {
    return this.prisma.skuMaster.update({ where: { id }, data });
  }

  // ============ RESTAURANTES ============
  @Get('restaurantes')
  @ApiOperation({ summary: 'Listar restaurantes Taco Bell' })
  async getRestaurantes(@Query('activo') activo?: string) {
    const where: any = {};
    if (activo !== undefined) where.activo = activo === 'true';
    return this.prisma.restaurante.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  @Get('restaurantes/:id')
  @ApiOperation({ summary: 'Obtener restaurante por ID' })
  async getRestaurante(@Param('id') id: string) {
    return this.prisma.restaurante.findUnique({
      where: { id },
      include: { ordenes: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
  }

  // ============ LOCATIONS ============
  @Get('locations')
  @ApiOperation({ summary: 'Listar ubicaciones del CEDIS' })
  async getLocations(
    @Query('almacenId') almacenId?: string,
    @Query('zona') zona?: string,
    @Query('temperatura') temperatura?: string,
    @Query('estado') estado?: string,
    @Query('tipoUbicacion') tipo?: string,
  ) {
    const where: any = {};
    if (almacenId) where.almacenId = almacenId;
    if (zona) where.zona = zona;
    if (temperatura) where.temperatura = temperatura;
    if (estado) where.estado = estado;
    if (tipo) where.tipoUbicacion = tipo;

    return this.prisma.location.findMany({
      where,
      include: { almacen: { select: { codigo: true, nombre: true } } },
      orderBy: { codigo: 'asc' },
    });
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'Obtener ubicación por ID' })
  async getLocation(@Param('id') id: string) {
    return this.prisma.location.findUnique({
      where: { id },
      include: { almacen: true, lotes: { include: { sku: true } } },
    });
  }

  @Put('locations/:id')
  @ApiOperation({ summary: 'Actualizar ubicación (estado, ocupación)' })
  async updateLocation(@Param('id') id: string, @Body() data: any) {
    return this.prisma.location.update({ where: { id }, data });
  }

  // ============ QUALITY RULES ============
  @Get('quality-rules')
  @ApiOperation({ summary: 'Listar reglas de calidad' })
  async getQualityRules() {
    return this.prisma.qualityRule.findMany({ orderBy: { categoriaProducto: 'asc' } });
  }
}
