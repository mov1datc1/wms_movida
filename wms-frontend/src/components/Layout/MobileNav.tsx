import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowDownToLine, ScanLine, Truck,
  ClipboardCheck, MapPin, Tag, Route, Database, ShieldCheck,
  RefreshCw, Settings, Menu, X, LogOut, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const quickNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', moduloKey: 'dashboard' },
  { to: '/recepcion', icon: ArrowDownToLine, label: 'Recepción', moduloKey: 'recepcion' },
  { to: '/picking', icon: ScanLine, label: 'Picking', moduloKey: 'picking' },
  { to: '/despacho', icon: Truck, label: 'Despacho', moduloKey: 'despacho' },
];

const allNavItems = [
  { section: 'General', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', moduloKey: 'dashboard' },
  ]},
  { section: 'Inventario', items: [
    { to: '/inventario', icon: Package, label: 'Stock por Lote', moduloKey: 'inventario' },
    { to: '/ubicaciones', icon: MapPin, label: 'Ubicaciones CEDIS', moduloKey: 'ubicaciones' },
  ]},
  { section: 'Operaciones', items: [
    { to: '/recepcion', icon: ArrowDownToLine, label: 'Recepción', moduloKey: 'recepcion' },
    { to: '/picking', icon: ScanLine, label: 'Picking FEFO', moduloKey: 'picking' },
    { to: '/despacho', icon: Truck, label: 'Despacho', moduloKey: 'despacho' },
    { to: '/conteo-ciclico', icon: ClipboardCheck, label: 'Conteo Cíclico', moduloKey: 'inventario' },
    { to: '/etiquetado', icon: Tag, label: 'Etiquetado', moduloKey: 'recepcion' },
  ]},
  { section: 'Trazabilidad', items: [
    { to: '/trazabilidad', icon: Route, label: 'Rastreo de Lotes', moduloKey: 'trazabilidad' },
  ]},
  { section: 'Administración', items: [
    { to: '/maestros', icon: Database, label: 'Datos Maestros', moduloKey: 'maestros' },
    { to: '/calidad', icon: ShieldCheck, label: 'Reglas Calidad', moduloKey: 'calidad' },
    { to: '/dynamics', icon: RefreshCw, label: 'Sync Dynamics', moduloKey: 'dynamics' },
    { to: '/admin', icon: Settings, label: 'Panel Admin', moduloKey: 'admin' },
  ]},
];

export function MobileNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, hasPermission, logout } = useAuth();

  const filteredSections = allNavItems.map(s => ({
    ...s,
    items: s.items.filter(item => hasPermission(item.moduloKey)),
  })).filter(s => s.items.length > 0);

  const filteredQuickNav = quickNavItems.filter(item => hasPermission(item.moduloKey));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {filteredQuickNav.map(item => {
          const Icon = item.icon;
          const isActive = item.to === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          className={`mobile-nav-item ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Menú</span>
        </button>
      </nav>

      {/* Fullscreen slide-up menu */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="mobile-menu-header">
              <div className="mobile-menu-header-left">
                <div className="mobile-menu-logo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6B8AFF' }}>
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="m7 8 3 3 7-7" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>TB WMS</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CEDIS Guatemala</div>
                </div>
              </div>
              <button className="mobile-menu-close" onClick={() => setMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* User card */}
            {user && (
              <div className="mobile-user-card">
                <div className="mobile-user-avatar">
                  {user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{user.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.rolNombre || 'Sin rol'}</div>
                </div>
                <button onClick={logout} className="mobile-logout-btn">
                  <LogOut size={16} />
                </button>
              </div>
            )}

            {/* Navigation sections */}
            <div className="mobile-menu-sections">
              {filteredSections.map(section => (
                <div key={section.section} className="mobile-menu-section">
                  <div className="mobile-menu-section-label">{section.section}</div>
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = item.to === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={`mobile-menu-link ${isActive ? 'active' : ''}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                        {isActive && <div className="mobile-menu-active-dot" />}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mobile-menu-footer">
              <Clock size={12} />
              <span>WMS v2.0 — CEDIS-GT</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
