import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DynamicsService } from './dynamics.service.js';
import { DynamicsSyncService } from './dynamics-sync.service.js';

@ApiTags('Integrations')
@Controller('api/dynamics')
export class DynamicsController {
  constructor(
    private dynamics: DynamicsService,
    private syncService: DynamicsSyncService,
  ) {}

  // ── Connection Status ─────────────────────────────────

  @Get('status')
  @ApiOperation({ summary: 'Get Dynamics 365 connection status' })
  getStatus() {
    return this.dynamics.getStatus();
  }

  // ── Full Sync ─────────────────────────────────────────

  @Post('sync/full')
  @ApiOperation({ summary: 'Run full bidirectional sync' })
  async runFullSync(@Query('usuario') usuario?: string) {
    const result = await this.syncService.runFullSync(usuario || 'system');
    return {
      success: true,
      message: `Sincronización completa: ${result.totalRecords} registros procesados`,
      ...result,
    };
  }

  // ── Individual Entity Syncs ───────────────────────────

  @Post('sync/items')
  @ApiOperation({ summary: 'Sync Items from Dynamics → SkuMaster' })
  async syncItems(@Query('usuario') usuario?: string) {
    return this.syncService.syncItems(usuario || 'system');
  }

  @Post('sync/customers')
  @ApiOperation({ summary: 'Sync Customers from Dynamics → Restaurante' })
  async syncCustomers(@Query('usuario') usuario?: string) {
    return this.syncService.syncCustomers(usuario || 'system');
  }

  @Post('sync/vendors')
  @ApiOperation({ summary: 'Sync Vendors from Dynamics' })
  async syncVendors(@Query('usuario') usuario?: string) {
    return this.syncService.syncVendors(usuario || 'system');
  }

  @Post('sync/purchase-orders')
  @ApiOperation({ summary: 'Sync Purchase Orders from Dynamics' })
  async syncPurchaseOrders(@Query('usuario') usuario?: string) {
    return this.syncService.syncPurchaseOrders(usuario || 'system');
  }

  @Post('sync/sales-orders')
  @ApiOperation({ summary: 'Sync Sales Orders from Dynamics' })
  async syncSalesOrders(@Query('usuario') usuario?: string) {
    return this.syncService.syncSalesOrders(usuario || 'system');
  }

  // ── Outbound (WMS → Dynamics) ─────────────────────────

  @Post('push/receipts')
  @ApiOperation({ summary: 'Push confirmed receipts to Dynamics' })
  async pushReceipts(@Query('usuario') usuario?: string) {
    return this.syncService.pushReceipts(usuario || 'system');
  }

  @Post('push/dispatches')
  @ApiOperation({ summary: 'Push confirmed dispatches to Dynamics' })
  async pushDispatches(@Query('usuario') usuario?: string) {
    return this.syncService.pushDispatches(usuario || 'system');
  }

  @Post('push/inventory-adjustments')
  @ApiOperation({ summary: 'Push inventory adjustments to Dynamics' })
  async pushInventoryAdjustments(@Query('usuario') usuario?: string) {
    return this.syncService.pushInventoryAdjustments(usuario || 'system');
  }

  // ── Sync History & Stats ──────────────────────────────

  @Get('sync/history')
  @ApiOperation({ summary: 'Get sync execution history' })
  async getSyncHistory(@Query('limit') limit?: string) {
    return this.syncService.getSyncHistory(limit ? parseInt(limit) : 50);
  }

  @Get('sync/stats')
  @ApiOperation({ summary: 'Get sync statistics' })
  async getSyncStats() {
    return this.syncService.getSyncStats();
  }
}
