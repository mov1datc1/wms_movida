import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Clock, ArrowDownToLine, ArrowUpFromLine, Wifi, WifiOff, Zap, History, BarChart3, Settings } from 'lucide-react';
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

  // Load on mount
  useEffect(() => {
    loadStatus();
    loadStats();
    loadHistory();
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

  return (
    <div>
      <div className="page-header">
        <h1>Sincronización Dynamics 365</h1>
        <p>Integración bidireccional con Microsoft Dynamics 365 Business Central — ERP ↔ WMS</p>
      </div>

      {/* Connection Badge */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        {status && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)', background: status.mode === 'live' ? 'var(--success-soft)' : 'rgba(139,92,246,0.15)', border: `1px solid ${status.mode === 'live' ? 'var(--success)' : 'rgba(139,92,246,0.4)'}` }}>
            {status.mode === 'live' ? <Wifi size={14} style={{ color: 'var(--success)' }} /> : <WifiOff size={14} style={{ color: '#8B5CF6' }} />}
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: status.mode === 'live' ? 'var(--success)' : '#8B5CF6' }}>
              {status.mode === 'live' ? `Live — Tenant ${status.tenantId}` : '🎭 Modo Demo — Datos simulados'}
            </span>
          </div>
        )}
      </div>

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

      {/* TAB: Config */}
      {activeTab === 'config' && (
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-6)', maxWidth: 700 }}>
          <h3 style={{ marginBottom: 'var(--space-4)' }}>⚙️ Configuración de Conexión</h3>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
            Las credenciales de Dynamics 365 se configuran como variables de entorno en el servidor backend (Render).
          </p>

          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {[
              { key: 'DYNAMICS_TENANT_ID', label: 'Tenant ID (Azure)', value: status?.tenantId || 'No configurado' },
              { key: 'DYNAMICS_CLIENT_ID', label: 'Client ID (App Registration)', value: status?.configured ? '••••••••' : 'No configurado' },
              { key: 'DYNAMICS_CLIENT_SECRET', label: 'Client Secret', value: status?.configured ? '••••••••' : 'No configurado' },
              { key: 'DYNAMICS_ENVIRONMENT', label: 'Entorno', value: status?.environment || 'production' },
              { key: 'DYNAMICS_COMPANY_ID', label: 'Company ID', value: status?.configured ? '••••••••' : 'No configurado' },
            ].map((item) => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.key}</div>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                </div>
                <code style={{ fontSize: 'var(--font-xs)', color: status?.configured ? 'var(--success)' : 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                  {item.value}
                </code>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: '#8B5CF6', marginBottom: 'var(--space-2)' }}>
              💡 Para conectar con Dynamics 365 en producción:
            </div>
            <ol style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-4)', display: 'grid', gap: 'var(--space-1)' }}>
              <li>Registra una app en Azure Portal → Microsoft Entra ID</li>
              <li>Asigna permisos: Dynamics 365 Business Central → Financials.ReadWrite.All</li>
              <li>Copia Tenant ID, Client ID y Client Secret</li>
              <li>Agrega las variables en Render → Environment Variables</li>
              <li>Redeploy el backend</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
