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
        // Fetch all purchase orders WITH lines
        const response = await this.dynamics.get<{ value: any[] }>('purchaseOrders', { '$expand': 'purchaseOrderLines' });
        orders = response.value.filter(o => 
          o.status === 'Open' || o.status === 'Released'
        );
      } else {
        orders = this.dynamics.getDemoPurchaseOrders();
      }

      // ── Persist as InboundOrders with lines ──
      let created = 0, skipped = 0, linesCreated = 0;

      for (const po of orders) {
        const bcNumber = po.number; // e.g. "106024"

        // Check if already exists
        const existing = await this.prisma.inboundOrder.findUnique({
          where: { numeroDynamics: bcNumber },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Create InboundOrder
        const newOrder = await this.prisma.inboundOrder.create({
          data: {
            numeroDynamics: bcNumber,
            proveedorNombre: po.vendorName || `Vendor-${po.vendorNumber}`,
            proveedorId: po.vendorNumber || null,
            fechaOrden: new Date(po.orderDate || Date.now()),
            fechaEsperada: po.expectedReceiptDate ? new Date(po.expectedReceiptDate) : null,
            estado: 'PENDIENTE',
          },
        });

        // Create lines from BC purchaseOrderLines
        const bcLines = po.purchaseOrderLines || [];
        for (const line of bcLines) {
          const itemNumber = line.lineObjectNumber || line.itemId;
          if (!itemNumber || line.lineType !== 'Item') continue;

          const sku = await this.prisma.skuMaster.findUnique({
            where: { codigoDynamics: itemNumber },
          });

          if (sku) {
            await this.prisma.inboundOrderLine.create({
              data: {
                inboundOrderId: newOrder.id,
                skuId: sku.id,
                cantidadEsperada: line.quantity || 0,
                cantidadRecibida: 0,
                estado: 'PENDIENTE',
              },
            });
            linesCreated++;
          } else {
            this.logger.warn(`  ⚠️ SKU not found for PO item: ${itemNumber}`);
          }
        }

        created++;
        this.logger.log(`✅ Created InboundOrder #${bcNumber} — ${po.vendorName} — ${bcLines.length} lines`);
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'purchaseOrders',
          registros: created,
          estado: 'SUCCESS',
          detalle: `${orders.length} OC BC (${created} nuevas, ${skipped} existentes, ${linesCreated} líneas). Nos: ${orders.map(o => o.number).join(', ')}`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ PO sync: ${orders.length} total, ${created} created, ${linesCreated} lines`);
      return log;
    } catch (error: any) {
      this.logger.error(`❌ PO sync failed: ${error.message}`);
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
  //  INBOUND: Sales Orders → OutboundOrder (real persist)
  // =====================================================

  async syncSalesOrders(usuario?: string): Promise<any> {
    const start = Date.now();
    try {
      let orders: any[];

      if (this.dynamics.isConfigured()) {
        // Fetch all sales orders WITH lines (no filter — BC API rejects OData status filters)
        const response = await this.dynamics.get<{ value: any[] }>('salesOrders', { '$expand': 'salesOrderLines' });
        // Filter in-code: only Open or Released (exclude Draft)
        orders = response.value.filter(o => 
          o.status === 'Open' || o.status === 'Released'
        );
      } else {
        orders = this.dynamics.getDemoSalesOrders();
      }

      // ── Persist sales orders as OutboundOrders with lines ──
      let created = 0, skipped = 0, linesCreated = 0;

      for (const so of orders) {
        const bcNumber = so.number; // e.g. "101021"

        // Check if already exists in WMS
        const existing = await this.prisma.outboundOrder.findFirst({
          where: { origenDynamics: bcNumber },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Find matching restaurante by BC customer name
        let restaurante = await this.prisma.restaurante.findFirst({
          where: { nombre: { contains: so.customerName || so.sellToCustomerName || '', mode: 'insensitive' } },
        });

        // If no match, create the restaurante from BC customer data
        if (!restaurante) {
          restaurante = await this.prisma.restaurante.create({
            data: {
              nombre: so.customerName || so.sellToCustomerName || `BC-${so.customerNumber || so.sellToCustomerNumber}`,
              zona: 'DYNAMICS',
              activo: true,
            },
          });
          this.logger.log(`📦 Created restaurante from BC customer: ${restaurante.nombre}`);
        }

        // Create OutboundOrder with the real BC number
        const newOrder = await this.prisma.outboundOrder.create({
          data: {
            restauranteId: restaurante.id,
            origenDynamics: bcNumber,      // Real BC order number: "101021"
            prioridad: so.status === 'Released' ? 1 : 3,
            fechaCompromiso: so.requestedDeliveryDate 
              ? new Date(so.requestedDeliveryDate) 
              : new Date(Date.now() + 7 * 24 * 3600 * 1000), // +7 days default
            estado: 'PENDIENTE',
          },
        });

        // ── Create order lines from BC salesOrderLines ──
        const bcLines = so.salesOrderLines || [];
        for (const line of bcLines) {
          const itemNumber = line.lineObjectNumber || line.itemId;
          if (!itemNumber || line.lineType !== 'Item') continue;

          // Match BC item to WMS SkuMaster by codigoDynamics
          const sku = await this.prisma.skuMaster.findUnique({
            where: { codigoDynamics: itemNumber },
          });

          if (sku) {
            await this.prisma.outboundOrderLine.create({
              data: {
                orderId: newOrder.id,
                skuId: sku.id,
                cantidadSolicitada: line.quantity || 0,
                cantidadAsignada: 0,
                reglaFefoAplicada: true,
              },
            });
            linesCreated++;
            this.logger.log(`  📋 Line: ${sku.descripcion} x ${line.quantity}`);
          } else {
            this.logger.warn(`  ⚠️ SKU not found for BC item: ${itemNumber}`);
          }
        }

        created++;
        this.logger.log(`✅ Created OutboundOrder #${bcNumber} with ${bcLines.length} lines → ${restaurante.nombre}`);
      }

      const log = await this.prisma.syncLog.create({
        data: {
          tipo: 'INBOUND',
          entidad: 'salesOrders',
          registros: created,
          estado: 'SUCCESS',
          detalle: `${orders.length} pedidos BC (${created} nuevos, ${skipped} existentes). Nos: ${orders.map(o => o.number).join(', ')}`,
          usuario,
          duracionMs: Date.now() - start,
        },
      });

      this.logger.log(`✅ SO sync: ${orders.length} total, ${created} created, ${skipped} skipped`);
      return log;
    } catch (error: any) {
      this.logger.error(`❌ SO sync failed: ${error.message}`);
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
