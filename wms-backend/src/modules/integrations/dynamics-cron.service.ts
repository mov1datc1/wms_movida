import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DynamicsSyncService } from './dynamics-sync.service.js';
import { DynamicsService } from './dynamics.service.js';

/**
 * Automatic Dynamics 365 sync scheduler.
 * 
 * Runs every 30 minutes during office hours (Mon-Sat, 6:00 AM - 8:00 PM Guatemala CST).
 * Syncs: Items, Customers, Vendors, Purchase Orders, Sales Orders.
 * 
 * The cron only runs if Dynamics is properly configured (not in demo mode).
 */
@Injectable()
export class DynamicsCronService {
  private readonly logger = new Logger('DynamicsCron');

  constructor(
    private readonly syncService: DynamicsSyncService,
    private readonly dynamics: DynamicsService,
  ) {}

  /**
   * Auto-sync every 30 minutes, Mon-Sat, 6:00-20:00 (Guatemala = UTC-6)
   * Cron: At minute 0 and 30, hours 6-20, Mon-Sat
   * 
   * Note: Render servers run in UTC. Guatemala is UTC-6.
   * So 6:00-20:00 CST = 12:00-02:00+1 UTC
   * We use: minute 0,30 | hours 12-23,0-2 | any day of month | any month | Mon-Sat
   * 
   * Simplified: run every 30 min and check time in code (more readable)
   */
  @Cron('0,30 * * * 1-6') // Every 30 min, Mon-Sat — time check in code
  async handleAutoSync() {
    // ── Check if we're in office hours (Guatemala CST = UTC-6) ──
    const now = new Date();
    const guatemalaHour = (now.getUTCHours() - 6 + 24) % 24;
    
    if (guatemalaHour < 6 || guatemalaHour >= 20) {
      // Outside office hours — skip silently
      return;
    }

    // ── Check if Dynamics is configured ──
    try {
      await this.dynamics.ensureConfigLoaded();
    } catch {
      // Config not loaded yet — skip
      return;
    }

    if (!this.dynamics.isConfigured()) {
      this.logger.debug('⏭️ Skipping auto-sync: Dynamics not configured');
      return;
    }

    this.logger.log(`🔄 Auto-sync starting (Guatemala time: ${guatemalaHour}:${String(now.getUTCMinutes()).padStart(2, '0')})`);

    const results: string[] = [];

    try {
      // 1. Sync Items → SKU Master
      const items = await this.syncService.syncItems('auto-cron');
      results.push(`Items: ${items.registros ?? 0} synced`);
    } catch (e: any) {
      results.push(`Items: ERROR - ${e.message}`);
    }

    try {
      // 2. Sync Customers → Restaurantes
      const customers = await this.syncService.syncCustomers('auto-cron');
      results.push(`Customers: ${customers.registros ?? 0} synced`);
    } catch (e: any) {
      results.push(`Customers: ERROR - ${e.message}`);
    }

    try {
      // 3. Sync Vendors → Proveedores
      const vendors = await this.syncService.syncVendors('auto-cron');
      results.push(`Vendors: ${vendors.registros ?? 0} synced`);
    } catch (e: any) {
      results.push(`Vendors: ERROR - ${e.message}`);
    }

    try {
      // 4. Sync Purchase Orders → Recepciones
      const pos = await this.syncService.syncPurchaseOrders('auto-cron');
      results.push(`POs: ${pos.registros ?? 0} synced`);
    } catch (e: any) {
      results.push(`POs: ERROR - ${e.message}`);
    }

    try {
      // 5. Sync Sales Orders → Pedidos
      const sos = await this.syncService.syncSalesOrders('auto-cron');
      results.push(`SOs: ${sos.registros ?? 0} synced`);
    } catch (e: any) {
      results.push(`SOs: ERROR - ${e.message}`);
    }

    this.logger.log(`✅ Auto-sync complete: ${results.join(' | ')}`);
  }
}
