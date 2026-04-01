import { useState } from 'react';
import { RefreshCw, CheckCircle2, Clock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

interface SyncEvent {
  id: string;
  tipo: 'inbound' | 'outbound';
  entidad: string;
  registros: number;
  estado: 'success' | 'error' | 'pending';
  hora: string;
  detalle: string;
}

const syncHistory: SyncEvent[] = [
  { id: 'SY001', tipo: 'inbound', entidad: 'SKU Master', registros: 16, estado: 'success', hora: '08:00:00', detalle: 'Catálogo completo sincronizado desde Dynamics' },
  { id: 'SY002', tipo: 'inbound', entidad: 'Órdenes de Compra', registros: 3, estado: 'success', hora: '08:15:00', detalle: 'OC pendientes recibidas' },
  { id: 'SY003', tipo: 'inbound', entidad: 'Pedidos Restaurante', registros: 5, estado: 'success', hora: '09:00:00', detalle: 'Pedidos del día descargados' },
  { id: 'SY004', tipo: 'outbound', entidad: 'Recepciones Confirmadas', registros: 2, estado: 'success', hora: '10:30:00', detalle: 'Confirmaciones de recibo enviadas a Dynamics' },
  { id: 'SY005', tipo: 'outbound', entidad: 'Despachos Confirmados', registros: 1, estado: 'success', hora: '11:45:00', detalle: 'Confirmación ORD-006 enviada' },
  { id: 'SY006', tipo: 'outbound', entidad: 'Ajustes de Inventario', registros: 1, estado: 'error', hora: '12:00:00', detalle: 'Error de conexión – reintentando...' },
  { id: 'SY007', tipo: 'inbound', entidad: 'Restaurantes', registros: 10, estado: 'success', hora: '06:00:00', detalle: 'Lista actualizada de destinos' },
];

export function DynamicsSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('Hace 45 minutos');

  const triggerSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync('Justo ahora');
    }, 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Sincronización Dynamics</h1>
        <p>Integración bidireccional con Microsoft Dynamics 365 — ERP administrativo ↔ WMS operativo</p>
      </div>

      {/* Sync Status */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-icon info" style={{ marginBottom: 'var(--space-3)' }}>
            <RefreshCw size={20} />
          </div>
          <div className="stat-card-value">Active</div>
          <div className="stat-card-label">Estado Conexión</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value">{syncHistory.filter((s) => s.estado === 'success').length}</div>
          <div className="stat-card-label">Syncs Exitosos Hoy</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
            {syncHistory.filter((s) => s.estado === 'error').length}
          </div>
          <div className="stat-card-label">Errores</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value" style={{ fontSize: 'var(--font-lg)' }}>{lastSync}</div>
          <div className="stat-card-label">Última Sincronización</div>
        </div>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <button
          className="btn btn-primary"
          onClick={triggerSync}
          disabled={syncing}
          id="btn-sync-dynamics"
        >
          <RefreshCw size={16} className={syncing ? 'spinning' : ''} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
        </button>
        <button className="btn btn-secondary">
          <Clock size={16} /> Ver Programación
        </button>
      </div>

      {/* Integration Map */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <div className="glass-card animate-slide-up stagger-1" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <ArrowDownToLine size={20} style={{ color: 'var(--accent-secondary)' }} />
            <div style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>Dynamics → WMS</div>
          </div>
          {[
            'Catálogo SKU Maestro',
            'Proveedores',
            'Restaurantes / Clientes Internos',
            'Órdenes de Compra',
            'Órdenes de Transferencia',
            'Pedidos de Salida a Restaurante',
            'Unidades de Medida',
            'Estados Maestros',
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) 0',
              fontSize: 'var(--font-sm)',
              color: 'var(--text-secondary)',
            }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-secondary)' }} />
              {item}
            </div>
          ))}
        </div>

        <div className="glass-card animate-slide-up stagger-2" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <ArrowUpFromLine size={20} style={{ color: 'var(--accent-primary)' }} />
            <div style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>WMS → Dynamics</div>
          </div>
          {[
            'Recepción Confirmada',
            'Diferencias de Recibo',
            'Ajustes Aprobados',
            'Salidas Confirmadas',
            'Consumo por Lote',
            'Devoluciones',
            'Mermas',
            'Trazabilidad por Documento',
            'Inventario Consolidado',
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) 0',
              fontSize: 'var(--font-sm)',
              color: 'var(--text-secondary)',
            }}>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-primary)' }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Sync History */}
      <div className="data-table-wrapper glass-card animate-slide-up stagger-3">
        <div className="data-table-header">
          <div className="data-table-title">📋 Historial de Sincronización</div>
        </div>
        <div className="data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Dirección</th>
                <th>Entidad</th>
                <th>Registros</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {syncHistory.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{ev.hora}</td>
                  <td>
                    {ev.tipo === 'inbound' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-secondary)' }}>
                        <ArrowDownToLine size={14} /> DYN → WMS
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)' }}>
                        <ArrowUpFromLine size={14} /> WMS → DYN
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ev.entidad}</td>
                  <td>{ev.registros}</td>
                  <td>
                    {ev.estado === 'success' ? (
                      <span className="badge badge-liberado">✅ Éxito</span>
                    ) : ev.estado === 'error' ? (
                      <span className="badge badge-bloqueado">❌ Error</span>
                    ) : (
                      <span className="badge badge-pendiente">⏳ Pendiente</span>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--font-xs)', maxWidth: 300 }}>{ev.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
