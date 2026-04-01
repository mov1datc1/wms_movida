import { useState, useEffect, useCallback } from 'react';
import {
  Database, Package, MapPin, ShieldCheck, Search,
  Plus, X, CheckCircle2, RefreshCw, Loader2, AlertCircle
} from 'lucide-react';

import { API } from '../config/api';

interface Sku {
  id: string;
  codigoDynamics: string;
  descripcion: string;
  categoria: string;
  uomBase: string;
  temperaturaRequerida: string;
  familiaCalidad: string;
  requiereLote: boolean;
  requiereVencimiento: boolean;
  activo: boolean;
}

interface Location {
  id: string;
  codigo: string;
  zona: string;
  pasillo: string;
  rack: string;
  nivel: string;
  tipoUbicacion: string;
  temperatura: string;
  capacidad: number;
  ocupacion: number;
  estado: string;
  almacen: { codigo: string; nombre: string };
}

interface Restaurante {
  id: string;
  nombre: string;
  zona: string;
  direccion: string;
  activo: boolean;
}

interface QualityRule {
  id: string;
  categoriaProducto: string;
  incompatibilidades: string | null;
  zonaPermitida: string;
  restriccionesAlergeno: string | null;
  restriccionesQuimico: string | null;
}

type Tab = 'skus' | 'ubicaciones' | 'restaurantes' | 'calidad';

const emptySkuForm = {
  codigoDynamics: '',
  descripcion: '',
  categoria: 'Salsas',
  uomBase: 'UN',
  temperaturaRequerida: 'AMBIENTE',
  familiaCalidad: 'ALIMENTO',
  requiereLote: true,
  requiereVencimiento: true,
};

export function MasterData() {
  const [activeTab, setActiveTab] = useState<Tab>('skus');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data
  const [skuList, setSkuList] = useState<Sku[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  const [restauranteList, setRestauranteList] = useState<Restaurante[]>([]);
  const [qualityRules, setQualityRules] = useState<QualityRule[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [skuForm, setSkuForm] = useState(emptySkuForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'skus') {
        const res = await fetch(`${API}/skus`);
        setSkuList(await res.json());
      } else if (activeTab === 'ubicaciones') {
        const res = await fetch(`${API}/locations`);
        setLocationList(await res.json());
      } else if (activeTab === 'restaurantes') {
        const res = await fetch(`${API}/restaurantes`);
        setRestauranteList(await res.json());
      } else if (activeTab === 'calidad') {
        const res = await fetch(`${API}/quality-rules`);
        setQualityRules(await res.json());
      }
    } catch (e: any) {
      setError(`Error al conectar con el backend: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateSku = async () => {
    if (!skuForm.codigoDynamics || !skuForm.descripcion) {
      setError('Código Dynamics y Descripción son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/skus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skuForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear SKU');
      }
      const created = await res.json();
      setSkuList((prev) => [...prev, created]);
      setShowModal(false);
      setSkuForm(emptySkuForm);
      setSuccess(`✅ SKU ${created.codigoDynamics} creado exitosamente`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tabCounts = {
    skus: skuList.length,
    ubicaciones: locationList.length,
    restaurantes: restauranteList.length,
    calidad: qualityRules.length,
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'skus', label: 'SKUs', icon: <Package size={14} /> },
    { key: 'ubicaciones', label: 'Ubicaciones', icon: <MapPin size={14} /> },
    { key: 'restaurantes', label: 'Restaurantes', icon: <Database size={14} /> },
    { key: 'calidad', label: 'Reglas Calidad', icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Datos Maestros</h1>
        <p>Conectado a Supabase — SKUs, ubicaciones, restaurantes y reglas</p>
      </div>

      {/* Status messages */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        }}>
          <AlertCircle size={16} color="#DC2626" />
          <span style={{ color: '#DC2626', fontSize: 'var(--font-sm)', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div style={{
          background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', animation: 'slideDown 200ms ease-out',
        }}>
          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
            id={`tab-${tab.key}`}
          >
            {tab.icon}
            <span style={{ marginLeft: 6 }}>{tab.label}</span>
            <span style={{
              marginLeft: 8, fontSize: 'var(--font-xs)',
              background: activeTab === tab.key ? 'var(--accent-primary-soft)' : 'var(--bg-elevated)',
              padding: '1px 8px', borderRadius: 'var(--radius-full)',
            }}>
              {tabCounts[tab.key] || 0}
            </span>
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={fetchData} style={{ marginLeft: 'auto' }} title="Recargar datos">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto var(--space-3)' }} />
          <div style={{ fontSize: 'var(--font-sm)' }}>Cargando desde Supabase...</div>
        </div>
      )}

      {/* ============ SKUs TAB ============ */}
      {activeTab === 'skus' && !loading && (
        <div className="data-table-wrapper glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">Catálogo de SKUs</div>
            <div className="data-table-actions">
              <div className="table-search">
                <Search size={15} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text" placeholder="Buscar SKU..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  id="master-search"
                />
              </div>
              <button className="btn btn-primary btn-sm" id="btn-add-sku" onClick={() => setShowModal(true)}>
                <Plus size={14} /> Nuevo SKU
              </button>
            </div>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código Dynamics</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>UoM</th>
                  <th>Temperatura</th>
                  <th>Familia</th>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {skuList
                  .filter((s) =>
                    s.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.codigoDynamics.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((sku) => (
                    <tr key={sku.id}>
                      <td><code style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{sku.codigoDynamics}</code></td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sku.descripcion}</td>
                      <td>{sku.categoria}</td>
                      <td>{sku.uomBase}</td>
                      <td><span className={`badge badge-${sku.temperaturaRequerida.toLowerCase()}`}>{sku.temperaturaRequerida}</span></td>
                      <td style={{ fontSize: 'var(--font-xs)' }}>{sku.familiaCalidad}</td>
                      <td>{sku.requiereLote ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> : <X size={14} style={{ color: 'var(--text-muted)' }} />}</td>
                      <td>{sku.requiereVencimiento ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> : <X size={14} style={{ color: 'var(--text-muted)' }} />}</td>
                      <td><span className={`badge ${sku.activo ? 'badge-liberado' : 'badge-bloqueado'}`}>{sku.activo ? 'Activo' : 'Inactivo'}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <div className="table-pagination-info">
              {skuList.length} SKUs en Supabase · Conectado a backend real
            </div>
          </div>
        </div>
      )}

      {/* ============ LOCATIONS TAB ============ */}
      {activeTab === 'ubicaciones' && !loading && (
        <div className="data-table-wrapper glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">Ubicaciones CEDIS (Supabase)</div>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Almacén</th>
                  <th>Zona</th>
                  <th>Pasillo</th>
                  <th>Rack</th>
                  <th>Nivel</th>
                  <th>Tipo</th>
                  <th>Temperatura</th>
                  <th>Capacidad</th>
                  <th>Ocupación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {locationList.map((loc) => (
                  <tr key={loc.id}>
                    <td><code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{loc.codigo}</code></td>
                    <td style={{ fontSize: 'var(--font-xs)' }}>{loc.almacen?.nombre}</td>
                    <td>{loc.zona}</td>
                    <td>{loc.pasillo}</td>
                    <td>{loc.rack}</td>
                    <td>{loc.nivel}</td>
                    <td style={{ fontSize: 'var(--font-xs)' }}>{loc.tipoUbicacion}</td>
                    <td><span className={`badge badge-${loc.temperatura.toLowerCase()}`}>{loc.temperatura}</span></td>
                    <td>{loc.capacidad}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div className="progress-bar" style={{ width: 60, height: 4 }}>
                          <div className="progress-fill" style={{
                            width: `${Math.round((loc.ocupacion / loc.capacidad) * 100)}%`,
                            background: (loc.ocupacion / loc.capacidad) > 0.9 ? 'var(--danger)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                          }}></div>
                        </div>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                          {Math.round((loc.ocupacion / loc.capacidad) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${loc.estado === 'LIBRE' ? 'badge-liberado' : loc.estado === 'OCUPADO' ? 'badge-en-picking' : 'badge-bloqueado'}`}>
                        {loc.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <div className="table-pagination-info">{locationList.length} ubicaciones desde Supabase</div>
          </div>
        </div>
      )}

      {/* ============ RESTAURANTES TAB ============ */}
      {activeTab === 'restaurantes' && !loading && (
        <div className="data-table-wrapper glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">Restaurantes Taco Bell Guatemala (Supabase)</div>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Zona</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {restauranteList.map((r) => (
                  <tr key={r.id}>
                    <td><code style={{ color: 'var(--accent-secondary)', fontSize: 'var(--font-xs)' }}>{r.id.substring(0, 8)}...</code></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.nombre}</td>
                    <td>{r.zona}</td>
                    <td style={{ fontSize: 'var(--font-xs)' }}>{r.direccion}</td>
                    <td><span className="badge badge-liberado">{r.activo ? 'Activo' : 'Inactivo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <div className="table-pagination-info">{restauranteList.length} restaurantes desde Supabase</div>
          </div>
        </div>
      )}

      {/* ============ CALIDAD TAB ============ */}
      {activeTab === 'calidad' && !loading && (
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-6)' }}>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
            <ShieldCheck size={18} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--accent-primary)' }} />
            Reglas de Calidad y Almacenaje (Supabase)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {qualityRules.map((rule) => (
              <div key={rule.id} style={{
                padding: 'var(--space-4)', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)',
              }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  {rule.categoriaProducto}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  <div>🏗️ Zona: {rule.zonaPermitida}</div>
                  <div>⛔ Incompatibilidad: {rule.incompatibilidades || 'Ninguna'}</div>
                  <div>⚠️ Alérgenos: {rule.restriccionesAlergeno || 'N/A'}</div>
                  <div>🧪 Químicos: {rule.restriccionesQuimico || 'N/A'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ MODAL: NUEVO SKU ============ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 200ms ease-out',
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: '#FFFFFF', borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)', width: 520, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'slideDown 250ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Package size={20} style={{ color: 'var(--accent-primary)' }} />
                Nuevo SKU
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Código Dynamics *</label>
              <input className="form-input" placeholder="Ej: TB-BEB-001" value={skuForm.codigoDynamics}
                onChange={(e) => setSkuForm({ ...skuForm, codigoDynamics: e.target.value })} id="modal-sku-code" />
            </div>

            <div className="form-group">
              <label className="form-label">Descripción *</label>
              <input className="form-input" placeholder="Ej: Refresco Cola 355ml x24" value={skuForm.descripcion}
                onChange={(e) => setSkuForm({ ...skuForm, descripcion: e.target.value })} id="modal-sku-desc" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={skuForm.categoria}
                  onChange={(e) => setSkuForm({ ...skuForm, categoria: e.target.value })} id="modal-sku-cat">
                  <option value="Salsas">Salsas</option>
                  <option value="Tortillas">Tortillas</option>
                  <option value="Proteínas">Proteínas</option>
                  <option value="Lácteos">Lácteos</option>
                  <option value="Vegetales">Vegetales</option>
                  <option value="Insumos Base">Insumos Base</option>
                  <option value="Bebidas">Bebidas</option>
                  <option value="Empaques">Empaques</option>
                  <option value="Químicos">Químicos</option>
                  <option value="Uniformes">Uniformes</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">UoM</label>
                <select className="form-select" value={skuForm.uomBase}
                  onChange={(e) => setSkuForm({ ...skuForm, uomBase: e.target.value })} id="modal-sku-uom">
                  <option value="UN">UN (Unidad)</option>
                  <option value="KG">KG (Kilogramo)</option>
                  <option value="LT">LT (Litro)</option>
                  <option value="PAQ">PAQ (Paquete)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Temperatura</label>
                <select className="form-select" value={skuForm.temperaturaRequerida}
                  onChange={(e) => setSkuForm({ ...skuForm, temperaturaRequerida: e.target.value })} id="modal-sku-temp">
                  <option value="AMBIENTE">Ambiente</option>
                  <option value="REFRIGERADO">Refrigerado</option>
                  <option value="CONGELADO">Congelado</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Familia Calidad</label>
                <select className="form-select" value={skuForm.familiaCalidad}
                  onChange={(e) => setSkuForm({ ...skuForm, familiaCalidad: e.target.value })} id="modal-sku-quality">
                  <option value="ALIMENTO">ALIMENTO</option>
                  <option value="QUIMICO">QUIMICO</option>
                  <option value="EMPAQUE">EMPAQUE</option>
                  <option value="TEXTIL">TEXTIL</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-5)', marginTop: 'var(--space-2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={skuForm.requiereLote}
                  onChange={(e) => setSkuForm({ ...skuForm, requiereLote: e.target.checked })} />
                Requiere Lote
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={skuForm.requiereVencimiento}
                  onChange={(e) => setSkuForm({ ...skuForm, requiereVencimiento: e.target.checked })} />
                Requiere Vencimiento
              </label>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreateSku} disabled={loading} id="btn-save-sku">
                {loading ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                {loading ? 'Guardando...' : 'Guardar en Supabase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
