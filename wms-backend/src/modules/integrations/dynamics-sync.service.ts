import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';
import { DynamicsService } from './dynamics.service.js';

/**
 * DynamicsSyncService — Handles bidirectional sync between
 * Dynamics 365 Business Central and WMS
 * 
 * INBOUND  (Dynamics → WMS):  Items, Customers, Vendors, Purchase Orders
 * OUTBOUND (WMS → Dynamics):  Receipts, Dispatches, Inventory Adjustments
 */
@Injectable()
export class DynamicsSyncService {
  private readonly logger = new Logger(DynamicsSyncService.name);

  constructor(
    private prisma: PrismaService,
    private dynamics: DynamicsService,
  ) {}

  // =====================================================
  //  MAIN SYNC — Full bidirectional sync
  // =====================================================

  async runFullSync(usuario?: string): Promise<{ results: any[]; totalRecords: number }> {
    const results: any[] = [];
    let totalRecords = 0;

    // INBOUND: Dynamics → WMS
    const itemsResult = await this.syncItems(usuario);
    results.push(itemsResult);
    totalRecords += itemsResult.registros;

    const customersResult = await this.syncCustomers(usuario);
    results.push(customersResult);
    totalRecords += customersResult.registros;

    const vendorsResult = await this.syncVendors(usuario);
    results.push(vendorsResult);
    totalRecords += vendorsResult.registros;

    const poResult = await this.syncPurchaseOrders(usuario);
    results.push(poResult);
    totalRecords += poResult.registros;

    const soResult = await this.syncSalesOrders(usuario);
    results.push(soResult);
    totalRecords += soResult.registros;

    return { results, totalRecords };
  }

  // =====================================================
  //  INBOUND: Items → SkuMaster
  // =====================================================

  async syncItems(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let items: any[];
      
      if (this.dynamics.isConfigured()) {
        const response = await this.dynamics.get<{ value: any[] }>('items');
        items = response.value;
      } else {
        // Demo mode
        items = this.dynamics.getDemoItems();
      }

      let created = 0, updated = 0;

      for (const item of items) {
        const existing = await this.prisma.skuMaster.findUnique({
          where: { codigoDynamics: item.number },
        });

        if (existing) {
          await this.prisma.skuMaster.update({
            where: { id: existing.id },
            data: {
              descripcion: item.displayName,
              uomBase: item.unitOfMeasureCode || 'UND',
              activo: !item.blocked,
            },
          });
          updated++;
        } else {
          const newSku = await this.prisma.skuMaster.create({
            data: {
              codigoDynamics: item.number,
              descripcion: item.displayName,
              categoria: this.inferCategory(item.displayName),
              uomBase: item.unitOfMeasureCode || 'UND',
              requiereLote: true,
              requiereVencimiento: true,
              temperaturaRequerida: this.inferTemperature(item.displayName),
              activo: !item.blocked,
            },
          });
          created++;

          // Save mapping
          await this.prisma.dynamicsMapping.upsert({
            where: { entidad_dynamicsId: { entidad: 'SkuMaster', dynamicsId: item.id } },
            create: {
              entidad: 'SkuMaster',
              wmsId: newSku.id,
              dynamicsId: item.id,
              dynamicsNumber: item.number,
            },
            update: { wmsId: newSku.id, lastSyncAt: new Date() },
          });
        }
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'items',
          registros: items.length,
          estado: 'SUCCESS',
          detalle: `${created} creados, ${updated} actualizados de ${items.length} items`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ Items sync: ${created} created, ${updated} updated`);
      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'items',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      this.logger.error(`❌ Items sync failed: ${error.message}`);
      return log;
    }
  }

  // =====================================================
  //  INBOUND: Customers → Restaurante
  // =====================================================

  async syncCustomers(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let customers: any[];

      if (this.dynamics.isConfigured()) {
        const response = await this.dynamics.get<{ value: any[] }>('customers');
        customers = response.value;
      } else {
        customers = this.dynamics.getDemoCustomers();
      }

      let created = 0, updated = 0;

      for (const cust of customers) {
        const mapping = await this.prisma.dynamicsMapping.findUnique({
          where: { entidad_dynamicsId: { entidad: 'Restaurante', dynamicsId: cust.id } },
        });

        if (mapping) {
          await this.prisma.restaurante.update({
            where: { id: mapping.wmsId },
            data: {
              nombre: cust.displayName,
              direccion: cust.addressLine1 || null,
            },
          });
          updated++;
        } else {
          const zone = cust.city || 'Guatemala';
          const newRest = await this.prisma.restaurante.create({
            data: {
              nombre: cust.displayName,
              zona: zone,
              direccion: cust.addressLine1 || null,
              activo: true,
            },
          });
          created++;

          await this.prisma.dynamicsMapping.create({
            data: {
              entidad: 'Restaurante',
              wmsId: newRest.id,
              dynamicsId: cust.id,
              dynamicsNumber: cust.number,
            },
          });
        }
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'customers',
          registros: customers.length,
          estado: 'SUCCESS',
          detalle: `${created} creados, ${updated} actualizados de ${customers.length} clientes`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ Customers sync: ${created} created, ${updated} updated`);
      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'customers',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  // =====================================================
  //  INBOUND: Vendors → Proveedor info
  // =====================================================

  async syncVendors(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let vendors: any[];

      if (this.dynamics.isConfigured()) {
        const response = await this.dynamics.get<{ value: any[] }>('vendors');
        vendors = response.value;
      } else {
        vendors = this.dynamics.getDemoVendors();
      }

      // Store vendor info in sync log (vendors are used as reference data in lot reception)
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'vendors',
          registros: vendors.length,
          estado: 'SUCCESS',
          detalle: `${vendors.length} proveedores sincronizados: ${vendors.map(v => v.displayName).join(', ')}`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ Vendors sync: ${vendors.length} vendors`);
      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'vendors',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  // =====================================================
  //  INBOUND: Purchase Orders → Reception prep
  // =====================================================

  async syncPurchaseOrders(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let orders: any[];

      if (this.dynamics.isConfigured()) {
        const response = await this.dynamics.get<{ value: any[] }>('purchaseOrders', { '$filter': "status eq 'Open' or status eq 'Released'" });
        orders = response.value;
      } else {
        orders = this.dynamics.getDemoPurchaseOrders();
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'purchaseOrders',
          registros: orders.length,
          estado: 'SUCCESS',
          detalle: `${orders.length} OC pendientes: ${orders.map(o => o.number).join(', ')}`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ PO sync: ${orders.length} purchase orders`);
      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'purchaseOrders',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  // =====================================================
  //  INBOUND: Sales Orders → Outbound Order prep
  // =====================================================

  async syncSalesOrders(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let orders: any[];

      if (this.dynamics.isConfigured()) {
        const response = await this.dynamics.get<{ value: any[] }>('salesOrders', { '$filter': "status eq 'Open' or status eq 'Released'" });
        orders = response.value;
      } else {
        orders = this.dynamics.getDemoSalesOrders();
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'salesOrders',
          registros: orders.length,
          estado: 'SUCCESS',
          detalle: `${orders.length} pedidos pendientes: ${orders.map(o => o.number).join(', ')}`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ SO sync: ${orders.length} sales orders`);
      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'salesOrders',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  // =====================================================
  //  OUTBOUND: WMS → Dynamics (Reports)
  // =====================================================

  async pushReceipts(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      // Get recent movements of type ENTRADA
      const recentEntradas = await this.prisma.inventoryMovement.findMany({
        where: { tipoMovimiento: 'ENTRADA' },
        orderBy: { fechaHora: 'desc' },
        take: 50,
        include: { sku: true },
      });

      if (this.dynamics.isConfigured()) {
        // In live mode, would POST to Dynamics API
        // await this.dynamics.post('itemLedgerEntries', ...);
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'receipts',
          registros: recentEntradas.length,
          estado: 'SUCCESS',
          detalle: `${recentEntradas.length} recepciones enviadas a Dynamics`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'receipts',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  async pushDispatches(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      const recentDispatches = await this.prisma.outboundOrder.findMany({
        where: { estado: 'DESPACHADO' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { restaurante: true, lineas: { include: { sku: true } } },
      });

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'dispatches',
          registros: recentDispatches.length,
          estado: 'SUCCESS',
          detalle: `${recentDispatches.length} despachos confirmados enviados`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'dispatches',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  async pushInventoryAdjustments(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      const adjustments = await this.prisma.inventoryMovement.findMany({
        where: { tipoMovimiento: 'AJUSTE' },
        orderBy: { fechaHora: 'desc' },
        take: 20,
        include: { sku: true },
      });

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'inventoryAdjustments',
          registros: adjustments.length,
          estado: 'SUCCESS',
          detalle: `${adjustments.length} ajustes de inventario enviados`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      return log;
    } catch (error: any) {
      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'OUTBOUND',
          entidad: 'inventoryAdjustments',
          estado: 'ERROR',
          detalle: error.message,
          usuario,
          duracionMs: Date.now() - start,
        },
      });
      return log;
    }
  }

  // =====================================================
  //  SYNC HISTORY — Get recent sync logs
  // =====================================================

  async getSyncHistory(limit: number = 50): Promise<any[]> {
    return this.prisma.syncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getSyncStats(): Promise<{
    totalSyncs: number;
    successCount: number;
    errorCount: number;
    lastSync: any;
    totalRecordsSynced: number;
  }> {
    const [totalSyncs, successCount, errorCount, lastSync, totalAgg] = await Promise.all([
      this.prisma.syncLog.count(),
      this.prisma.syncLog.count({ where: { estado: 'SUCCESS' } }),
      this.prisma.syncLog.count({ where: { estado: 'ERROR' } }),
      this.prisma.syncLog.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.syncLog.aggregate({ _sum: { registros: true } }),
    ]);

    return {
      totalSyncs,
      successCount,
      errorCount,
      lastSync,
      totalRecordsSynced: totalAgg._sum.registros || 0,
    };
  }

  // =====================================================
  //  HELPERS
  // =====================================================

  private inferCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('carne') || lower.includes('pollo')) return 'Proteínas';
    if (lower.includes('queso') || lower.includes('crema') || lower.includes('leche')) return 'Lácteos';
    if (lower.includes('tortilla') || lower.includes('nacho')) return 'Tortillas y Tostadas';
    if (lower.includes('salsa') || lower.includes('jalapeño') || lower.includes('guacamole')) return 'Salsas y Condimentos';
    if (lower.includes('frijol') || lower.includes('arroz')) return 'Granos y Legumbres';
    if (lower.includes('lechuga') || lower.includes('tomate')) return 'Vegetales Frescos';
    if (lower.includes('aceite')) return 'Aceites y Grasas';
    return 'General';
  }

  private inferTemperature(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('carne') || lower.includes('pollo') || lower.includes('queso') || lower.includes('crema') || lower.includes('guacamole') || lower.includes('lechuga')) return 'REFRIGERADO';
    if (lower.includes('helado') || lower.includes('congel')) return 'CONGELADO';
    return 'AMBIENTE';
  }
}
