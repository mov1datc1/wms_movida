import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  ArrowDownToLine, CheckCircle2, MapPin, Edit3,
  AlertCircle, RotateCw, Loader2, Wifi, Tag
} from 'lucide-react';

import { API } from '../config/api';

interface Sku {
  id: string;
  codigoDynamics: string;
  descripcion: string;
  categoria: string;
  uomBase: string;
  temperaturaRequerida: string;
  requiereLote: boolean;
  activo?: boolean;
}

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

interface ReceptionForm {
  skuId: string;
  lote: string;
  fechaVencimiento: string;
  cantidad: string;
  tipoHu: string;
  proveedor: string;
  notas: string;
}

const initialForm: ReceptionForm = {
  skuId: '', lote: '', fechaVencimiento: '', cantidad: '',
  tipoHu: 'PALLET', proveedor: '', notas: '',
};

interface ReceptionResult {
  id: string;
  skuDesc: string;
  lote: string;
  cantidad: number;
  tipoHu: string;
  ubicacion: string;
  huCodigo: string;
  hora: string;
  confirmado: boolean;
}

export function Receiving() {
  const [form, setForm] = useState<ReceptionForm>(initialForm);
  const [skuList, setSkuList] = useState<Sku[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [receptions, setReceptions] = useState<ReceptionResult[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideLocation, setOverrideLocation] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const { selectedWarehouseId } = useWarehouse();
  const navigate = useNavigate();

  // Load SKUs and locations from API
  useEffect(() => {
    async function loadData() {
      try {
        const whParam = selectedWarehouseId ? `?almacenId=${selectedWarehouseId}` : '';
        const [skuRes, locRes, movRes] = await Promise.all([
          fetch(`${API}/skus`),
          fetch(`${API}/locations${whParam}`),
          fetch(`${API}/movements?tipo=ENTRADA&limit=10${selectedWarehouseId ? `&almacenId=${selectedWarehouseId}` : ''}`),
        ]);
        setSkuList(await skuRes.json());
        setLocationList(await locRes.json());
        setRecentMovements(await movRes.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    loadData();
  }, [selectedWarehouseId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const selectedSku = skuList.find((s) => s.id === form.skuId);

  // Suggest best location based on temperature
  const suggestion = useMemo(() => {
    if (!selectedSku) return { codigo: 'RECIBO-01', id: '', reason: 'SKU no seleccionado' };
    const compatible = locationList.filter((loc) => {
      const tempMatch = loc.temperatura === selectedSku.temperaturaRequerida;
      const hasSpace = loc.ocupacion < loc.capacidad;
      const notBlocked = loc.estado !== 'BLOQUEADO';
      const notRecibo = loc.tipoUbicacion !== 'RECIBO' && loc.tipoUbicacion !== 'STAGING';
      return tempMatch && hasSpace && notBlocked && notRecibo;
    }).sort((a, b) => {
      if (a.tipoUbicacion === 'PICKING' && b.tipoUbicacion !== 'PICKING') return -1;
      if (a.tipoUbicacion !== 'PICKING' && b.tipoUbicacion === 'PICKING') return 1;
      return (a.ocupacion / a.capacidad) - (b.ocupacion / b.capacidad);
    });
    if (compatible.length > 0) {
      const best = compatible[0];
      return {
        codigo: best.codigo, id: best.id,
        reason: `${best.zona} · ${best.tipoUbicacion} · ${Math.round((best.ocupacion / best.capacidad) * 100)}% ocupado`,
      };
    }
    const recibo = locationList.find(l => l.tipoUbicacion === 'RECIBO');
    return { codigo: recibo?.codigo || 'RECIBO-01', id: recibo?.id || '', reason: 'Sin ubicación compatible — almacenar en recibo' };
  }, [selectedSku, locationList]);

  const compatibleLocations = useMemo(() => {
    if (!selectedSku) return locationList.filter((l) => l.tipoUbicacion !== 'STAGING');
    return locationList.filter((loc) => {
      const tempMatch = loc.temperatura === selectedSku.temperaturaRequerida || loc.tipoUbicacion === 'RECIBO';
      return tempMatch && loc.estado !== 'BLOQUEADO';
    });
  }, [selectedSku, locationList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.skuId || !form.lote || !form.cantidad || !form.proveedor) {
      setError('Todos los campos obligatorios deben estar completos');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Find the location ID for the final location
    const finalLocationCode = overrideLocation || suggestion.codigo;
    const finalLocation = locationList.find(l => l.codigo === finalLocationCode);

    try {
      const res = await fetch(`${API}/reception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: form.skuId,
          lote: form.lote,
          fechaVencimiento: form.fechaVencimiento || undefined,
          cantidad: parseInt(form.cantidad),
          proveedor: form.proveedor,
          tipoHu: form.tipoHu,
          ubicacionId: finalLocation?.id || suggestion.id,
          almacenId: (locationList[0] as any)?.almacenId,
          usuario: 'Jonathan P.',
          notas: form.notas,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).message || 'Error al registrar');

      const result = await res.json();

      setReceptions(prev => [{
        id: result.movement.id,
        skuDesc: selectedSku?.descripcion || 'SKU',
        lote: form.lote,
        cantidad: parseInt(form.cantidad),
        tipoHu: form.tipoHu,
        ubicacion: finalLocationCode,
        huCodigo: result.handlingUnit.codigo,
        hora: new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
        confirmado: false,
      }, ...prev]);

      setShowSuccess(`✅ Recepción registrada — Lote: ${form.lote}, HU: ${result.handlingUnit.codigo}, Ubicación: ${finalLocationCode}`);
      setForm(initialForm);
      setOverrideLocation('');
      setShowOverride(false);
      setTimeout(() => setShowSuccess(null), 5000);

      // Refresh movements
      const movRes = await fetch(`${API}/movements?tipo=ENTRADA&limit=10`);
      setRecentMovements(await movRes.json());

    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async (_id: string, receptionIdx: number) => {
    const loc = locationList.find(l => l.codigo === editLocation);
    if (!loc) return;

    const reception = receptions[receptionIdx];
    try {
      // Find the lot by lote name from the recent movements
      const lotsRes = await fetch(`${API}/lots`);
      const allLots = await lotsRes.json();
      const lot = allLots.find((l: any) => l.lote === reception.lote);
      if (lot) {
        await fetch(`${API}/lots/${lot.id}/reassign`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ubicacionId: loc.id, usuario: 'Jonathan P.' }),
        });
      }

      setReceptions(prev => prev.map((r, i) =>
        i === receptionIdx ? { ...r, ubicacion: editLocation } : r
      ));
      setEditingId(null);
      setEditLocation('');
      setShowSuccess(`✅ Ubicación reasignada: ${reception.lote} → ${editLocation}`);
      setTimeout(() => setShowSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando catálogos desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Recepción de Materias Primas</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Registro de ingreso — genera HU/LPN y asigna ubicación putaway
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase Live
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
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Form */}
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <ArrowDownToLine size={20} style={{ color: 'var(--accent-primary)' }} />
            Nuevo Ingreso
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">SKU / Producto ({skuList.length} disponibles)</label>
              <select name="skuId" className="form-select" value={form.skuId}
                onChange={(e) => { handleChange(e); setOverrideLocation(''); setShowOverride(false); }}
                required id="reception-sku">
                <option value="">Seleccionar SKU...</option>
                {skuList.filter((s) => s.activo !== false).map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.codigoDynamics} — {sku.descripcion}
                  </option>
                ))}
              </select>
            </div>

            {selectedSku && (
              <div style={{
                background: 'var(--accent-primary-soft)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)',
                fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap',
              }}>
                <span>Categoría: <strong>{selectedSku.categoria}</strong></span>
                <span>UoM: <strong>{selectedSku.uomBase}</strong></span>
                <span>Temp: <strong className={`badge badge-${selectedSku.temperaturaRequerida.toLowerCase()}`}>{selectedSku.temperaturaRequerida}</strong></span>
                <span>Lote: <strong>{selectedSku.requiereLote ? 'Requerido' : 'No'}</strong></span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Número de Lote</label>
                <input type="text" name="lote" className="form-input" placeholder="Ej: L260401A"
                  value={form.lote} onChange={handleChange} required id="reception-lote" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de Vencimiento</label>
                <input type="date" name="fechaVencimiento" className="form-input"
                  value={form.fechaVencimiento} onChange={handleChange} id="reception-vencimiento" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input type="number" name="cantidad" className="form-input" placeholder="0"
                  value={form.cantidad} onChange={handleChange} required min="1" id="reception-cantidad" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de HU</label>
                <select name="tipoHu" className="form-select" value={form.tipoHu} onChange={handleChange} id="reception-tipohu">
                  <option value="PALLET">📦 Pallet</option>
                  <option value="CAJA">📋 Caja</option>
                  <option value="BANDEJA">🗂️ Bandeja</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Proveedor</label>
              <select name="proveedor" className="form-select" value={form.proveedor} onChange={handleChange} required id="reception-proveedor">
                <option value="">Seleccionar proveedor...</option>
                <option value="US Foods Guatemala">US Foods Guatemala</option>
                <option value="Mission Foods GT">Mission Foods GT</option>
                <option value="Tyson Foods Import">Tyson Foods Import</option>
                <option value="Dos Pinos GT">Dos Pinos GT</option>
                <option value="Del Monte Guatemala">Del Monte Guatemala</option>
                <option value="Fresh Produce GT">Fresh Produce GT</option>
                <option value="Henkel Guatemala">Henkel Guatemala</option>
                <option value="Pilgrims GT">Pilgrims GT</option>
              </select>
            </div>

            {/* Putaway Location */}
            {form.skuId && (
              <div className="form-group">
                <label className="form-label">
                  <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Ubicación Putaway
                </label>
                <div style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {overrideLocation || suggestion.codigo}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {overrideLocation ? '✏️ Ubicación manual' : `💡 Sugerido: ${suggestion.reason}`}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setShowOverride(!showOverride)} style={{ fontSize: 'var(--font-xs)' }}>
                      <Edit3 size={13} /> {showOverride ? 'Cerrar' : 'Cambiar'}
                    </button>
                  </div>
                </div>
                {showOverride && (
                  <div style={{ animation: 'slideDown 200ms ease-out' }}>
                    <select className="form-select" value={overrideLocation}
                      onChange={(e) => setOverrideLocation(e.target.value)} id="reception-override-location">
                      <option value="">— Usar sugerencia automática —</option>
                      {compatibleLocations.map((loc) => (
                        <option key={loc.id} value={loc.codigo}>
                          {loc.codigo} · {loc.zona} · {loc.tipoUbicacion} · {Math.round((loc.ocupacion / loc.capacidad) * 100)}%
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notas / Observaciones</label>
              <input type="text" name="notas" className="form-input" placeholder="OC Dynamics, condición, observaciones..."
                value={form.notas} onChange={handleChange} id="reception-notas" />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}
              style={{ width: '100%', padding: 'var(--space-3)' }} id="btn-submit-reception">
              {submitting ? <Loader2 size={16} className="spin" /> : <ArrowDownToLine size={16} />}
              {submitting ? 'Guardando en Supabase...' : 'Registrar Recepción'}
            </button>
          </form>
        </div>

        {/* Right Panel */}
        <div>
          {/* Session Receptions */}
          {receptions.length > 0 && (
            <div className="glass-card animate-slide-left" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="data-table-header">
                <div className="data-table-title">✅ Recibidos (Sesión)</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {receptions.length} registros guardados en DB
                </div>
              </div>
              {receptions.map((r, idx) => {
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="alert-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div className="alert-dot" style={{ background: 'var(--success)' }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.skuDesc}
                        </div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                          Lote: {r.lote} · Cant: {r.cantidad} · HU: {r.huCodigo}
                        </div>
                      </div>
                      <div className="alert-time">{r.hora}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingLeft: 'calc(8px + var(--space-3))', marginTop: 'var(--space-1)' }}>
                      <MapPin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1 }}>
                          <select className="form-select" value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            style={{ flex: 1, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-xs)' }}>
                            {locationList.filter(l => l.estado !== 'BLOQUEADO' && l.tipoUbicacion !== 'STAGING').map((loc) => (
                              <option key={loc.id} value={loc.codigo}>
                                {loc.codigo} · {loc.zona} · {Math.round((loc.ocupacion / loc.capacidad) * 100)}%
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={() => handleReassign(r.id, idx)}>
                            <CheckCircle2 size={12} /> Guardar
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                          <code style={{ color: 'var(--accent-primary)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>{r.ubicacion}</code>
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--success)', fontWeight: 600, marginLeft: 'auto' }}>
                            ✓ En Supabase
                          </span>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(r.id); setEditLocation(r.ubicacion); }}
                            style={{ fontSize: 'var(--font-xs)' }}>
                            <RotateCw size={11} /> Reasignar
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); navigate(`/etiquetado?lote=${encodeURIComponent(r.lote)}`); }}
                            style={{ fontSize: 'var(--font-xs)', color: 'var(--accent-secondary)' }}
                            title="Imprimir etiqueta">
                            <Tag size={11} /> Etiqueta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent DB Movements */}
          <div className="glass-card animate-slide-up stagger-2">
            <div className="data-table-header">
              <div className="data-table-title">📥 Entradas en DB</div>
              <span className="badge badge-liberado">{recentMovements.length} registros</span>
            </div>
            {recentMovements.length === 0 ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                Sin entradas registradas aún. Crea la primera recepción.
              </div>
            ) : (
              recentMovements.map((entry) => (
                <div key={entry.id} className="alert-item">
                  <div className="alert-dot" style={{ background: 'var(--success)' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {entry.sku?.descripcion || 'SKU'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      {entry.cantidad} UN → {entry.toLocation?.codigo || '—'} · {entry.usuario}
                    </div>
                  </div>
                  <div className="alert-time">{new Date(entry.fechaHora).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
