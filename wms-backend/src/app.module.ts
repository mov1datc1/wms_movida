import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OperationsModule } from './modules/operations/operations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
  imports: [AuthModule, UsersModule, MasterDataModule, InventoryModule, OperationsModule, IntegrationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
