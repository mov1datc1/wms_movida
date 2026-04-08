import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Wifi, Zap, History, BarChart3, Settings, Shield, Lock, Unlock, AlertTriangle, X, Eye, EyeOff, Database, TestTube2, Save, Edit3 } from 'lucide-react';
import { API } from '../config/api';

interface SyncEvent {
  id: string;
  tipo: 'INBOUND' | 'OUTBOUND';
  entidad: string;
  registros: number;
  estado: 'SUCCESS' | 'ERROR' | 'PARTIAL';
  detalle: string;
  usuario: string | null;
  duracionMs: number | null;
  createdAt: string;
}

interface SyncStats {
  totalSyncs: number;
  successCount: number;
  errorCount: number;
  lastSync: SyncEvent | null;
  totalRecordsSynced: number;
}

interface DynamicsStatus {
  configured: boolean;
  mode: 'live' | 'demo';
  tenantId: string;
  environment: string;
  configSource: 'database' | 'environment' | 'none';
}

interface IntegrationConfig {
  id: string | null;
  provider: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  clientSecretSet: boolean;
  environment: string;
  companyId: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  configSource: 'database' | 'environment' | 'none';
}

const entityLabels: Record<string, string> = {
  items: 'SKU Master (Items)',
  customers: 'Restaurantes (Customers)',
  vendors: 'Proveedores (Vendors)',
  purchaseOrders: 'Órdenes de Compra',
  salesOrders: 'Pedidos de Salida',
  receipts: 'Recepciones Confirmadas',
  dispatches: 'Despachos Confirmados',
  inventoryAdjustments: 'Ajustes de Inventario',
};

export function DynamicsSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncingEntity, setSyncingEntity] = useState<string | null>(null);
  const [status, setStatus] = useState<DynamicsStatus | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [history, setHistory] = useState<SyncEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'config'>('overview');

  // Config state
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showConfirm1, setShowConfirm1] = useState(false); // First confirm to enter edit mode
  const [showConfirm2, setShowConfirm2] = useState(false); // Second confirm to save
  const [showSecretField, setShowSecretField] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  // Form fields
  const [formTenantId, setFormTenantId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formClientSecret, setFormClientSecret] = useState('');
  const [formEnvironment, setFormEnvironment] = useState('production');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formIsActive, setFormIsActive] = useState(false);

  // Load on mount
  useEffect(() => {
    loadStatus();
    loadStats();
    loadHistory();
    loadConfig();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API}/dynamics/status`);
      if (res.ok) setStatus(await res.json());
    } catch { /* silent */ }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API}/dynamics/sync/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API}/dynamics/sync/history?limit=30`);
      if (res.ok) setHistory(await res.json());
    } catch { /* silent */ }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API}/dynamics/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Populate form fields
        setFormTenantId(data.tenantId || '');
        setFormClientId(data.clientId || '');
        setFormClientSecret('');
        setFormEnvironment(data.environment || 'production');
        setFormCompanyId(data.companyId || '');
        setFormIsActive(data.isActive || false);
      }
    } catch { /* silent */ }
  };

  const triggerFullSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/dynamics/sync/full`, { method: 'POST' });
      if (res.ok) {
        await loadStats();
        await loadHistory();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const triggerEntitySync = async (entity: string, direction: 'sync' | 'push') => {
    setSyncingEntity(entity);
    try {
      const endpoint = direction === 'sync' ? `sync/${entity}` : `push/${entity}`;
      await fetch(`${API}/dynamics/${endpoint}`, { method: 'POST' });
      await loadStats();
      await loadHistory();
    } catch { /* silent */ } finally {
      setSyncingEntity(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
  };

  // ── Config Handlers ────────────────────────────────────

  const handleEditClick = () => {
    setShowConfirm1(true);
  };

  const confirmEnterEditMode = () => {
    setShowConfirm1(false);
    setEditMode(true);
    setTestResult(null);
    setConfigMsg(null);
    // Reset form with current values
    if (config) {
      setFormTenantId(config.tenantId || '');
      setFormClientId(config.clientId?.includes('●') ? '' : (config.clientId || ''));
      setFormClientSecret('');
      setFormEnvironment(config.environment || 'production');
      setFormCompanyId(config.companyId || '');
      setFormIsActive(config.isActive || false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/dynamics/config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: formTenantId,
          clientId: formClientId,
          clientSecret: formClientSecret || (config?.clientSecretSet ? '●●●●●●●●' : ''),
          environment: formEnvironment,
          companyId: formCompanyId,
        }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: 'Error de red al probar la conexión' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveClick = () => {
    setShowConfirm2(true);
  };

  const confirmSaveConfig = async () => {
    setShowConfirm2(false);
    setSaving(true);
    try {
      const res = await fetch(`${API}/dynamics/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: formTenantId,
          clientId: formClientId,
          clientSecret: formClientSecret || undefined,
          environment: formEnvironment,
          companyId: formCompanyId,
          isActive: formIsActive,
          updatedBy: 'SuperAdmin',
        }),
      });
      if (res.ok) {
        setConfigMsg('✅ Configuración guardada exitosamente');
        setEditMode(false);
        await loadConfig();
        await loadStatus();
      } else {
        setConfigMsg('❌ Error al guardar la configuración');
      }
    } catch {
      setConfigMsg('❌ Error de red al guardar');
    } finally {
      setSaving(false);
      setTimeout(() => setConfigMsg(null), 5000);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setTestResult(null);
    setShowSecretField(false);
    if (config) {
      setFormTenantId(config.tenantId || '');
      setFormClientId(config.clientId || '');
      setFormClientSecret('');
      setFormEnvironment(config.environment || 'production');
      setFormCompanyId(config.companyId || '');
      setFormIsActive(config.isActive || false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Sincronización Dynamics 365</h1>
        <p>Integración bidireccional con Microsoft Dynamics 365 Business Central — ERP ↔ WMS</p>
      </div>

      {/* Connection Badge */}
      {status && status.mode === 'live' && (
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: 'var(--success-soft)', border: '1px solid var(--success)' }}>
            <Wifi size={14} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--success)' }}>
              Conectado — Dynamics 365 Business Central
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: 11, fontWeight: 600, color: '#3B82F6' }}>
            <Database size={12} />
            Env: {status.environment} — Tenant {status.tenantId}
          </div>
      </div>
      )}

      {/* Stats Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-icon info" style={{ marginBottom: 'var(--space-3)' }}>
            <RefreshCw size={20} />
          </div>
          <div className="stat-card-value">{stats?.totalSyncs || 0}</div>
          <div className="stat-card-label">Syncs Totales</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats?.successCount || 0}</div>
          <div className="stat-card-label">Exitosos</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{stats?.errorCount || 0}</div>
          <div className="stat-card-label">Errores</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value">{stats?.totalRecordsSynced || 0}</div>
          <div className="stat-card-label">Registros Procesados</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value" style={{ fontSize: 'var(--font-sm)' }}>
            {stats?.lastSync ? timeAgo(stats.lastSync.createdAt) : 'Nunca'}
          </div>
          <div className="stat-card-label">Última Sincronización</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        {[
          { key: 'overview' as const, label: 'Panel de Control', icon: BarChart3 },
          { key: 'history' as const, label: 'Historial', icon: History },
          { key: 'config' as const, label: 'Configuración', icon: Settings },
        ].map(tab => (
          <button
            key={tab.key}
            className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Full Sync Button */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
            <button
              className="btn btn-primary"
              onClick={triggerFullSync}
              disabled={syncing}
              id="btn-sync-dynamics"
              style={{ padding: 'var(--space-3) var(--space-6)' }}
            >
              <Zap size={18} />
              {syncing ? 'Sincronizando todo...' : '⚡ Sincronización Completa'}
            </button>
          </div>

          {/* Integration Map */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            {/* INBOUND */}
            <div className="glass-card animate-slide-up stagger-1" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <ArrowDownToLine size={20} style={{ color: 'var(--accent-secondary)' }} />
                <div style={{ fontWeight: 700 }}>Dynamics → WMS</div>
                <span className="badge badge-liberado" style={{ marginLeft: 'auto' }}>INBOUND</span>
              </div>
              {[
                { entity: 'items', label: 'Items → SKU Master', desc: 'Catálogo de productos' },
                { entity: 'customers', label: 'Customers → Restaurantes', desc: 'Destinos de despacho' },
                { entity: 'vendors', label: 'Vendors → Proveedores', desc: 'Proveedores de compra' },
                { entity: 'purchase-orders', label: 'Purchase Orders → Recepciones', desc: 'OC pendientes' },
                { entity: 'sales-orders', label: 'Sales Orders → Pedidos', desc: 'Pedidos de restaurantes' },
              ].map((item) => (
                <div key={item.entity} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: 'var(--font-xs)' }}
                    onClick={() => triggerEntitySync(item.entity, 'sync')}
                    disabled={syncingEntity === item.entity}
                  >
                    {syncingEntity === item.entity ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                  </button>
                </div>
              ))}
            </div>

            {/* OUTBOUND */}
            <div className="glass-card animate-slide-up stagger-2" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <ArrowUpFromLine size={20} style={{ color: 'var(--accent-primary)' }} />
                <div style={{ fontWeight: 700 }}>WMS → Dynamics</div>
                <span className="badge badge-pendiente" style={{ marginLeft: 'auto' }}>OUTBOUND</span>
              </div>
              {[
                { entity: 'receipts', label: 'Recepciones Confirmadas', desc: 'Confirmaciones de recibo al ERP' },
                { entity: 'dispatches', label: 'Despachos Confirmados', desc: 'Salidas confirmadas al ERP' },
                { entity: 'inventory-adjustments', label: 'Ajustes de Inventario', desc: 'Correcciones y mermas' },
              ].map((item) => (
                <div key={item.entity} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: 'var(--font-xs)' }}
                    onClick={() => triggerEntitySync(item.entity, 'push')}
                    disabled={syncingEntity === item.entity}
                  >
                    {syncingEntity === item.entity ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowUpFromLine size={12} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* TAB: History */}
      {activeTab === 'history' && (
        <div className="data-table-wrapper glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">📋 Historial de Sincronización</div>
            <button className="btn btn-secondary" onClick={loadHistory} style={{ padding: '4px 12px', fontSize: 'var(--font-xs)' }}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Dirección</th>
                  <th>Entidad</th>
                  <th>Registros</th>
                  <th>Estado</th>
                  <th>Duración</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                    No hay sincronizaciones aún. Haz click en "Sincronización Completa" para comenzar.
                  </td></tr>
                ) : (
                  history.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {new Date(ev.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(ev.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td>
                        {ev.tipo === 'INBOUND' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-secondary)' }}>
                            <ArrowDownToLine size={14} /> DYN → WMS
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)' }}>
                            <ArrowUpFromLine size={14} /> WMS → DYN
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {entityLabels[ev.entidad] || ev.entidad}
                      </td>
                      <td style={{ fontWeight: 700 }}>{ev.registros}</td>
                      <td>
                        {ev.estado === 'SUCCESS' ? (
                          <span className="badge badge-liberado">✅ Éxito</span>
                        ) : ev.estado === 'ERROR' ? (
                          <span className="badge badge-bloqueado">❌ Error</span>
                        ) : (
                          <span className="badge badge-pendiente">⚠️ Parcial</span>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        {ev.duracionMs ? `${ev.duracionMs}ms` : '—'}
                      </td>
                      <td style={{ fontSize: 'var(--font-xs)', maxWidth: 300 }}>{ev.detalle}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Config — EDITABLE with Double Confirmation */}
      {activeTab === 'config' && (
        <div style={{ maxWidth: 800 }}>
          {/* Config message */}
          {configMsg && (
            <div style={{
              background: configMsg.includes('✅') ? 'var(--success-soft)' : '#FEF2F2',
              border: `1px solid ${configMsg.includes('✅') ? 'var(--success)' : '#FCA5A5'}`,
              borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)', fontWeight: 600,
              color: configMsg.includes('✅') ? 'var(--success)' : '#DC2626',
            }}>
              {configMsg}
            </div>
          )}

          {/* Security Header */}
          <div className="glass-card animate-slide-up" style={{
            padding: 'var(--space-6)',
            border: editMode ? '2px solid rgba(245,158,11,0.5)' : '2px solid rgba(99,102,241,0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Edit Mode Banner */}
            {editMode && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                padding: '6px 0', textAlign: 'center',
                background: 'linear-gradient(90deg, #F59E0B, #D97706)',
                fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                🔓 Modo Edición Activo — Los cambios requieren confirmación
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: editMode ? 'var(--space-6)' : 0, marginBottom: 'var(--space-5)' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  <Shield size={20} style={{ color: editMode ? '#F59E0B' : 'var(--accent-primary)' }} />
                  🔐 Configuración de Integración
                </h3>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', maxWidth: 500 }}>
                  Credenciales de Microsoft Azure (Entra ID) y Dynamics 365 Business Central.
                  {config?.configSource === 'database' && ' Configurado desde la interfaz.'}
                  {config?.configSource === 'environment' && ' Usando variables de entorno del servidor.'}
                  {config?.configSource === 'none' && ' Sin configurar — Modo Demo activo.'}
                </p>
              </div>

              {!editMode ? (
                <button className="btn btn-secondary" onClick={handleEditClick} id="btn-edit-config" style={{ gap: 'var(--space-2)' }}>
                  <Edit3 size={16} /> Editar Configuración
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={cancelEdit} style={{ color: 'var(--text-muted)' }}>
                  <X size={16} /> Cancelar
                </button>
              )}
            </div>

            {/* Last test result badge */}
            {config?.lastTestedAt && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: '4px 12px', borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-4)',
                background: config.lastTestResult?.startsWith('SUCCESS') ? 'var(--success-soft)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${config.lastTestResult?.startsWith('SUCCESS') ? 'var(--success)' : 'rgba(239,68,68,0.3)'}`,
                fontSize: 11, fontWeight: 600,
                color: config.lastTestResult?.startsWith('SUCCESS') ? 'var(--success)' : '#DC2626',
              }}>
                {config.lastTestResult?.startsWith('SUCCESS') ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                Última prueba: {timeAgo(config.lastTestedAt)} — {config.lastTestResult?.startsWith('SUCCESS') ? 'Exitosa' : 'Fallida'}
              </div>
            )}

            {/* Config Fields */}
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {/* Tenant ID */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontFamily: 'monospace' }}>DYNAMICS_TENANT_ID</span> — Azure Directory (Tenant) ID
                </label>
                {editMode ? (
                  <input
                    type="text" className="form-input" value={formTenantId}
                    onChange={e => setFormTenantId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <code style={{ fontSize: 13, color: config?.tenantId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {config?.tenantId || 'No configurado'}
                    </code>
                  </div>
                )}
              </div>

              {/* Client ID */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontFamily: 'monospace' }}>DYNAMICS_CLIENT_ID</span> — Application (Client) ID
                </label>
                {editMode ? (
                  <input
                    type="text" className="form-input" value={formClientId}
                    onChange={e => setFormClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <code style={{ fontSize: 13, color: config?.clientId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {config?.clientId || 'No configurado'}
                    </code>
                  </div>
                )}
              </div>

              {/* Client Secret */}
              <div>
                <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>
                  <span style={{ fontFamily: 'monospace' }}>DYNAMICS_CLIENT_SECRET</span> — Client Secret Value
                </label>
                {editMode ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSecretField ? 'text' : 'password'}
                      className="form-input" value={formClientSecret}
                      onChange={e => setFormClientSecret(e.target.value)}
                      placeholder={config?.clientSecretSet ? 'Dejar vacío para mantener el actual' : 'Pegar Client Secret de Azure'}
                      style={{ fontFamily: 'monospace', fontSize: 13, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretField(!showSecretField)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                    >
                      {showSecretField ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <code style={{ fontSize: 13, color: config?.clientSecretSet ? 'var(--success)' : 'var(--text-muted)' }}>
                      {config?.clientSecretSet ? '●●●●●●●●●●●●●●●●●●●●' : 'No configurado'}
                    </code>
                    {config?.clientSecretSet && (
                      <CheckCircle2 size={14} style={{ color: 'var(--success)', marginLeft: 'auto' }} />
                    )}
                  </div>
                )}
              </div>

              {/* Environment + Company ID in row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontFamily: 'monospace' }}>DYNAMICS_ENVIRONMENT</span>
                  </label>
                  {editMode ? (
                    <select className="form-select" value={formEnvironment} onChange={e => setFormEnvironment(e.target.value)} style={{ fontSize: 13 }}>
                      <option value="production">Production</option>
                      <option value="sandbox">Sandbox</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <code style={{ fontSize: 13 }}>{config?.environment || 'production'}</code>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontFamily: 'monospace' }}>DYNAMICS_COMPANY_ID</span>
                  </label>
                  {editMode ? (
                    <input
                      type="text" className="form-input" value={formCompanyId}
                      onChange={e => setFormCompanyId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      style={{ fontFamily: 'monospace', fontSize: 13 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <Lock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <code style={{ fontSize: 13, color: config?.companyId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {config?.companyId || 'No configurado'}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Toggle (edit mode only) */}
              {editMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: formIsActive ? 'var(--success)' : 'rgba(100,100,100,0.3)',
                      position: 'relative', transition: 'background 200ms',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3,
                      left: formIsActive ? 23 : 3, transition: 'left 200ms',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                  <div>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: formIsActive ? 'var(--success)' : 'var(--text-muted)' }}>
                      {formIsActive ? 'Integración Activa' : 'Integración Inactiva'}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      {formIsActive ? 'Las credenciales de BD se usarán para conectar a Dynamics' : 'Se usarán variables de entorno o modo Demo'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Result */}
            {testResult && (
              <div style={{
                marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                background: testResult.success ? 'var(--success-soft)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${testResult.success ? 'var(--success)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-sm)', fontWeight: 600, color: testResult.success ? 'var(--success)' : '#DC2626' }}>
                  {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {testResult.message}
                </div>
              </div>
            )}

            {/* Action Buttons (edit mode) */}
            {editMode && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testing || !formTenantId || !formClientId}
                  style={{ flex: 1, gap: 'var(--space-2)' }}
                >
                  <TestTube2 size={16} />
                  {testing ? 'Probando conexión...' : '🧪 Probar Conexión'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveClick}
                  disabled={saving || !formTenantId || !formClientId}
                  style={{ flex: 1, gap: 'var(--space-2)' }}
                >
                  <Save size={16} />
                  {saving ? 'Guardando...' : '💾 Guardar Configuración'}
                </button>
              </div>
            )}
          </div>

          {/* Step-by-step Guide */}
          {!editMode && (
            <div className="glass-card animate-slide-up stagger-2" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-5)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                💡 Guía: Conectar con Dynamics 365 Business Central
              </h4>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {[
                  { step: 1, title: 'Crear cuenta Business Central', desc: 'Ve a dynamics.microsoft.com → Try for free. Necesitas email empresarial.' },
                  { step: 2, title: 'Registrar App en Azure Portal', desc: 'portal.azure.com → App registrations → New registration. Tipo: Single tenant.' },
                  { step: 3, title: 'Crear Client Secret', desc: 'App → Certificates & secrets → New client secret. ¡Copia el Value inmediatamente!' },
                  { step: 4, title: 'Asignar permisos API', desc: 'App → API permissions → Dynamics 365 Business Central → Financials.ReadWrite.All → Grant admin consent.' },
                  { step: 5, title: 'Registrar en Business Central', desc: 'BC → Microsoft Entra Applications → New → Pegar Client ID → State: Enabled → D365 BUS FULL ACCESS.' },
                  { step: 6, title: 'Configurar aquí', desc: 'Click "Editar Configuración" arriba, pega tus credenciales, prueba la conexión y guarda.' },
                ].map(item => (
                  <div key={item.step} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12, fontWeight: 800,
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ MODAL: Confirmation #1 — Enter Edit Mode ═══════════ */}
      {showConfirm1 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: 500, padding: 'var(--space-6)', animation: 'slideUp 200ms ease-out', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <Shield size={28} style={{ color: '#F59E0B' }} />
            </div>

            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              ¿Modificar configuración de integración?
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)', lineHeight: 1.6 }}>
              Estás a punto de editar las credenciales de conexión con
              <strong style={{ color: 'var(--text-primary)' }}> Microsoft Dynamics 365 Business Central</strong>.
            </p>
            <div style={{
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              fontSize: 'var(--font-xs)', color: '#D97706', fontWeight: 600,
              marginBottom: 'var(--space-5)',
            }}>
              ⚠️ Cambios incorrectos pueden afectar la sincronización en producción.
              Solo SuperAdmin tiene acceso a esta acción.
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm1(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={confirmEnterEditMode} style={{ flex: 1, background: '#F59E0B', borderColor: '#F59E0B' }}>
                <Unlock size={16} /> Sí, Editar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL: Confirmation #2 — Save Changes ═══════════ */}
      {showConfirm2 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: 500, padding: 'var(--space-6)', animation: 'slideUp 200ms ease-out', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <Save size={28} style={{ color: '#6366F1' }} />
            </div>

            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Confirmar cambios de configuración
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              Se reemplazará la configuración actual con los nuevos valores.
              {formIsActive ? ' La integración se activará inmediatamente.' : ' La integración permanecerá inactiva.'}
            </p>

            {/* Summary of changes */}
            <div style={{
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-subtle)',
              textAlign: 'left', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-5)',
            }}>
              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <div><strong>Tenant ID:</strong> <code>{formTenantId ? `${formTenantId.slice(0, 12)}...` : '—'}</code></div>
                <div><strong>Client ID:</strong> <code>{formClientId ? `${formClientId.slice(0, 12)}...` : '—'}</code></div>
                <div><strong>Client Secret:</strong> <code>{formClientSecret ? '••• (nuevo valor)' : '(sin cambios)'}</code></div>
                <div><strong>Entorno:</strong> <code>{formEnvironment}</code></div>
                <div><strong>Company ID:</strong> <code>{formCompanyId ? `${formCompanyId.slice(0, 12)}...` : '—'}</code></div>
                <div><strong>Estado:</strong> <span style={{ color: formIsActive ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>{formIsActive ? '🟢 Activa' : '⚪ Inactiva'}</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm2(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={confirmSaveConfig} style={{ flex: 1 }}>
                <Save size={16} /> Confirmar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
