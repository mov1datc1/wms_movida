import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, MapPin, Database,
  RefreshCw, Clock, ScanLine, Truck, ShieldCheck, Route,
  ArrowDownToLine, Settings, LogOut, Tag, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  moduloKey: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'General',
    items: [
      { to: '/', icon: <LayoutDashboard size={17} />, label: 'Dashboard', moduloKey: 'dashboard' },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { to: '/inventario', icon: <Package size={17} />, label: 'Stock por Lote', moduloKey: 'inventario' },
      { to: '/ubicaciones', icon: <MapPin size={17} />, label: 'Ubicaciones CEDIS', moduloKey: 'ubicaciones' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/recepcion', icon: <ArrowDownToLine size={17} />, label: 'Recepción', moduloKey: 'recepcion' },
      { to: '/picking', icon: <ScanLine size={17} />, label: 'Picking FEFO', moduloKey: 'picking' },
      { to: '/despacho', icon: <Truck size={17} />, label: 'Despacho', moduloKey: 'despacho' },
      { to: '/conteo-ciclico', icon: <ClipboardCheck size={17} />, label: 'Conteo Cíclico', moduloKey: 'inventario' },
      { to: '/etiquetado', icon: <Tag size={17} />, label: 'Etiquetado', moduloKey: 'recepcion' },
    ],
  },
  {
    title: 'Trazabilidad',
    items: [
      { to: '/trazabilidad', icon: <Route size={17} />, label: 'Rastreo de Lotes', moduloKey: 'trazabilidad' },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/maestros', icon: <Database size={17} />, label: 'Datos Maestros', moduloKey: 'maestros' },
      { to: '/calidad', icon: <ShieldCheck size={17} />, label: 'Reglas Calidad', moduloKey: 'calidad' },
      { to: '/dynamics', icon: <RefreshCw size={17} />, label: 'Sync Dynamics', moduloKey: 'dynamics' },
      { to: '/admin', icon: <Settings size={17} />, label: 'Panel Admin', moduloKey: 'admin' },
    ],
  },
];

export function Sidebar() {
  const [time, setTime] = useState(new Date());
  const { user, hasPermission, logout } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter sections to only show permitted modules
  const filteredSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => hasPermission(item.moduloKey)),
  })).filter(section => section.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6B8AFF' }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="m7 8 3 3 7-7" />
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-title">TB WMS</div>
            <div className="sidebar-logo-subtitle">CEDIS Guatemala</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-label">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className="sidebar-badge">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)',
            background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6B8AFF, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>
              {user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.nombre}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {user.rolNombre || 'Sin rol'}
              </div>
            </div>
            <button onClick={logout} title="Cerrar sesión"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.3)', padding: 4,
              }}>
              <LogOut size={14} />
            </button>
          </div>
        )}
        <div className="sidebar-clock">
          <Clock size={12} />
          {time.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          {' — '}
          {time.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
        <div className="sidebar-version">WMS v2.0 — CEDIS-GT</div>
      </div>
    </aside>
  );
}
