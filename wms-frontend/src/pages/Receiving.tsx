import { useState, useEffect, useMemo } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  ArrowDownToLine, CheckCircle2, Package,
  AlertCircle, Loader2, Wifi, Search,
  ClipboardList, Truck, ChevronRight, ChevronDown
} from 'lucide-react';

import { API } from '../config/api';
import { TableActions } from '../components/TableActions';

interface Location {
  id: string;
  codigo: string;
  zona: string;
  pasillo: string;
  tipoUbicacion: string;
  temperatura: string;
  capacidad: number;
  ocupacion: number;
  estado: string;
  almacenId?: string;
}

interface InboundOrderLine {
  id: string;
  skuId: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estado: string;
  loteAsignado?: string;
  sku: { codigoDynamics: string; descripcion: string; categoria: string; temperaturaRequerida: string; uomBase: string };
}

interface InboundOrder {
  id: string;
  numeroDynamics: string;
  proveedorNombre: string;
  fechaOrden: string;
  fechaEsperada?: string;
  estado: string;
  lineas: InboundOrderLine[];
}

interface Movement {
  id: string;
  tipoMovimiento: string;
  cantidad: number;
  usuario: string;
  motivo: string;
  fechaHora: string;
  sku?: { codigoDynamics: string; descripcion: string };
  toLocation?: { codigo: string } | null;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusColor(estado: string) {
  switch (estado) {
    case 'PENDIENTE': return { bg: 'rgba(234,179,8,0.12)', color: '#CA8A04', label: 'Pendiente' };
    case 'PARCIAL': return { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', label: 'Parcial' };
    case 'COMPLETO':
    case 'RECIBIDO': return { bg: 'rgba(34,197,94,0.12)', color: '#16A34A', label: estado === 'RECIBIDO' ? 'Recibido' : 'Completo' };
    case 'CERRADO': return { bg: 'rgba(100,116,139,0.12)', color: '#64748B', label: 'Cerrado' };
    default: return { bg: 'rgba(100,116,139,0.12)', color: '#64748B', label: estado };
  }
}

export function Receiving() {
  const [activeTab, setActiveTab] = useState<'orders' | 'receive'>('orders');
  const [inboundOrders, setInboundOrders] = useState<InboundOrder[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedWarehouseId } = useWarehouse();


  // Filters
  const [searchPO, setSearchPO] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  // Selected order for receiving
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  // Receive form
  const [receiveForm, setReceiveForm] = useState({
    lote: '',
    fechaVencimiento: '',
    cantidad: '',
    tipoHu: 'PALLET',
    ubicacionId: '',
    notas: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId]);

  async function loadData() {
    try {
      const whParam = selectedWarehouseId ? `?almacenId=${selectedWarehouseId}` : '';
      const [ioRes, locRes, movRes] = await Promise.all([
        fetch(`${API}/inbound-orders`),
        fetch(`${API}/locations${whParam}`),
        fetch(`${API}/movements?tipo=ENTRADA&limit=15${selectedWarehouseId ? `&almacenId=${selectedWarehouseId}` : ''}`),
      ]);
      setInboundOrders(await ioRes.json());
      setLocationList(await locRes.json());
      setRecentMovements(await movRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  const selectedOrder = inboundOrders.find(o => o.id === selectedOrderId);

  // Smart location suggestion
  const suggestLocation = (tempReq: string): Location | null => {
    return locationList
      .filter(loc => loc.temperatura === tempReq && loc.ocupacion < loc.capacidad && loc.estado !== 'BLOQUEADO' && loc.tipoUbicacion !== 'STAGING')
      .sort((a, b) => {
        if (a.tipoUbicacion === 'PICKING' && b.tipoUbicacion !== 'PICKING') return -1;
        return (a.ocupacion / a.capacidad) - (b.ocupacion / b.capacidad);
      })[0] || null;
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return inboundOrders.filter(o => {
      if (searchPO && !o.numeroDynamics.toLowerCase().includes(searchPO.toLowerCase()) && !o.proveedorNombre.toLowerCase().includes(searchPO.toLowerCase())) return false;
      if (filterEstado && o.estado !== filterEstado) return false;
      return true;
    });
  }, [inboundOrders, searchPO, filterEstado]);

  const handleReceiveLine = async (line: InboundOrderLine) => {
    if (!receiveForm.lote || !receiveForm.cantidad) {
      setError('Lote y cantidad son obligatorios');
      return;
    }

    const qty = parseFloat(receiveForm.cantidad);
    const remaining = line.cantidadEsperada - line.cantidadRecibida;
    if (qty > remaining) {
      setError(`Cantidad máxima a recibir: ${remaining}`);
      return;
    }

    setSubmitting(true);
    setError(null);

    // Find best location
    const sugLoc = receiveForm.ubicacionId
      ? locationList.find(l => l.id === receiveForm.ubicacionId)
      : suggestLocation(line.sku.temperaturaRequerida);

    const locationId = sugLoc?.id || locationList[0]?.id;
    const almacenId = (locationList.find(l => l.id === locationId) as any)?.almacenId || selectedWarehouseId;

    try {
      const res = await fetch(`${API}/reception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: line.skuId,
          lote: receiveForm.lote,
          fechaVencimiento: receiveForm.fechaVencimiento || undefined,
          cantidad: qty,
          proveedor: selectedOrder?.proveedorNombre || 'BC Vendor',
          tipoHu: receiveForm.tipoHu,
          ubicacionId: locationId,
          almacenId,
          usuario: 'SuperAdmin',
          notas: receiveForm.notas || `Recepción OC #${selectedOrder?.numeroDynamics}`,
          inboundOrderLineId: line.id,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Error al registrar');
      const result = await res.json();

      setShowSuccess(`✅ Recibido: ${line.sku.descripcion} × ${qty} — Lote: ${receiveForm.lote}, HU: ${result.handlingUnit.codigo}, Ubicación: ${sugLoc?.codigo || '?'}`);
      setReceiveForm({ lote: '', fechaVencimiento: '', cantidad: '', tipoHu: 'PALLET', ubicacionId: '', notas: '' });
      setExpandedLine(null);
      setTimeout(() => setShowSuccess(null), 5000);

      // Reload data
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const pendingCount = inboundOrders.filter(o => o.estado === 'PENDIENTE').length;
  const partialCount = inboundOrders.filter(o => o.estado === 'PARCIAL').length;
  const receivedCount = inboundOrders.filter(o => o.estado === 'RECIBIDO').length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando órdenes de compra...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Recepción de Mercadería</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Órdenes de compra de Dynamics 365 — Recepción parcial/completa con putaway inteligente
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      {showSuccess && (
        <div style={{
          background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-6)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', animation: 'slideDown var(--transition-slow) ease-out',
        }}>
          <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 'var(--font-sm)' }}>{showSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        }}>
          <AlertCircle size={16} color="#DC2626" />
          <span style={{ color: '#DC2626', fontSize: 'var(--font-sm)', flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
          <div className="stat-card-label">OC Pendientes</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>{partialCount}</div>
          <div className="stat-card-label">Recepción Parcial</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{receivedCount}</div>
          <div className="stat-card-label">Recibidas</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value">{inboundOrders.length}</div>
          <div className="stat-card-label">Total OC</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('orders')}>
          <ClipboardList size={16} /> Órdenes de Compra
        </button>
        <button className={`btn ${activeTab === 'receive' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('receive')}>
          <ArrowDownToLine size={16} /> Historial Recepciones
        </button>
      </div>

      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 'var(--space-6)' }}>
          {/* Orders List */}
          <div className="glass-card animate-slide-up" style={{ overflow: 'hidden' }}>
            {/* Filters */}
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" className="form-input" placeholder="Buscar OC #, proveedor..."
                    value={searchPO} onChange={e => setSearchPO(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: 'var(--font-xs)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {['', 'PENDIENTE', 'PARCIAL', 'RECIBIDO'].map(est => (
                  <button key={est} className={`btn btn-sm ${filterEstado === est ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setFilterEstado(est)} style={{ fontSize: 10, padding: '3px 8px' }}>
                    {est || 'Todos'} {est === 'PENDIENTE' && `(${pendingCount})`}{est === 'PARCIAL' && `(${partialCount})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="data-table-header">
              <div className="data-table-title">📦 OC de BC ({filteredOrders.length})</div>
            </div>

            {filteredOrders.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                <Truck size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
                <div>Sin órdenes de compra.</div>
                <div style={{ fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)' }}>
                  Sincroniza desde el módulo Sync Dynamics.
                </div>
              </div>
            ) : (
              filteredOrders.map(order => {
                const status = getStatusColor(order.estado);
                const totalLines = order.lineas.length;
                const completedLines = order.lineas.filter(l => l.estado === 'COMPLETO').length;
                return (
                  <div key={order.id} className="alert-item"
                    style={{
                      cursor: 'pointer',
                      background: selectedOrderId === order.id ? 'var(--accent-primary-soft)' : undefined,
                      borderLeft: selectedOrderId === order.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    }}
                    onClick={() => { setSelectedOrderId(order.id); setExpandedLine(null); }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          OC #{order.numeroDynamics}
                        </span>
                        <span style={{
                          padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 600,
                          background: status.bg, color: status.color,
                        }}>{status.label}</span>
                      </div>
                      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                        {order.proveedorNombre}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {totalLines} líneas · {completedLines}/{totalLines} recibidas · Fecha: {formatDate(order.fechaOrden)}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                );
              })
            )}
          </div>

          {/* Order Detail + Receiving */}
          <div>
            {selectedOrder ? (
              <div className="animate-slide-left">
                {/* Order Header */}
                <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
                        OC #{selectedOrder.numeroDynamics}
                      </div>
                      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                        <Truck size={14} style={{ display: 'inline', marginRight: 4 }} />
                        {selectedOrder.proveedorNombre} · Fecha: {formatDate(selectedOrder.fechaOrden)}
                        {selectedOrder.fechaEsperada && ` · Entrega esperada: ${formatDate(selectedOrder.fechaEsperada)}`}
                      </div>
                    </div>
                    <span style={{
                      ...(() => { const s = getStatusColor(selectedOrder.estado); return { background: s.bg, color: s.color }; })(),
                      padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)', fontWeight: 700,
                    }}>{getStatusColor(selectedOrder.estado).label}</span>
                  </div>

                  {/* Progress bar */}
                  {(() => {
                    const totalQty = selectedOrder.lineas.reduce((s, l) => s + l.cantidadEsperada, 0);
                    const recvQty = selectedOrder.lineas.reduce((s, l) => s + l.cantidadRecibida, 0);
                    const pct = totalQty > 0 ? (recvQty / totalQty) * 100 : 0;
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>Progreso de recepción</span>
                          <span style={{ fontWeight: 600 }}>{recvQty}/{totalQty} UN ({Math.round(pct)}%)</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : undefined }}></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Lines */}
                {selectedOrder.lineas.map(line => {
                  const remaining = line.cantidadEsperada - line.cantidadRecibida;
                  const isComplete = remaining <= 0;
                  const isExpanded = expandedLine === line.id;
                  const sugLoc = suggestLocation(line.sku.temperaturaRequerida);
                  const lineStatus = getStatusColor(line.estado);

                  return (
                    <div key={line.id} className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          {isComplete ? (
                            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                          ) : (
                            <Package size={20} style={{ color: 'var(--accent-primary)' }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>
                              {line.sku.descripcion}
                            </div>
                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                              {line.sku.codigoDynamics} · {line.sku.categoria} · {line.sku.temperaturaRequerida}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                              {line.cantidadRecibida}/{line.cantidadEsperada} {line.sku.uomBase}
                            </div>
                            <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 600, background: lineStatus.bg, color: lineStatus.color }}>
                              {lineStatus.label}
                            </span>
                          </div>
                          {!isComplete && (
                            <button className="btn btn-primary btn-sm"
                              onClick={() => { setExpandedLine(isExpanded ? null : line.id); setReceiveForm(f => ({ ...f, cantidad: String(remaining) })); }}>
                              <ArrowDownToLine size={14} /> Recibir
                              <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Receive Form (expanded) */}
                      {isExpanded && !isComplete && (
                        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', animation: 'slideDown 200ms ease-out' }}>
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                            💡 Pendiente: <strong>{remaining} {line.sku.uomBase}</strong> · Ubicación sugerida: <code style={{ color: 'var(--accent-primary)' }}>{sugLoc?.codigo || 'RECIBO-01'}</code>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Lote *</label>
                              <input type="text" className="form-input" placeholder="Ej: L260401-A"
                                value={receiveForm.lote} onChange={e => setReceiveForm(f => ({ ...f, lote: e.target.value }))}
                                style={{ fontSize: 'var(--font-xs)' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Cantidad ({line.sku.uomBase}) *</label>
                              <input type="number" className="form-input" placeholder="0" min="1" max={remaining}
                                value={receiveForm.cantidad} onChange={e => setReceiveForm(f => ({ ...f, cantidad: e.target.value }))}
                                style={{ fontSize: 'var(--font-xs)' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Vencimiento</label>
                              <input type="date" className="form-input"
                                value={receiveForm.fechaVencimiento} onChange={e => setReceiveForm(f => ({ ...f, fechaVencimiento: e.target.value }))}
                                style={{ fontSize: 'var(--font-xs)' }} />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Tipo HU</label>
                              <select className="form-select" value={receiveForm.tipoHu}
                                onChange={e => setReceiveForm(f => ({ ...f, tipoHu: e.target.value }))} style={{ fontSize: 'var(--font-xs)' }}>
                                <option value="PALLET">📦 Pallet</option>
                                <option value="CAJA">📋 Caja</option>
                                <option value="BANDEJA">🗂️ Bandeja</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Ubicación</label>
                              <select className="form-select" value={receiveForm.ubicacionId}
                                onChange={e => setReceiveForm(f => ({ ...f, ubicacionId: e.target.value }))} style={{ fontSize: 'var(--font-xs)' }}>
                                <option value="">💡 Auto ({sugLoc?.codigo || 'RECIBO'})</option>
                                {locationList.filter(l => l.estado !== 'BLOQUEADO').map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.codigo} · {loc.zona} · {Math.round((loc.ocupacion / loc.capacidad) * 100)}%</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>Notas</label>
                              <input type="text" className="form-input" placeholder="Observaciones..."
                                value={receiveForm.notas} onChange={e => setReceiveForm(f => ({ ...f, notas: e.target.value }))}
                                style={{ fontSize: 'var(--font-xs)' }} />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button className="btn btn-primary" onClick={() => handleReceiveLine(line)} disabled={submitting}
                              style={{ flex: 1 }}>
                              {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                              {submitting ? 'Guardando...' : `Confirmar Recepción (${receiveForm.cantidad || 0} ${line.sku.uomBase})`}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setExpandedLine(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}

                      {/* Show assigned lot/location if received */}
                      {line.loteAsignado && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', paddingLeft: 32 }}>
                          <span>Lote: <strong style={{ color: 'var(--text-secondary)' }}>{line.loteAsignado}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>📦</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-base)' }}>
                  Selecciona una OC de la lista para iniciar la recepción
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)' }}>
                  Las órdenes de compra se sincronizan desde Business Central
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'receive' && (
        <div className="glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">📥 Últimas Recepciones</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <TableActions
                data={recentMovements}
                columns={[
                  { key: 'sku', label: 'Producto', format: (_, row) => row.sku?.descripcion || 'SKU' },
                  { key: 'cantidad', label: 'Cantidad', format: (v) => `${v} UN` },
                  { key: 'toLocation', label: 'Ubicación', format: (_, row) => row.toLocation?.codigo || '—' },
                  { key: 'usuario', label: 'Usuario' },
                  { key: 'fechaHora', label: 'Fecha/Hora', format: (v) => new Date(v).toLocaleString('es-GT') },
                  { key: 'motivo', label: 'Motivo' },
                ]}
                title="Historial de Recepciones"
                filename="recepciones_wms"
              />
              <span className="badge badge-liberado">{recentMovements.length} registros</span>
            </div>
          </div>
          <div className="data-table-wrapper">
            <div className="data-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Ubicación</th>
                    <th>Usuario</th>
                    <th>Fecha/Hora</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{entry.sku?.descripcion || 'SKU'}</td>
                      <td><strong>{entry.cantidad}</strong> UN</td>
                      <td><code style={{ color: 'var(--accent-primary)', fontSize: 'var(--font-xs)' }}>{entry.toLocation?.codigo || '—'}</code></td>
                      <td>{entry.usuario}</td>
                      <td style={{ fontSize: 'var(--font-xs)' }}>{new Date(entry.fechaHora).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{entry.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
