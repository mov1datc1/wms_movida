import { useState, useEffect, useRef } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  Truck, CheckCircle2, FileText,
  ChevronDown, Loader2, Wifi, PenLine, MapPin, ArrowRight
} from 'lucide-react';

import { API } from '../config/api';

interface Order {
  id: string;
  restauranteId: string;
  prioridad: number;
  fechaCompromiso: string;
  estado: string;
  origenDynamics?: string;
  despachador?: string;
  fechaDespacho?: string;
  vehiculoPlaca?: string;
  estadoEntrega?: string;
  fechaEntrega?: string;
  firmaReceptor?: string;
  nombreReceptor?: string;
  notasEntrega?: string;
  restaurante: { nombre: string; zona: string };
  lineas: { id: string; cantidadSolicitada: number; cantidadAsignada: number; sku: { codigoDynamics: string; descripcion: string } }[];
  trackingEvents?: { id: string; estado: string; usuario: string; notas?: string; createdAt: string; nombreFirmante?: string }[];
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const DELIVERY_STATES = [
  { key: 'EN_RUTA', label: 'En Ruta', icon: '🚛', color: 'var(--info)' },
  { key: 'LLEGADA', label: 'Llegada al Destino', icon: '📍', color: 'var(--warning)' },
  { key: 'ENTREGADO', label: 'Entregado', icon: '✅', color: 'var(--success)' },
  { key: 'RECHAZADO', label: 'Rechazado', icon: '❌', color: 'var(--danger)' },
];

export function Dispatch() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ despachador: '', vehiculoPlaca: '' });
  const [trackingModal, setTrackingModal] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState('');
  const [trackingNotes, setTrackingNotes] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const { selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    loadOrders();
  }, [selectedWarehouseId]);

  async function loadOrders() {
    try {
      const res = await fetch(`${API}/orders`);
      setOrders(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  const consolidatedOrders = orders.filter(o => o.estado === 'CONSOLIDADO');
  const dispatchedOrders = orders.filter(o => ['DESPACHADO', 'EN_RUTA'].includes(o.estado) || o.estadoEntrega === 'EN_RUTA');
  const deliveredOrders = orders.filter(o => o.estado === 'ENTREGADO');

  const handleDispatch = async (orderId: string) => {
    if (!dispatchForm.despachador) return;
    try {
      await fetch(`${API}/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchForm),
      });
      await loadOrders();
      setDispatchingId(null);
      setDispatchForm({ despachador: '', vehiculoPlaca: '' });
    } catch { /* ignore */ }
  };

  const handleTrackingUpdate = async (orderId: string) => {
    if (!trackingState) return;
    const body: any = { estado: trackingState, usuario: 'Despachador', notas: trackingNotes };
    if (trackingState === 'ENTREGADO') {
      body.firmaBase64 = signatureData;
      body.nombreFirmante = signatureName;
    }
    try {
      await fetch(`${API}/orders/${orderId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await loadOrders();
      setTrackingModal(null);
      setTrackingState('');
      setTrackingNotes('');
      setSignatureName('');
      setSignatureData('');
    } catch { /* ignore */ }
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando despachos...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Despacho a Restaurantes</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Consolidación, despacho y seguimiento de entrega hasta firma del receptor
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-value" style={{ color: 'var(--accent-secondary)' }}>{consolidatedOrders.length}</div>
          <div className="stat-card-label">Listos para Despacho</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value" style={{ color: 'var(--info)' }}>{dispatchedOrders.length}</div>
          <div className="stat-card-label">En Ruta</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{deliveredOrders.length}</div>
          <div className="stat-card-label">Entregados</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value">{orders.length}</div>
          <div className="stat-card-label">Total Órdenes</div>
        </div>
      </div>

      {/* Ready for Dispatch */}
      {consolidatedOrders.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🚛 Listos para Despachar</h2>
          {consolidatedOrders.map(order => (
            <div key={order.id} className="glass-card animate-slide-up" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-secondary-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={24} style={{ color: 'var(--accent-secondary)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{order.restaurante.nombre}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      {order.lineas.length} líneas · Compromiso: {formatDate(order.fechaCompromiso)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <FileText size={14} /> Detalle <ChevronDown size={14} />
                  </button>
                  <button className="btn btn-primary" onClick={() => setDispatchingId(order.id)}>
                    <Truck size={16} /> Despachar
                  </button>
                </div>
              </div>

              {/* Dispatch form */}
              {dispatchingId === order.id && (
                <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border-subtle)',
                  display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', animation: 'slideDown 200ms ease-out' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Despachador</label>
                    <input type="text" className="form-input" placeholder="Nombre del despachador"
                      value={dispatchForm.despachador} onChange={e => setDispatchForm(f => ({ ...f, despachador: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Placa del Vehículo</label>
                    <input type="text" className="form-input" placeholder="P-123ABC"
                      value={dispatchForm.vehiculoPlaca} onChange={e => setDispatchForm(f => ({ ...f, vehiculoPlaca: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary" onClick={() => handleDispatch(order.id)} disabled={!dispatchForm.despachador}>
                    <CheckCircle2 size={16} /> Confirmar Despacho
                  </button>
                </div>
              )}

              {expandedOrder === order.id && (
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)',
                  animation: 'slideDown var(--transition-base) ease-out' }}>
                  {order.lineas.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0',
                      fontSize: 'var(--font-sm)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span>{l.sku.descripcion}</span>
                      <span style={{ fontWeight: 600 }}>{l.cantidadSolicitada} UN</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* En Ruta (Dispatched) — Despachador can update */}
      {dispatchedOrders.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🚚 En Ruta — Seguimiento de Entrega</h2>
          {dispatchedOrders.map(order => (
            <div key={order.id} className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{order.restaurante.nombre}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    Despachador: {order.despachador || '—'} · Vehículo: {order.vehiculoPlaca || '—'} · Salida: {order.fechaDespacho ? formatDateTime(order.fechaDespacho) : '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span className="badge" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                    {order.estadoEntrega || 'EN_RUTA'}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={() => setTrackingModal(order.id)}>
                    <MapPin size={14} /> Actualizar Estado
                  </button>
                </div>
              </div>

              {/* Tracking Timeline */}
              {order.trackingEvents && order.trackingEvents.length > 0 && (
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                  {order.trackingEvents.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-2) 0', fontSize: 'var(--font-xs)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%',
                        background: ev.estado === 'ENTREGADO' ? 'var(--success)' : ev.estado === 'RECHAZADO' ? 'var(--danger)' : 'var(--info)' }} />
                      <span style={{ fontWeight: 600 }}>{ev.estado}</span>
                      <span style={{ color: 'var(--text-muted)' }}>por {ev.usuario}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDateTime(ev.createdAt)}</span>
                      {ev.nombreFirmante && <span style={{ color: 'var(--success)', fontWeight: 600 }}>✍️ {ev.nombreFirmante}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delivered */}
      {deliveredOrders.length > 0 && (
        <div>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>✅ Entregados</h2>
          <div className="data-table-wrapper glass-card animate-slide-up">
            <div className="data-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Restaurante</th>
                    <th>Despachador</th>
                    <th>Salida</th>
                    <th>Entrega</th>
                    <th>Receptor</th>
                    <th>Firma</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveredOrders.map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600 }}>{order.restaurante.nombre}</td>
                      <td>{order.despachador || '—'}</td>
                      <td>{order.fechaDespacho ? formatDateTime(order.fechaDespacho) : '—'}</td>
                      <td>{order.fechaEntrega ? formatDateTime(order.fechaEntrega) : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{order.nombreReceptor || '—'}</td>
                      <td>{order.firmaReceptor ? '✅ Firmado' : '—'}</td>
                      <td><span className="badge badge-liberado">ENTREGADO</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Truck size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Sin órdenes de despacho</div>
          <div style={{ fontSize: 'var(--font-sm)' }}>Las órdenes aparecerán aquí cuando se completen desde Picking.</div>
        </div>
      )}

      {/* Tracking Update Modal */}
      {trackingModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'fadeIn 200ms ease-out',
        }}>
          <div className="glass-card" style={{ width: 520, maxHeight: '90vh', overflow: 'auto',
            padding: 'var(--space-6)', animation: 'slideUp 300ms ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <MapPin size={20} style={{ color: 'var(--accent-primary)' }} />
                Actualizar Entrega
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setTrackingModal(null)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Estado de Entrega</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {DELIVERY_STATES.map(ds => (
                  <button key={ds.key} className={`btn ${trackingState === ds.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setTrackingState(ds.key)} style={{ flex: 1 }}>
                    {ds.icon} {ds.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <input type="text" className="form-input" placeholder="Observaciones del despachador..."
                value={trackingNotes} onChange={e => setTrackingNotes(e.target.value)} />
            </div>

            {/* Signature Section (only for ENTREGADO) */}
            {trackingState === 'ENTREGADO' && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <PenLine size={16} style={{ color: 'var(--accent-primary)' }} />
                  Firma del Receptor
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre Completo del Receptor</label>
                  <input type="text" className="form-input" placeholder="Nombre de quien recibe"
                    value={signatureName} onChange={e => setSignatureName(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Firma (dibujar abajo)</label>
                  <div style={{ border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-md)',
                    background: 'white', position: 'relative' }}>
                    <canvas ref={canvasRef} width={460} height={150}
                      onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                      style={{ cursor: 'crosshair', display: 'block', width: '100%' }} />
                    {!signatureData && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        color: 'var(--text-muted)', fontSize: 'var(--font-sm)', pointerEvents: 'none' }}>
                        Dibuje la firma aquí
                      </div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={clearSignature} style={{ marginTop: 'var(--space-2)' }}>
                    Limpiar firma
                  </button>
                </div>

                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  📅 Fecha de entrega: {new Date().toLocaleString('es-GT')}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <button className="btn btn-ghost" onClick={() => setTrackingModal(null)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => handleTrackingUpdate(trackingModal)}
                disabled={!trackingState || (trackingState === 'ENTREGADO' && !signatureName)}>
                <ArrowRight size={16} /> Confirmar {trackingState === 'ENTREGADO' ? 'Entrega' : 'Estado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
