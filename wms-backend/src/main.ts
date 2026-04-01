import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      // Allow localhost for development
      if (origin.includes('localhost')) return callback(null, true);
      // Allow any Vercel deployment
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      // Allow custom domains (add your production domain here)
      const allowedDomains = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
      if (allowedDomains.includes(origin)) return callback(null, true);
      callback(null, true); // Allow all for now during initial deploy
    },
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Taco Bell WMS — API')
    .setDescription('API de Sistema de Gestión de Almacenes (CEDIS) · NestJS + Prisma + Supabase')
    .setVersion('1.0')
    .addTag('Base Data', 'Catálogos: SKUs, Restaurantes, Ubicaciones, Almacenes')
    .addTag('Operations', 'Recepción, Movimientos, Órdenes, Trazabilidad')
    .addTag('Integrations', 'Sync with MS Dynamics 365')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n🌮 Taco Bell WMS Backend corriendo en: http://localhost:${port}`);
  console.log(`📄 Swagger API Docs: http://localhost:${port}/api/docs\n`);
}
bootstrap();
