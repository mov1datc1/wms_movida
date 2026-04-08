import { useState, useEffect } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  ClipboardCheck, Plus, Play, CheckCircle2, AlertTriangle,
  Loader2, Wifi, ScanLine, Hash, X
} from 'lucide-react';
import { API } from '../config/api';
import { TableActions } from '../components/TableActions';

interface CycleCountLine {
  id: string;
  skuId: string;
  ubicacionId?: string;
  lote?: string;
  cantidadSistema: number;
  cantidadFisica?: number;
  discrepancia?: number;
  porcentajeDisc?: number;
  estado: string;
  contadoPor?: string;
  contadoEn?: string;
  notas?: string;
  sku: { codigoDynamics: string; descripcion: string; categoria: string; uomBase?: string };
}

interface CycleCount {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  clasificacion: string;
  estado: string;
  fechaProgramada: string;
  fechaInicio?: string;
  fechaCierre?: string;
  asignadoA?: string;
  lineas: CycleCountLine[];
}

function statusStyle(estado: string) {
  switch (estado) {
    case 'PROGRAMADO': return { bg: 'rgba(234,179,8,0.12)', color: '#CA8A04' };
    case 'EN_PROGRESO': return { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' };
    case 'COMPLETADO': return { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6' };
    case 'CERRADO': return { bg: 'rgba(34,197,94,0.12)', color: '#16A34A' };
    default: return { bg: 'rgba(100,116,139,0.12)', color: '#64748B' };
  }
}

export function CycleCountPage() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countingLine, setCountingLine] = useState<string | null>(null);
  const [countValue, setCountValue] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const { selectedWarehouseId } = useWarehouse();

  const [createForm, setCreateForm] = useState({
    nombre: '', tipo: 'SKU', clasificacion: 'A',
    fechaProgramada: new Date().toISOString().slice(0, 10),
    asignadoA: '', notas: '',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await fetch(`${API}/cycle-counts`);
      setCounts(await res.json());
    } catch { /* */ }
    setLoading(false);
  }

  const selected = counts.find(c => c.id === selectedId);

  const handleCreate = async () => {
    if (!createForm.nombre) { setError('Nombre requerido'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/cycle-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, almacenId: selectedWarehouseId, usuario: 'SuperAdmin' }),
      });
      if (!res.ok) throw new Error('Error al crear');
      setSuccess('✅ Conteo cíclico creado');
      setShowCreate(false);
      setCreateForm({ nombre: '', tipo: 'SKU', clasificacion: 'A', fechaProgramada: new Date().toISOString().slice(0, 10), asignadoA: '', notas: '' });
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  };

  const handleStart = async (id: string) => {
    await fetch(`${API}/cycle-counts/${id}/start`, { method: 'PUT' });
    await loadData();
    setSuccess('🚀 Conteo iniciado');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleRecordCount = async (countId: string, lineId: string) => {
    if (!countValue) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/cycle-counts/${countId}/lines/${lineId}/count`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidadFisica: parseFloat(countValue), contadoPor: 'SuperAdmin' }),
      });
      setCountingLine(null);
      setCountValue('');
      setScanInput('');
      await loadData();
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  };

  const handleClose = async (id: string, aplicarAjustes: boolean) => {
    setSubmitting(true);
    try {
      await fetch(`${API}/cycle-counts/${id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: 'SuperAdmin', aplicarAjustes }),
      });
      setSuccess(aplicarAjustes ? '✅ Conteo cerrado — ajustes aplicados' : '✅ Conteo cerrado sin ajustes');
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  };

  // Handle scanner input (simulated with search)
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !scanInput) return;
    const line = selected.lineas.find(l =>
      l.sku.codigoDynamics.toLowerCase() === scanInput.toLowerCase() ||
      (l.lote && l.lote.toLowerCase() === scanInput.toLowerCase())
    );
    if (line && line.estado === 'PENDIENTE') {
      setCountingLine(line.id);
      setCountValue(String(line.cantidadSistema));
      setScanInput('');
    } else {
      setError(line ? 'Línea ya contada' : `SKU/Lote "${scanInput}" no encontrado en este conteo`);
      setTimeout(() => setError(null), 3000);
    }
  };

  // Stats
  const progCount = counts.filter(c => c.estado === 'EN_PROGRESO').length;
  const schedCount = counts.filter(c => c.estado === 'PROGRAMADO').length;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
      <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
      <div>Cargando conteos cíclicos...</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Conteo Cíclico</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Auditoría de inventario — Clasificación ABC, escaneo por SKU/Lote, ajustes automáticos
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      {success && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          animation: 'slideDown var(--transition-slow) ease-out' }}>
          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 'var(--font-sm)' }}>{success}</span>
        </div>
      )}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <AlertTriangle size={16} color="#DC2626" />
          <span style={{ color: '#DC2626', fontSize: 'var(--font-sm)', flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card glass-card"><div className="stat-card-value" style={{ color: 'var(--warning)' }}>{schedCount}</div><div className="stat-card-label">Programados</div></div>
        <div className="stat-card glass-card"><div className="stat-card-value" style={{ color: 'var(--info)' }}>{progCount}</div><div className="stat-card-label">En Progreso</div></div>
        <div className="stat-card glass-card"><div className="stat-card-value" style={{ color: 'var(--accent-secondary)' }}>{counts.filter(c => c.estado === 'COMPLETADO').length}</div><div className="stat-card-label">Completados</div></div>
        <div className="stat-card glass-card"><div className="stat-card-value">{counts.length}</div><div className="stat-card-label">Total Conteos</div></div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Nuevo Conteo Cíclico
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)', border: '2px solid var(--accent-primary)' }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ClipboardCheck size={18} style={{ color: 'var(--accent-primary)' }} /> Programar Conteo Cíclico
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre del Conteo *</label>
              <input className="form-input" placeholder="Ej: Conteo Clase A - Abril"
                value={createForm.nombre} onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo de Conteo</label>
              <select className="form-select" value={createForm.tipo} onChange={e => setCreateForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="SKU">📦 Por SKU (agrupar por producto)</option>
                <option value="UBICACION">📍 Por Ubicación (producto + ubicación)</option>
                <option value="LOTE">🏷️ Por Lote (producto + lote)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Clasificación ABC</label>
              <select className="form-select" value={createForm.clasificacion} onChange={e => setCreateForm(f => ({ ...f, clasificacion: e.target.value }))}>
                <option value="A">🔴 A — Alta rotación (conteo mensual)</option>
                <option value="B">🟡 B — Media rotación (trimestral)</option>
                <option value="C">🟢 C — Baja rotación (semestral)</option>
                <option value="FULL">⚫ Full — Todo el inventario</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha Programada *</label>
              <input type="date" className="form-input" value={createForm.fechaProgramada}
                onChange={e => setCreateForm(f => ({ ...f, fechaProgramada: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Auditor Asignado</label>
              <input className="form-input" placeholder="Nombre del auditor"
                value={createForm.asignadoA} onChange={e => setCreateForm(f => ({ ...f, asignadoA: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notas</label>
              <input className="form-input" placeholder="Observaciones..."
                value={createForm.notas} onChange={e => setCreateForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="spin" /> : <ClipboardCheck size={14} />}
              Crear Conteo (generará líneas del inventario actual)
            </button>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: panelCollapsed ? '48px 1fr' : '320px 1fr', gap: 'var(--space-4)', transition: 'grid-template-columns 0.3s ease' }}>
        {/* Counts List */}
        <div className="glass-card animate-slide-up" style={{ overflow: 'hidden', minWidth: 0 }}>
          <div className="data-table-header" style={{ cursor: 'pointer' }} onClick={() => setPanelCollapsed(!panelCollapsed)}>
            <div className="data-table-title">{panelCollapsed ? '📋' : `📋 Conteos (${counts.length})`}</div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{panelCollapsed ? '▶' : '◀'}</span>
          </div>
          {!panelCollapsed && (counts.length === 0 ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
              <ClipboardCheck size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
              <div>Sin conteos programados</div>
            </div>
          ) : (
            counts.map(cc => {
              const st = statusStyle(cc.estado);
              const counted = cc.lineas.filter(l => l.estado !== 'PENDIENTE').length;
              return (
                <div key={cc.id} className="alert-item"
                  style={{ cursor: 'pointer', borderLeft: selectedId === cc.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    background: selectedId === cc.id ? 'var(--accent-primary-soft)' : undefined }}
                  onClick={() => { setSelectedId(cc.id); setPanelCollapsed(true); }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{cc.codigo}</span>
                      <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 600, background: st.bg, color: st.color }}>{cc.estado}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, background: cc.clasificacion === 'A' ? '#FEE2E2' : cc.clasificacion === 'B' ? '#FEF9C3' : '#DCFCE7',
                        color: cc.clasificacion === 'A' ? '#DC2626' : cc.clasificacion === 'B' ? '#CA8A04' : '#16A34A',
                        padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>Clase {cc.clasificacion}</span>
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{cc.nombre}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      {counted}/{cc.lineas.length} contados · {cc.tipo}
                    </div>
                  </div>
                </div>
              );
            })
          ))}
        </div>

        {/* Detail */}
        <div>
          {selected ? (
            <div className="animate-slide-left">
              {/* Header */}
              <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{selected.codigo} — {selected.nombre}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      Tipo: {selected.tipo} · Clase {selected.clasificacion} · {selected.asignadoA || 'Sin asignar'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {selected.estado === 'PROGRAMADO' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStart(selected.id)}>
                        <Play size={14} /> Iniciar Conteo
                      </button>
                    )}
                    {selected.estado === 'COMPLETADO' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleClose(selected.id, true)} disabled={submitting}>
                          <CheckCircle2 size={14} /> Cerrar + Ajustar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleClose(selected.id, false)} disabled={submitting}>
                          Cerrar sin ajustes
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* Progress */}
                {(() => {
                  const total = selected.lineas.length;
                  const done = selected.lineas.filter(l => l.estado !== 'PENDIENTE').length;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  const discrepancies = selected.lineas.filter(l => l.discrepancia && l.discrepancia !== 0).length;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Progreso</span>
                        <span style={{ fontWeight: 600 }}>{done}/{total} ({Math.round(pct)}%) {discrepancies > 0 && <span style={{ color: '#DC2626' }}>· {discrepancies} discrepancias</span>}</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : undefined }}></div></div>
                    </div>
                  );
                })()}
              </div>

              {/* Scanner Input */}
              {selected.estado === 'EN_PROGRESO' && (
                <form onSubmit={handleScanSubmit} className="glass-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <ScanLine size={20} style={{ color: 'var(--accent-primary)' }} />
                  <input type="text" className="form-input" placeholder="Escanear código SKU o Lote..."
                    value={scanInput} onChange={e => setScanInput(e.target.value)} autoFocus
                    style={{ flex: 1, fontSize: 'var(--font-base)', fontWeight: 600 }} />
                  <button type="submit" className="btn btn-primary">Buscar</button>
                </form>
              )}

              {/* Lines Table */}
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div className="data-table-header">
                  <div className="data-table-title">📊 Líneas de Conteo ({selected.lineas.length})</div>
                  <TableActions
                    data={selected.lineas}
                    columns={[
                      { key: 'sku', label: 'SKU', format: (_, row) => row.sku?.codigoDynamics },
                      { key: 'sku', label: 'Producto', format: (_, row) => row.sku?.descripcion },
                      { key: 'cantidadSistema', label: 'Cant. Sistema' },
                      { key: 'cantidadFisica', label: 'Cant. Física', format: (v) => v ?? 'Pendiente' },
                      { key: 'discrepancia', label: 'Discrepancia', format: (v) => v ?? '—' },
                      { key: 'porcentajeDisc', label: '% Disc.', format: (v) => v != null ? `${v}%` : '—' },
                      { key: 'estado', label: 'Estado' },
                      { key: 'contadoPor', label: 'Contado Por' },
                    ]}
                    title={`Conteo ${selected.codigo}`}
                    filename={`conteo_${selected.codigo}`}
                  />
                </div>
                <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                  <div className="data-table-scroll">
                    <table style={{ minWidth: 700 }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 90 }}>SKU</th>
                          <th style={{ minWidth: 140 }}>Producto</th>
                          {selected.tipo === 'LOTE' && <th>Lote</th>}
                          <th style={{ textAlign: 'right', minWidth: 65 }}>Sistema</th>
                          <th style={{ textAlign: 'right', minWidth: 70 }}>Físico</th>
                          <th style={{ textAlign: 'right', minWidth: 55 }}>Diff</th>
                          <th style={{ minWidth: 75 }}>Estado</th>
                          <th style={{ minWidth: 90, position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.lineas.map(line => {
                          const isEditing = countingLine === line.id;
                          const hasDisc = line.discrepancia && line.discrepancia !== 0;
                          return (
                            <tr key={line.id} style={{ background: hasDisc ? 'rgba(220,38,38,0.04)' : undefined }}>
                              <td><code style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>{line.sku.codigoDynamics}</code></td>
                              <td style={{ fontSize: 'var(--font-xs)' }}>{line.sku.descripcion}</td>
                              {selected.tipo === 'LOTE' && <td style={{ fontSize: 'var(--font-xs)' }}>{line.lote || '—'}</td>}
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{line.cantidadSistema}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: hasDisc ? '#DC2626' : 'var(--success)' }}>
                                {isEditing ? (
                                  <input type="number" className="form-input" value={countValue}
                                    onChange={e => setCountValue(e.target.value)} autoFocus
                                    style={{ width: 80, padding: '2px 6px', fontSize: 'var(--font-xs)', textAlign: 'right' }} />
                                ) : (
                                  line.cantidadFisica != null ? line.cantidadFisica : '—'
                                )}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: hasDisc ? (line.discrepancia! > 0 ? '#16A34A' : '#DC2626') : 'var(--text-muted)' }}>
                                {line.discrepancia != null ? (line.discrepancia > 0 ? `+${line.discrepancia}` : line.discrepancia) : '—'}
                                {line.porcentajeDisc != null && <span style={{ fontSize: 9, display: 'block' }}>({line.porcentajeDisc}%)</span>}
                              </td>
                              <td>
                                <span style={{
                                  padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 600,
                                  background: line.estado === 'CONTADO' ? 'rgba(34,197,94,0.12)' : line.estado === 'AJUSTADO' ? 'rgba(139,92,246,0.12)' : 'rgba(234,179,8,0.12)',
                                  color: line.estado === 'CONTADO' ? '#16A34A' : line.estado === 'AJUSTADO' ? '#8B5CF6' : '#CA8A04',
                                }}>{line.estado}</span>
                              </td>
                              <td style={{ position: 'sticky', right: 0, background: hasDisc ? '#FEF2F2' : 'var(--bg-primary)', zIndex: 1 }}>
                                {line.estado === 'PENDIENTE' && selected.estado === 'EN_PROGRESO' && (
                                  isEditing ? (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}
                                        onClick={() => handleRecordCount(selected.id, line.id)} disabled={submitting}>
                                        <CheckCircle2 size={12} /> OK
                                      </button>
                                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px', fontSize: 11 }}
                                        onClick={() => setCountingLine(null)}><X size={12} /></button>
                                    </div>
                                  ) : (
                                    <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}
                                      onClick={() => { setCountingLine(line.id); setCountValue(String(line.cantidadSistema)); }}>
                                      <Hash size={12} /> Contar
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>📋</div>
              <div style={{ color: 'var(--text-muted)' }}>Selecciona un conteo o crea uno nuevo</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)' }}>
                Best practice: Clase A (alta rotación) → conteo mensual · Clase B → trimestral · Clase C → semestral
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
