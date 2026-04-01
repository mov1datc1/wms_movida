import { useState, useEffect } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  Route, Search, ArrowRight, ArrowLeft, Package,
  MapPin, Truck, Loader2, Wifi, History, User
} from 'lucide-react';

import { API } from '../config/api';

interface Lot {
  id: string;
  lote: string;
  skuId: string;
  fechaVencimiento: string | null;
  fechaProduccion: string | null;
  cantidadDisponible: number;
  estadoCalidad: string;
  proveedorNombre: string;
  ubicacion: { codigo: string; zona: string } | null;
  sku: { codigoDynamics: string; descripcion: string };
}

interface Movement {
  id: string;
  tipoMovimiento: string;
  cantidad: number;
  usuario: string;
  motivo: string;
  fechaHora: string;
  sku: { codigoDynamics: string; descripcion: string };
  fromLocation: { codigo: string; zona: string } | null;
  toLocation: { codigo: string; zona: string } | null;
  almacen: { codigo: string; nombre: string } | null;
  lote: { lote: string } | null;
}

interface AuditEntry {
  id: string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalle: string;
  createdAt: string;
}

interface Restaurante {
  id: string;
  nombre: string;
  zona: string;
}

type TraceTab = 'forward' | 'backward' | 'audit';

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const AUDIT_COLORS: Record<string, string> = {
  RECEPCION: 'var(--success)',
  TRASIEGO: 'var(--warning)',
  TRANSFERENCIA: 'var(--info)',
  DESPACHO: 'var(--accent-secondary)',
  CREAR_SKU: 'var(--accent-primary)',
  AJUSTE: 'var(--danger)',
};

export function Traceability() {
  const [tab, setTab] = useState<TraceTab>('forward');
  const [lots, setLots] = useState<Lot[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLote, setSearchLote] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [selectedRestaurante, setSelectedRestaurante] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const { selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    async function load() {
      try {
        const whParam = selectedWarehouseId ? `almacenId=${selectedWarehouseId}` : '';
        const [lotRes, movRes, auditRes, restRes] = await Promise.all([
          fetch(`${API}/lots?${whParam}`),
          fetch(`${API}/movements?limit=100&${whParam}`),
          fetch(`${API}/audit-log?limit=100`),
          fetch(`${API}/restaurantes`),
        ]);
        setLots(await lotRes.json());
        setMovements(await movRes.json());
        setAuditLog(await auditRes.json());
        setRestaurantes(await restRes.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [selectedWarehouseId]);

  const filteredLots = lots.filter(l =>
    l.lote.toLowerCase().includes(searchLote.toLowerCase()) ||
    l.sku.descripcion.toLowerCase().includes(searchLote.toLowerCase())
  );

  const selectedLotData = lots.find(l => l.lote === selectedLot);
  const lotMovements = selectedLot
    ? movements.filter(m => m.lote?.lote === selectedLot)
    : [];

  const filteredAudit = auditFilter
    ? auditLog.filter(a => a.usuario.toLowerCase().includes(auditFilter.toLowerCase()) || a.accion.toLowerCase().includes(auditFilter.toLowerCase()))
    : auditLog;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando trazabilidad desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Trazabilidad y Auditoría</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Rastreo completo punta a punta — historial auditable por usuario, fecha y acción
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'forward' ? 'active' : ''}`}
          onClick={() => { setTab('forward'); setSelectedLot(null); }}>
          <ArrowRight size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Forward (Lote → Destino)
        </button>
        <button className={`tab ${tab === 'backward' ? 'active' : ''}`}
          onClick={() => { setTab('backward'); setSelectedLot(null); }}>
          <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Backward (Restaurante → Lotes)
        </button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}>
          <History size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Log de Auditoría ({auditLog.length})
        </button>
      </div>

      {tab === 'forward' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 'var(--space-6)' }}>
          <div className="glass-card animate-slide-up" style={{ overflow: 'hidden' }}>
            <div className="data-table-header">
              <div className="data-table-title">🔎 Seleccionar Lote ({lots.length})</div>
            </div>
            <div style={{ padding: 'var(--space-4)' }}>
              <div className="table-search" style={{ width: '100%' }}>
                <Search size={15} style={{ color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Buscar por lote o SKU..."
                  value={searchLote} onChange={e => setSearchLote(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
            {filteredLots.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                Sin lotes para rastrear.
              </div>
            ) : (
              filteredLots.map(lot => (
                <div key={lot.id} className="alert-item"
                  style={{
                    cursor: 'pointer',
                    background: selectedLot === lot.lote ? 'var(--accent-primary-soft)' : undefined,
                    borderLeft: selectedLot === lot.lote ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  }}
                  onClick={() => setSelectedLot(lot.lote)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <code style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>{lot.lote}</code>
                      <span className={`badge badge-${lot.estadoCalidad.toLowerCase()}`}>{lot.estadoCalidad}</span>
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {lot.sku.descripcion} · {lot.cantidadDisponible} UN
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            {selectedLotData ? (
              <div className="animate-slide-left">
                <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Route size={28} style={{ color: 'white' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800 }}>Trazabilidad: {selectedLotData.lote}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{selectedLotData.sku.descripcion}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)',
                    padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Proveedor</div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{selectedLotData.proveedorNombre || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Producción</div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{formatDate(selectedLotData.fechaProduccion)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Vencimiento</div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{formatDate(selectedLotData.fechaVencimiento)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Ubicación Actual</div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                        <code style={{ color: 'var(--accent-primary)' }}>{selectedLotData.ubicacion?.codigo || '—'}</code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Movement Trail */}
                <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                  <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
                    📍 Historial de Movimientos ({lotMovements.length})
                  </div>

                  {lotMovements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                      Sin movimientos registrados para este lote.
                    </div>
                  ) : (
                    <div style={{ position: 'relative', paddingLeft: 'var(--space-8)' }}>
                      {lotMovements.map((mov) => {
                        const isEntry = mov.tipoMovimiento === 'ENTRADA';
                        const isExit = mov.tipoMovimiento === 'SALIDA';
                        const isTransfer = mov.tipoMovimiento === 'TRASIEGO' || mov.tipoMovimiento === 'TRANSFERENCIA';
                        return (
                          <div key={mov.id} className="timeline-item">
                            <div className="timeline-dot" style={{
                              background: isEntry ? 'var(--success-soft)' : isExit ? 'var(--info-soft)' : isTransfer ? 'var(--warning-soft)' : 'var(--danger-soft)',
                              color: isEntry ? 'var(--success)' : isExit ? 'var(--info)' : isTransfer ? 'var(--warning)' : 'var(--danger)',
                            }}>
                              {isEntry ? <Package size={14} /> : isExit ? <Truck size={14} /> : <MapPin size={14} />}
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-title">{mov.tipoMovimiento}</div>
                              <div className="timeline-desc">
                                {mov.fromLocation?.codigo || 'Externo'} → {mov.toLocation?.codigo || 'Externo'} · {mov.cantidad} UN
                              </div>
                              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <User size={10} /> <strong>{mov.usuario}</strong> · {formatDateTime(mov.fechaHora)}
                                {mov.motivo && <span> · {mov.motivo}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>🔍</div>
                <div style={{ color: 'var(--text-muted)' }}>Selecciona un lote para ver su cadena de trazabilidad</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'backward' && (
        <div>
          <div className="filter-bar">
            <select className="form-select" value={selectedRestaurante}
              onChange={e => setSelectedRestaurante(e.target.value)}>
              <option value="">Seleccionar restaurante...</option>
              {restaurantes.map(r => (
                <option key={r.id} value={r.id}>{r.nombre} — {r.zona}</option>
              ))}
            </select>
          </div>

          {selectedRestaurante ? (
            <div className="glass-card animate-slide-up" style={{ overflow: 'hidden' }}>
              <div className="data-table-header">
                <div className="data-table-title">
                  Movimientos hacia {restaurantes.find(r => r.id === selectedRestaurante)?.nombre}
                </div>
              </div>
              <div className="data-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>SKU</th>
                      <th>Lote</th>
                      <th>Cantidad</th>
                      <th>Desde</th>
                      <th>Hacia</th>
                      <th>Usuario</th>
                      <th>Fecha/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.filter(m => m.tipoMovimiento === 'SALIDA').map(m => (
                      <tr key={m.id}>
                        <td><span className="badge badge-info">{m.tipoMovimiento}</span></td>
                        <td style={{ fontWeight: 600 }}>{m.sku.descripcion}</td>
                        <td><code>{m.lote?.lote || '—'}</code></td>
                        <td style={{ fontWeight: 600 }}>{m.cantidad}</td>
                        <td><code style={{ color: 'var(--accent-primary)' }}>{m.fromLocation?.codigo || '—'}</code></td>
                        <td>{m.toLocation?.codigo || 'Restaurante'}</td>
                        <td>{m.usuario}</td>
                        <td style={{ fontSize: 'var(--font-xs)' }}>{formatDateTime(m.fechaHora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>🏪</div>
              <div style={{ color: 'var(--text-muted)' }}>Selecciona un restaurante para ver sus lotes recibidos</div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <div className="filter-bar">
            <div className="table-search">
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Filtrar por usuario o acción..."
                value={auditFilter} onChange={e => setAuditFilter(e.target.value)} />
            </div>
          </div>

          <div className="data-table-wrapper glass-card animate-slide-up">
            <div className="data-table-header">
              <div className="data-table-title">
                <History size={16} style={{ verticalAlign: -3, marginRight: 8 }} />
                Historial de Auditoría — Quién hizo qué, cuándo
              </div>
              <span className="badge badge-liberado">{filteredAudit.length} registros</span>
            </div>
            {filteredAudit.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                Sin registros de auditoría aún.
              </div>
            ) : (
              <div className="data-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Entidad</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map(entry => (
                      <tr key={entry.id}>
                        <td style={{ fontSize: 'var(--font-xs)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-primary-soft)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                              color: 'var(--accent-primary)' }}>
                              {entry.usuario.charAt(0)}
                            </div>
                            {entry.usuario}
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: `${AUDIT_COLORS[entry.accion] || 'var(--text-muted)'}15`,
                            color: AUDIT_COLORS[entry.accion] || 'var(--text-muted)',
                          }}>
                            {entry.accion}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{entry.entidad}</td>
                        <td style={{ fontSize: 'var(--font-xs)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.detalle || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
