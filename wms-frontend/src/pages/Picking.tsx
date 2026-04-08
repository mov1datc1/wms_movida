import { useState, useEffect, useMemo } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  ScanLine, CheckCircle2, ChevronRight, Package, MapPin,
  ArrowRight, Loader2, Wifi, PackageOpen, Search
} from 'lucide-react';

import { API } from '../config/api';

interface OrderLine {
  id: string;
  skuId: string;
  cantidadSolicitada: number;
  cantidadAsignada: number;
  lotId?: string;
  reglaFefoAplicada: boolean;
  sku: { codigoDynamics: string; descripcion: string };
}

interface Order {
  id: string;
  restauranteId: string;
  prioridad: number;
  fechaCompromiso: string;
  estado: string;
  origenDynamics?: string;
  restaurante: { nombre: string; zona: string };
  lineas: OrderLine[];
}

interface Lot {
  id: string;
  lote: string;
  skuId: string;
  fechaVencimiento: string | null;
  cantidadDisponible: number;
  estadoCalidad: string;
  ubicacion: { codigo: string } | null;
  sku: { codigoDynamics: string; descripcion: string };
}

function getDaysUntilExpiry(date: string | null): number {
  if (!date) return 999;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

export function Picking() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    async function load() {
      try {
        const whParam = selectedWarehouseId ? `?almacenId=${selectedWarehouseId}` : '';
        const [ordRes, lotRes] = await Promise.all([
          fetch(`${API}/orders`),
          fetch(`${API}/lots${whParam}`),
        ]);
        setOrders(await ordRes.json());
        setLots(await lotRes.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [selectedWarehouseId]);

  const allPendingOrders = orders.filter(o => ['PENDIENTE', 'EN_PICKING'].includes(o.estado));
  
  // Apply filters
  const pendingOrders = useMemo(() => {
    return allPendingOrders.filter(o => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchId = (o.origenDynamics || o.id).toLowerCase().includes(q);
        const matchRest = o.restaurante.nombre.toLowerCase().includes(q);
        if (!matchId && !matchRest) return false;
      }
      if (statusFilter && o.estado !== statusFilter) return false;
      return true;
    });
  }, [allPendingOrders, searchQuery, statusFilter]);

  const selectedOrderData = orders.find(o => o.id === selectedOrder);

  // Suggest best lot for each line using FEFO
  const getFefoLot = (skuId: string): Lot | null => {
    return lots
      .filter(l => l.skuId === skuId && l.cantidadDisponible > 0 && l.estadoCalidad === 'LIBERADO')
      .sort((a, b) => {
        const da = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity;
        const db = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity;
        return da - db;
      })[0] || null;
  };

  const confirmPick = async (lineId: string) => {
    setPickedItems(prev => ({ ...prev, [lineId]: true }));
  };

  const completeOrderPicking = async () => {
    if (!selectedOrder) return;
    setSubmitting(selectedOrder);
    try {
      await fetch(`${API}/orders/${selectedOrder}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'CONSOLIDADO', usuario: 'Jonathan P.' }),
      });
      setOrders(prev => prev.map(o => o.id === selectedOrder ? { ...o, estado: 'CONSOLIDADO' } : o));
      setSelectedOrder(null);
      setPickedItems({});
    } catch { /* ignore */ }
    setSubmitting(null);
  };

  const lines = selectedOrderData?.lineas || [];
  const completedCount = lines.filter(l => pickedItems[l.id]).length;
  const totalCount = lines.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando órdenes desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Picking FEFO</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Surtido inteligente — lote sugerido por menor fecha de vencimiento
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-6)' }}>
        {/* Orders List */}
        <div className="glass-card animate-slide-up" style={{ overflow: 'hidden' }}>
          {/* Search & Filters */}
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" className="form-input" placeholder="Buscar # orden, restaurante..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 'var(--font-xs)' }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {['', 'PENDIENTE', 'EN_PICKING'].map(s => (
                <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setStatusFilter(s)} style={{ fontSize: 10, padding: '2px 8px' }}>
                  {s || 'Todos'}
                </button>
              ))}
            </div>
          </div>
          <div className="data-table-header">
            <div className="data-table-title">📋 Pedidos ({pendingOrders.length})</div>
          </div>
          {pendingOrders.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
              <PackageOpen size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
              <div>Sin pedidos pendientes.</div>
              <div style={{ fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)' }}>
                Crea órdenes de salida desde el módulo Despacho.
              </div>
            </div>
          ) : (
            pendingOrders.map((order) => (
              <div key={order.id} className="alert-item"
                style={{
                  cursor: 'pointer',
                  background: selectedOrder === order.id ? 'var(--accent-primary-soft)' : undefined,
                  borderLeft: selectedOrder === order.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                }}
                onClick={() => { setSelectedOrder(order.id); setPickedItems({}); }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {order.origenDynamics ? `#${order.origenDynamics}` : order.id.substring(0, 12) + '...'}
                    </span>
                    <span className={`badge badge-${order.estado.toLowerCase().replace('_', '-')}`}>
                      {order.estado.replace('_', ' ')}
                    </span>
                    {order.prioridad === 1 && (
                      <span style={{ color: 'var(--danger)', fontSize: 'var(--font-xs)', fontWeight: 700 }}>🔴 URGENTE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                    {order.restaurante.nombre}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                    {order.lineas.length} líneas · Compromiso: {formatDate(order.fechaCompromiso)}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))
          )}
        </div>

        {/* Pick List */}
        <div>
          {selectedOrderData ? (
            <div className="animate-slide-left">
              <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>Picking</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginLeft: 'var(--space-3)' }}>
                      {selectedOrderData.restaurante.nombre}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {completedCount}/{totalCount} líneas
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              {lines.map((line) => {
                const fefoLot = getFefoLot(line.skuId);
                const isPicked = pickedItems[line.id];
                const daysLeft = fefoLot ? getDaysUntilExpiry(fefoLot.fechaVencimiento) : 999;

                return (
                  <div key={line.id} className={`picking-card glass-card ${isPicked ? 'completed' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                          {isPicked ? (
                            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                          ) : (
                            <Package size={20} style={{ color: 'var(--accent-primary)' }} />
                          )}
                          <span style={{ fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {line.sku.descripcion}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-5)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginLeft: 32 }}>
                          {fefoLot && (
                            <>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={12} /> <code style={{ color: 'var(--accent-primary)' }}>{fefoLot.ubicacion?.codigo || '—'}</code>
                              </span>
                              <span>Lote: <strong style={{ color: 'var(--text-secondary)' }}>{fefoLot.lote}</strong></span>
                              <span>Vence: <strong className={daysLeft <= 7 ? 'expiry-critical' : daysLeft <= 30 ? 'expiry-warning' : 'expiry-ok'}>{daysLeft === 999 ? '—' : `${daysLeft}d`}</strong></span>
                            </>
                          )}
                          <span>Cant: <strong style={{ color: 'var(--text-primary)' }}>{line.cantidadSolicitada}</strong></span>
                        </div>

                        {fefoLot && !isPicked && (
                          <div style={{ marginTop: 'var(--space-2)', marginLeft: 32, fontSize: 'var(--font-xs)',
                            color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> FEFO aplicado — lote con menor vencimiento seleccionado
                          </div>
                        )}
                        {!fefoLot && !isPicked && (
                          <div style={{ marginTop: 'var(--space-2)', marginLeft: 32, fontSize: 'var(--font-xs)',
                            color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ⚠️ Sin stock disponible para este SKU
                          </div>
                        )}
                      </div>

                      {!isPicked && (
                        <button className="btn btn-primary btn-sm" onClick={() => confirmPick(line.id)}>
                          <ScanLine size={14} /> Confirmar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {progress === 100 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', animation: 'slideUp var(--transition-slow) ease-out' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🎉</div>
                  <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--success)', marginBottom: 'var(--space-2)' }}>
                    Picking Completado
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                    Enviando a consolidación para despacho.
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}
                    onClick={completeOrderPicking} disabled={!!submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
                    {submitting ? 'Actualizando...' : 'Enviar a Consolidación'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>📋</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-base)' }}>
                Selecciona un pedido de la lista para iniciar el picking
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
