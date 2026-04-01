import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [MasterDataController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class MasterDataModule {}
