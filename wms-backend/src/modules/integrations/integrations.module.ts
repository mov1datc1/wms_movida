import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';
import { DynamicsService } from './dynamics.service.js';
import { DynamicsSyncService } from './dynamics-sync.service.js';
import { DynamicsController } from './dynamics.controller.js';

@Module({
  controllers: [DynamicsController],
  providers: [DynamicsService, DynamicsSyncService, PrismaService],
  exports: [DynamicsService, DynamicsSyncService],
})
export class IntegrationsModule {}
