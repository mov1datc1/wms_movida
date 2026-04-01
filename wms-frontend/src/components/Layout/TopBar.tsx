import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, ChevronRight, Warehouse, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWarehouse } from '../../contexts/WarehouseContext';

const routeNames: Record<string, { section: string; page: string }> = {
  '/': { section: 'General', page: 'Dashboard' },
  '/inventario': { section: 'Inventario', page: 'Stock por Lote' },
  '/ubicaciones': { section: 'Inventario', page: 'Ubicaciones CEDIS' },
  '/recepcion': { section: 'Operaciones', page: 'Recepción' },
  '/picking': { section: 'Operaciones', page: 'Picking FEFO' },
  '/despacho': { section: 'Operaciones', page: 'Despacho' },
  '/trazabilidad': { section: 'Trazabilidad', page: 'Rastreo de Lotes' },
  '/maestros': { section: 'Administración', page: 'Datos Maestros' },
  '/calidad': { section: 'Administración', page: 'Reglas Calidad' },
  '/dynamics': { section: 'Administración', page: 'Sync Dynamics' },
  '/admin': { section: 'Administración', page: 'Panel Admin' },
};

export function TopBar() {
  const location = useLocation();
  const route = routeNames[location.pathname] || { section: '', page: '' };
  const { user } = useAuth();
  const { warehouses, selectedWarehouse, setSelectedWarehouseId } = useWarehouse();
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Warehouse Selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-xs)',
              fontWeight: 600, borderRadius: 'var(--radius-md)',
            }}
            id="warehouse-selector"
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: selectedWarehouse?.activo ? 'var(--success)' : 'var(--text-muted)',
              flexShrink: 0,
            }} />
            <Warehouse size={14} />
            {selectedWarehouse?.nombre || 'Seleccionar CEDIS'}
            <ChevronDown size={13} style={{ opacity: 0.5 }} />
          </button>

          {showWarehouseDropdown && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowWarehouseDropdown(false)}
              />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 'var(--space-2)',
                background: '#FFFFFF', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 280, zIndex: 100, overflow: 'hidden', animation: 'slideDown 200ms ease-out',
              }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)',
                  fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Seleccionar Almacén
                </div>
                {warehouses.map((wh) => (
                  <button key={wh.id} onClick={() => { setSelectedWarehouseId(wh.id); setShowWarehouseDropdown(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)', width: '100%', border: 'none',
                      background: selectedWarehouse?.id === wh.id ? 'var(--accent-primary-soft)' : 'transparent',
                      cursor: wh.activo ? 'pointer' : 'not-allowed', transition: 'background 150ms',
                      fontFamily: 'var(--font-family)', textAlign: 'left',
                      opacity: wh.activo ? 1 : 0.5,
                    }}
                    disabled={!wh.activo}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: wh.activo ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{wh.nombre}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        {wh.ciudad || wh.direccion || wh.codigo}
                      </div>
                    </div>
                    {selectedWarehouse?.id === wh.id && (
                      <div style={{ marginLeft: 'auto', color: 'var(--accent-primary)', fontWeight: 700 }}>●</div>
                    )}
                  </button>
                ))}
                <div style={{
                  padding: 'var(--space-2) var(--space-4)', borderTop: '1px solid var(--border-subtle)',
                  fontSize: 'var(--font-xs)', color: 'var(--text-muted)',
                }}>
                  Los datos se filtran automáticamente por CEDIS
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />

        <div className="topbar-breadcrumb">
          {route.section} <ChevronRight size={14} /> <span>{route.page}</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Buscar SKU, lote, ubicación..." />
        </div>
        <button className="topbar-icon-btn" title="Notificaciones" id="btn-notifications">
          <Bell size={17} />
          <span className="topbar-notification-dot"></span>
        </button>
        <div className="topbar-user" id="user-menu">
          <div className="topbar-avatar">
            {user?.nombre.split(' ').map(n => n[0]).join('').substring(0, 2) || 'JP'}
          </div>
          <div>
            <div className="topbar-user-name">{user?.nombre || 'Usuario'}</div>
            <div className="topbar-user-role">{user?.rolNombre || 'Sin rol'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
