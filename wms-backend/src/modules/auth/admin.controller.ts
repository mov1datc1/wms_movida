import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcrypt';

const ALL_MODULES = ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin'];

@ApiTags('Admin')
@Controller('api/admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  // ============ ROLES ============
  @Get('roles')
  @ApiOperation({ summary: 'Listar roles con permisos' })
  async getRoles() {
    return this.prisma.role.findMany({
      include: { permisos: true, _count: { select: { usuarios: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  @Post('roles')
  @ApiOperation({ summary: 'Crear rol con módulos permitidos' })
  async createRole(@Body() data: { nombre: string; descripcion?: string; modulos: string[] }) {
    const role = await this.prisma.role.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        permisos: {
          create: data.modulos.map(m => ({ modulo: m })),
        },
      },
      include: { permisos: true },
    });
    return role;
  }

  @Put('roles/:id')
  @ApiOperation({ summary: 'Actualizar rol y módulos' })
  async updateRole(
    @Param('id') id: string,
    @Body() data: { nombre?: string; descripcion?: string; modulos?: string[] },
  ) {
    if (data.modulos) {
      // Delete existing permissions and recreate
      await this.prisma.rolePermission.deleteMany({ where: { rolId: id } });
      await this.prisma.rolePermission.createMany({
        data: data.modulos.map(m => ({ rolId: id, modulo: m })),
      });
    }

    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;

    const role = await this.prisma.role.update({
      where: { id },
      data: updateData,
      include: { permisos: true, _count: { select: { usuarios: true } } },
    });
    return role;
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Eliminar rol' })
  async deleteRole(@Param('id') id: string) {
    // Check if any users have this role
    const count = await this.prisma.user.count({ where: { rolId: id } });
    if (count > 0) {
      throw new HttpException(`No se puede eliminar: ${count} usuario(s) tienen este rol`, HttpStatus.BAD_REQUEST);
    }
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  // ============ USERS ============
  @Get('users')
  @ApiOperation({ summary: 'Listar usuarios' })
  async getUsers() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, nombre: true, rolId: true, almacenId: true, activo: true, createdAt: true,
        rol: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  @Post('users')
  @ApiOperation({ summary: 'Crear usuario' })
  async createUser(@Body() data: { email: string; nombre: string; password: string; rolId?: string; almacenId?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpException('Email ya registrado', HttpStatus.CONFLICT);

    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { email: data.email, nombre: data.nombre, passwordHash: hash, rolId: data.rolId, almacenId: data.almacenId },
      select: { id: true, email: true, nombre: true, rolId: true, almacenId: true, activo: true },
    });

    await this.prisma.auditLog.create({
      data: { usuario: 'Admin', accion: 'CREAR_USUARIO', entidad: 'User', entidadId: user.id, detalle: `${data.nombre} (${data.email})` },
    });

    return user;
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  async updateUser(@Param('id') id: string, @Body() data: { nombre?: string; rolId?: string; almacenId?: string; activo?: boolean }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, nombre: true, rolId: true, almacenId: true, activo: true,
        rol: { select: { nombre: true } } },
    });
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Resetear contraseña de usuario' })
  async resetPassword(@Param('id') id: string, @Body() data: { newPassword: string }) {
    const hash = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });

    await this.prisma.auditLog.create({
      data: { usuario: 'Admin', accion: 'RESET_PASSWORD', entidad: 'User', entidadId: id, detalle: 'Password reset by admin' },
    });

    return { success: true, message: 'Contraseña actualizada' };
  }

  // ============ PLATFORM SETTINGS ============
  @Get('settings')
  @ApiOperation({ summary: 'Obtener configuración de plataforma' })
  async getSettings() {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }
    return settings;
  }

  @Put('settings')
  @ApiOperation({ summary: 'Actualizar configuración de plataforma (logo, nombre)' })
  async updateSettings(@Body() data: { logoUrl?: string; nombre?: string; subtitulo?: string }) {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data });
    } else {
      settings = await this.prisma.platformSettings.update({
        where: { id: settings.id },
        data,
      });
    }
    return settings;
  }

  // ============ MODULE LIST ============
  @Get('modules')
  @ApiOperation({ summary: 'Listar todos los módulos disponibles para RBAC' })
  async getModules() {
    return ALL_MODULES.map(m => ({
      key: m,
      label: {
        dashboard: 'Dashboard', inventario: 'Stock por Lote', ubicaciones: 'Ubicaciones CEDIS',
        recepcion: 'Recepción', picking: 'Picking FEFO', despacho: 'Despacho',
        trazabilidad: 'Rastreo de Lotes', maestros: 'Datos Maestros', calidad: 'Reglas Calidad',
        dynamics: 'Sync Dynamics', admin: 'Panel Admin',
      }[m] || m,
    }));
  }

  // ============ WAREHOUSES / CEDIS ============
  @Get('warehouses')
  @ApiOperation({ summary: 'Listar almacenes con conteo de ubicaciones' })
  async getWarehouses() {
    return this.prisma.warehouse.findMany({
      include: { _count: { select: { locations: true, movements: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Crear nuevo almacén/CEDIS' })
  async createWarehouse(@Body() data: { codigo: string; nombre: string; direccion?: string; ciudad?: string }) {
    const existing = await this.prisma.warehouse.findUnique({ where: { codigo: data.codigo } });
    if (existing) throw new HttpException('Ya existe un almacén con ese código', HttpStatus.CONFLICT);

    const warehouse = await this.prisma.warehouse.create({ data });

    await this.prisma.auditLog.create({
      data: { usuario: 'Admin', accion: 'CREAR_ALMACEN', entidad: 'Warehouse', entidadId: warehouse.id, detalle: `${data.nombre} (${data.codigo})` },
    });

    return warehouse;
  }

  @Put('warehouses/:id')
  @ApiOperation({ summary: 'Actualizar almacén (nombre, dirección, ciudad, activo)' })
  async updateWarehouse(@Param('id') id: string, @Body() data: { nombre?: string; codigo?: string; direccion?: string; ciudad?: string; activo?: boolean }) {
    // If changing codigo, check uniqueness
    if (data.codigo) {
      const existing = await this.prisma.warehouse.findFirst({ where: { codigo: data.codigo, NOT: { id } } });
      if (existing) throw new HttpException('Ya existe otro almacén con ese código', HttpStatus.CONFLICT);
    }

    const warehouse = await this.prisma.warehouse.update({
      where: { id },
      data,
      include: { _count: { select: { locations: true, movements: true } } },
    });

    await this.prisma.auditLog.create({
      data: { usuario: 'Admin', accion: 'EDITAR_ALMACEN', entidad: 'Warehouse', entidadId: id, detalle: `Actualizado: ${warehouse.nombre}` },
    });

    return warehouse;
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Eliminar almacén (solo si no tiene ubicaciones ni movimientos)' })
  async deleteWarehouse(@Param('id') id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { locations: true, movements: true } } },
    });

    if (!warehouse) throw new HttpException('Almacén no encontrado', HttpStatus.NOT_FOUND);

    if (warehouse._count.locations > 0) {
      throw new HttpException(`No se puede eliminar: tiene ${warehouse._count.locations} ubicación(es) asociada(s). Elimine o reasigne las ubicaciones primero.`, HttpStatus.BAD_REQUEST);
    }
    if (warehouse._count.movements > 0) {
      throw new HttpException(`No se puede eliminar: tiene ${warehouse._count.movements} movimiento(s) registrado(s). Solo puede desactivarlo.`, HttpStatus.BAD_REQUEST);
    }

    await this.prisma.warehouse.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: { usuario: 'Admin', accion: 'ELIMINAR_ALMACEN', entidad: 'Warehouse', entidadId: id, detalle: `Eliminado: ${warehouse.nombre} (${warehouse.codigo})` },
    });

    return { success: true, message: `Almacén "${warehouse.nombre}" eliminado` };
  }
}
