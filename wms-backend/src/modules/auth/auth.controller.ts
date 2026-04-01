import { Controller, Post, Get, Body, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tb-wms-secret-2026-guatemala';
const SUPERADMIN_EMAIL = 'agenciamovidatci@gmail.com';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login con email y contraseña' })
  async login(@Body() data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { rol: { include: { permisos: true } } },
    });

    if (!user || !user.activo) {
      throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
    }

    const permisos = user.rol?.permisos.map(p => p.modulo) || [];
    const isSuperAdmin = user.email === SUPERADMIN_EMAIL;

    const token = jwt.sign(
      { userId: user.id, email: user.email, rolId: user.rolId, isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    await this.prisma.auditLog.create({
      data: { usuario: user.nombre, accion: 'LOGIN', entidad: 'User', entidadId: user.id, detalle: `Login desde ${data.email}` },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rolId: user.rolId,
        rolNombre: user.rol?.nombre || null,
        almacenId: user.almacenId,
        isSuperAdmin,
        permisos: isSuperAdmin
          ? ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin']
          : permisos,
      },
    };
  }

  @Post('otp/request')
  @ApiOperation({ summary: 'Solicitar OTP para superadmin' })
  async requestOtp(@Body() data: { email: string }) {
    if (data.email !== SUPERADMIN_EMAIL) {
      throw new HttpException('Solo el superadmin puede usar OTP', HttpStatus.FORBIDDEN);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await this.prisma.otpCode.create({
      data: { email: data.email, code, expiresAt },
    });

    // Send OTP via SMTP
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'mail.movidatci.com',
        port: 465,
        secure: true,
        auth: {
          user: 'wms@movidatci.com',
          pass: '1.3f+#J@1}13',
        },
      });

      await transporter.sendMail({
        from: '"TB WMS" <wms@movidatci.com>',
        to: data.email,
        subject: `🔐 Código OTP — TB WMS`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;border-radius:16px;color:white">
            <h1 style="text-align:center;font-size:24px;margin:0 0 8px">TB WMS</h1>
            <p style="text-align:center;color:#94a3b8;font-size:14px;margin:0 0 32px">Código de verificación</p>
            <div style="text-align:center;background:rgba(107,138,255,0.15);border:1px solid rgba(107,138,255,0.3);border-radius:12px;padding:24px;margin:0 0 24px">
              <div style="font-size:36px;font-weight:800;letter-spacing:0.3em;color:#6B8AFF">${code}</div>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:13px">Este código expira en <strong>10 minutos</strong>.</p>
            <p style="text-align:center;color:#64748b;font-size:11px;margin-top:24px">Si no solicitaste este código, ignora este mensaje.</p>
          </div>
        `,
      });
      console.log(`✅ OTP enviado por email a ${data.email}`);
    } catch (err) {
      console.log(`⚠️ SMTP falló, mostrando OTP en consola:`);
      console.log(`  🔐 OTP CODE: ${code} (para ${data.email})`);
    }

    return { success: true, message: 'Código OTP enviado a tu correo electrónico' };
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verificar OTP y crear sesión' })
  async verifyOtp(@Body() data: { email: string; code: string }) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        email: data.email,
        code: data.code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new HttpException('Código OTP inválido o expirado', HttpStatus.UNAUTHORIZED);
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Find or create superadmin user
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { rol: { include: { permisos: true } } },
    });

    if (!user) {
      // Auto-create superadmin on first OTP verify
      const hash = await bcrypt.hash('superadmin2026', 10);
      let role = await this.prisma.role.findUnique({ where: { nombre: 'SuperAdmin' } });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            nombre: 'SuperAdmin',
            descripcion: 'Acceso total al sistema',
            permisos: {
              create: ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin']
                .map(m => ({ modulo: m })),
            },
          },
        });
      }
      user = await this.prisma.user.create({
        data: { email: data.email, nombre: 'Super Admin', passwordHash: hash, rolId: role.id },
        include: { rol: { include: { permisos: true } } },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, rolId: user.rolId, isSuperAdmin: true },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rolId: user.rolId,
        rolNombre: user.rol?.nombre || 'SuperAdmin',
        almacenId: user.almacenId,
        isSuperAdmin: true,
        permisos: ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin'],
      },
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener usuario actual desde token' })
  async getMe(@Headers('authorization') auth: string) {
    if (!auth) throw new HttpException('No autorizado', HttpStatus.UNAUTHORIZED);
    const token = auth.replace('Bearer ', '');

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { rol: { include: { permisos: true } } },
      });
      if (!user || !user.activo) throw new Error('User not found');

      const isSuperAdmin = user.email === SUPERADMIN_EMAIL;
      const permisos = user.rol?.permisos.map(p => p.modulo) || [];

      return {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rolId: user.rolId,
        rolNombre: user.rol?.nombre || null,
        almacenId: user.almacenId,
        isSuperAdmin,
        permisos: isSuperAdmin
          ? ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin']
          : permisos,
      };
    } catch {
      throw new HttpException('Token inválido o expirado', HttpStatus.UNAUTHORIZED);
    }
  }

  // Seed endpoint — creates initial superadmin if none exists
  @Post('seed')
  @ApiOperation({ summary: 'Seed superadmin user (run once)' })
  async seed() {
    const existing = await this.prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL } });
    if (existing) return { message: 'SuperAdmin ya existe', userId: existing.id };

    let role = await this.prisma.role.findUnique({ where: { nombre: 'SuperAdmin' } });
    if (!role) {
      role = await this.prisma.role.create({
        data: {
          nombre: 'SuperAdmin',
          descripcion: 'Acceso total al sistema',
          permisos: {
            create: ['dashboard','inventario','ubicaciones','recepcion','picking','despacho','trazabilidad','maestros','calidad','dynamics','admin']
              .map(m => ({ modulo: m })),
          },
        },
      });
    }

    const hash = await bcrypt.hash('admin123', 10);
    const user = await this.prisma.user.create({
      data: { email: SUPERADMIN_EMAIL, nombre: 'Super Admin', passwordHash: hash, rolId: role.id },
    });

    // Also create platform settings if not exist
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      await this.prisma.platformSettings.create({ data: {} });
    }

    return { message: 'SuperAdmin creado', userId: user.id, email: SUPERADMIN_EMAIL, password: 'admin123' };
  }
}
