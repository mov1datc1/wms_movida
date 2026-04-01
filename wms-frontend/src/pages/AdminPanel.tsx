import { useState, useEffect } from 'react';
import {
  Shield, Users, Settings, Plus, Edit2, Trash2, Save,
  CheckSquare, Square, Loader2, Lock, Image, RefreshCw, X,
  Warehouse, MapPin, ToggleLeft, ToggleRight, AlertTriangle
} from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';

import { API } from '../config/api';

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventario', label: 'Stock por Lote' },
  { key: 'ubicaciones', label: 'Ubicaciones CEDIS' },
  { key: 'recepcion', label: 'Recepción' },
  { key: 'picking', label: 'Picking FEFO' },
  { key: 'despacho', label: 'Despacho' },
  { key: 'trazabilidad', label: 'Rastreo de Lotes' },
  { key: 'maestros', label: 'Datos Maestros' },
  { key: 'calidad', label: 'Reglas Calidad' },
  { key: 'dynamics', label: 'Sync Dynamics' },
  { key: 'admin', label: 'Panel Admin' },
];

interface Role {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: { id: string; modulo: string }[];
  _count: { usuarios: number };
}

interface UserItem {
  id: string;
  email: string;
  nombre: string;
  rolId: string | null;
  almacenId: string | null;
  activo: boolean;
  rol: { nombre: string } | null;
}

interface PlatformConfig {
  id: string;
  logoUrl: string | null;
  nombre: string;
  subtitulo: string;
}

interface WarehouseItem {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  activo: boolean;
  _count: { locations: number; movements: number };
}

type AdminTab = 'roles' | 'users' | 'warehouses' | 'platform';

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [, setSettings] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshWarehouses } = useWarehouse();

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleModules, setRoleModules] = useState<string[]>([]);

  // User form
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRolId, setUserRolId] = useState('');
  const [userAlmacenId, setUserAlmacenId] = useState('');

  // Reset password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  // Platform
  const [platformName, setPlatformName] = useState('');
  const [platformSub, setPlatformSub] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');

  // Warehouse form
  const [showWhForm, setShowWhForm] = useState(false);
  const [editWhId, setEditWhId] = useState<string | null>(null);
  const [whCodigo, setWhCodigo] = useState('');
  const [whNombre, setWhNombre] = useState('');
  const [whDireccion, setWhDireccion] = useState('');
  const [whCiudad, setWhCiudad] = useState('');

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string; type: 'warehouse' | 'role' } | null>(null);

  // Confirm edit dialog
  const [confirmEdit, setConfirmEdit] = useState<{ id: string; nombre: string; newNombre: string } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [r, u, w, s] = await Promise.all([
        fetch(`${API}/admin/roles`).then(r => r.json()),
        fetch(`${API}/admin/users`).then(r => r.json()),
        fetch(`${API}/admin/warehouses`).then(r => r.json()),
        fetch(`${API}/admin/settings`).then(r => r.json()),
      ]);
      setRoles(r); setUsers(u); setWarehouses(w); setSettings(s);
      setPlatformName(s.nombre); setPlatformSub(s.subtitulo); setPlatformLogo(s.logoUrl || '');
    } catch { }
    setLoading(false);
  }

  function showMessage(m: string) { setMsg(m); setTimeout(() => setMsg(null), 4000); }

  // ============ ROLE HANDLERS ============
  const openRoleForm = (role?: Role) => {
    if (role) {
      setEditRoleId(role.id);
      setRoleName(role.nombre);
      setRoleDesc(role.descripcion || '');
      setRoleModules(role.permisos.map(p => p.modulo));
    } else {
      setEditRoleId(null);
      setRoleName('');
      setRoleDesc('');
      setRoleModules(['dashboard']);
    }
    setShowRoleForm(true);
  };

  const toggleModule = (mod: string) => {
    setRoleModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };

  const saveRole = async () => {
    const body = { nombre: roleName, descripcion: roleDesc, modulos: roleModules };
    if (editRoleId) {
      await fetch(`${API}/admin/roles/${editRoleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch(`${API}/admin/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowRoleForm(false);
    showMessage(`✅ Rol "${roleName}" ${editRoleId ? 'actualizado' : 'creado'}`);
    loadAll();
  };

  const handleDeleteRole = async (id: string) => {
    try {
      const res = await fetch(`${API}/admin/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); showMessage(`❌ ${e.message}`); return; }
      showMessage('✅ Rol eliminado');
      loadAll();
    } catch { showMessage('❌ Error al eliminar'); }
    setConfirmDelete(null);
  };

  // ============ USER HANDLERS ============
  const openUserForm = (user?: UserItem) => {
    if (user) {
      setEditUserId(user.id);
      setUserName(user.nombre);
      setUserEmail(user.email);
      setUserPassword('');
      setUserRolId(user.rolId || '');
      setUserAlmacenId(user.almacenId || '');
    } else {
      setEditUserId(null);
      setUserName(''); setUserEmail(''); setUserPassword('');
      setUserRolId(''); setUserAlmacenId('');
    }
    setShowUserForm(true);
  };

  const saveUser = async () => {
    if (editUserId) {
      await fetch(`${API}/admin/users/${editUserId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: userName, rolId: userRolId || null, almacenId: userAlmacenId || null }),
      });
    } else {
      await fetch(`${API}/admin/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, nombre: userName, password: userPassword, rolId: userRolId || null, almacenId: userAlmacenId || null }),
      });
    }
    setShowUserForm(false);
    showMessage(`✅ Usuario ${editUserId ? 'actualizado' : 'creado'}`);
    loadAll();
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    await fetch(`${API}/admin/users/${resetUserId}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    setResetUserId(null); setResetPassword('');
    showMessage('✅ Contraseña reseteada');
  };

  const toggleUserActive = async (user: UserItem) => {
    await fetch(`${API}/admin/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !user.activo }),
    });
    loadAll();
  };

  const savePlatform = async () => {
    await fetch(`${API}/admin/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: platformName, subtitulo: platformSub, logoUrl: platformLogo || null }),
    });
    showMessage('✅ Configuración actualizada');
    loadAll();
  };

  // ============ WAREHOUSE HANDLERS ============
  const openWhForm = (wh?: WarehouseItem) => {
    if (wh) {
      setEditWhId(wh.id);
      setWhCodigo(wh.codigo);
      setWhNombre(wh.nombre);
      setWhDireccion(wh.direccion || '');
      setWhCiudad(wh.ciudad || '');
    } else {
      setEditWhId(null);
      setWhCodigo(''); setWhNombre(''); setWhDireccion(''); setWhCiudad('');
    }
    setShowWhForm(true);
  };

  const saveWarehouse = async () => {
    const body = { codigo: whCodigo, nombre: whNombre, direccion: whDireccion || null, ciudad: whCiudad || null };

    // If editing and name changed, show a confirmation first
    if (editWhId) {
      const original = warehouses.find(w => w.id === editWhId);
      if (original && original.nombre !== whNombre && !confirmEdit) {
        setConfirmEdit({ id: editWhId, nombre: original.nombre, newNombre: whNombre });
        return;
      }
    }

    try {
      const url = editWhId ? `${API}/admin/warehouses/${editWhId}` : `${API}/admin/warehouses`;
      const res = await fetch(url, {
        method: editWhId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); showMessage(`❌ ${e.message}`); return; }
      setShowWhForm(false);
      setConfirmEdit(null);
      showMessage(`✅ Almacén "${whNombre}" ${editWhId ? 'actualizado' : 'creado'}`);
      loadAll();
      refreshWarehouses();
    } catch { showMessage('❌ Error al guardar'); }
  };

  const handleDeleteWarehouse = async (id: string) => {
    try {
      const res = await fetch(`${API}/admin/warehouses/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); showMessage(`❌ ${e.message}`); return; }
      showMessage('✅ Almacén eliminado');
      loadAll();
      refreshWarehouses();
    } catch { showMessage('❌ Error al eliminar'); }
    setConfirmDelete(null);
  };

  const toggleWarehouseActive = async (wh: WarehouseItem) => {
    await fetch(`${API}/admin/warehouses/${wh.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !wh.activo }),
    });
    showMessage(`✅ Almacén ${wh.activo ? 'desactivado' : 'activado'}`);
    loadAll();
    refreshWarehouses();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando panel de administración...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Panel de Administración</h1>
        <p>Gestión de roles, usuarios, almacenes y configuración de la plataforma</p>
      </div>

      {msg && (
        <div style={{
          background: msg.includes('✅') ? 'var(--success-soft)' : '#FEF2F2',
          border: `1px solid ${msg.includes('✅') ? 'var(--success)' : '#FCA5A5'}`,
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)', fontWeight: 600,
          color: msg.includes('✅') ? 'var(--success)' : '#DC2626', animation: 'slideDown 200ms ease-out',
        }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Roles y Permisos
        </button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Usuarios ({users.length})
        </button>
        <button className={`tab ${tab === 'warehouses' ? 'active' : ''}`} onClick={() => setTab('warehouses')}>
          <Warehouse size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Almacenes ({warehouses.length})
        </button>
        <button className={`tab ${tab === 'platform' ? 'active' : ''}`} onClick={() => setTab('platform')}>
          <Settings size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Plataforma
        </button>
      </div>

      {/* ============ ROLES TAB ============ */}
      {tab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary" onClick={() => openRoleForm()}>
              <Plus size={16} /> Nuevo Rol
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>
            {roles.map(role => (
              <div key={role.id} className="glass-card animate-slide-up" style={{ padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
                      {role.nombre}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {role.descripcion || 'Sin descripción'} · {role._count.usuarios} usuario(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openRoleForm(role)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    {role.nombre !== 'SuperAdmin' && (
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete({ id: role.id, nombre: role.nombre, type: 'role' })}
                        title="Eliminar" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Módulos Permitidos
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {ALL_MODULES.map(m => {
                    const has = role.permisos.some(p => p.modulo === m.key);
                    return (
                      <span key={m.key} style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                        background: has ? 'var(--accent-primary-soft)' : 'var(--bg-elevated)',
                        color: has ? 'var(--accent-primary)' : 'var(--text-muted)',
                        opacity: has ? 1 : 0.5,
                      }}>{m.label}</span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Role Form Modal */}
          {showRoleForm && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-card" style={{ width: 520, padding: 'var(--space-6)', animation: 'slideUp 300ms ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                  <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{editRoleId ? 'Editar' : 'Crear'} Rol</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowRoleForm(false)}><X size={16} /></button>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre del Rol</label>
                  <input type="text" className="form-input" value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="Ej: Supervisor" />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <input type="text" className="form-input" value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="Descripción del rol" />
                </div>
                <div className="form-group">
                  <label className="form-label">Módulos Permitidos</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {ALL_MODULES.map(m => (
                      <button key={m.key} onClick={() => toggleModule(m.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)', border: `1px solid ${roleModules.includes(m.key) ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)', background: roleModules.includes(m.key) ? 'var(--accent-primary-soft)' : 'white',
                          cursor: 'pointer', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-family)',
                          color: roleModules.includes(m.key) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          transition: 'all 150ms',
                        }}>
                        {roleModules.includes(m.key) ? <CheckSquare size={14} /> : <Square size={14} />}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-ghost" onClick={() => setShowRoleForm(false)} style={{ flex: 1 }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveRole} disabled={!roleName} style={{ flex: 1 }}>
                    <Save size={16} /> {editRoleId ? 'Guardar Cambios' : 'Crear Rol'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ USERS TAB ============ */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-primary" onClick={() => openUserForm()}>
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>

          <div className="data-table-wrapper glass-card animate-slide-up">
            <div className="data-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>CEDIS</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: 11, fontWeight: 700,
                          }}>
                            {user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          {user.nombre}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--font-xs)' }}>{user.email}</td>
                      <td><span className="badge badge-liberado">{user.rol?.nombre || 'Sin rol'}</span></td>
                      <td style={{ fontSize: 'var(--font-xs)' }}>{warehouses.find(w => w.id === user.almacenId)?.nombre || '—'}</td>
                      <td>
                        <button onClick={() => toggleUserActive(user)}
                          className={`badge ${user.activo ? 'badge-liberado' : 'badge-bloqueado'}`}
                          style={{ cursor: 'pointer', border: 'none' }}>
                          {user.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openUserForm(user)} title="Editar">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setResetUserId(user.id)} title="Reset clave"
                            style={{ color: 'var(--warning)' }}>
                            <Lock size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Form Modal */}
          {showUserForm && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-card" style={{ width: 480, padding: 'var(--space-6)', animation: 'slideUp 300ms ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                  <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{editUserId ? 'Editar' : 'Crear'} Usuario</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowUserForm(false)}><X size={16} /></button>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre Completo</label>
                  <input type="text" className="form-input" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Nombre del usuario" />
                </div>
                {!editUserId && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="usuario@empresa.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contraseña Inicial</label>
                      <input type="text" className="form-input" value={userPassword} onChange={e => setUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select className="form-select" value={userRolId} onChange={e => setUserRolId(e.target.value)}>
                    <option value="">Sin rol asignado</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">CEDIS Principal</label>
                  <select className="form-select" value={userAlmacenId} onChange={e => setUserAlmacenId(e.target.value)}>
                    <option value="">Todos los CEDIS</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-ghost" onClick={() => setShowUserForm(false)} style={{ flex: 1 }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveUser} disabled={!userName || (!editUserId && (!userEmail || !userPassword))} style={{ flex: 1 }}>
                    <Save size={16} /> {editUserId ? 'Guardar' : 'Crear Usuario'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Password Modal */}
          {resetUserId && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-card" style={{ width: 400, padding: 'var(--space-6)', animation: 'slideUp 300ms ease-out' }}>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Lock size={18} style={{ color: 'var(--warning)' }} />
                  Resetear Contraseña
                </h2>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                  Usuario: <strong>{users.find(u => u.id === resetUserId)?.nombre}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">Nueva Contraseña</label>
                  <input type="text" className="form-input" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Nueva contraseña" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <button className="btn btn-ghost" onClick={() => setResetUserId(null)} style={{ flex: 1 }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleResetPassword} disabled={!resetPassword} style={{ flex: 1 }}>
                    <RefreshCw size={16} /> Resetear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ WAREHOUSES / ALMACENES TAB ============ */}
      {tab === 'warehouses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
              Los almacenes pueden llamarse CEDIS, Bodega, Centro de Distribución o cualquier nombre.
            </div>
            <button className="btn btn-primary" onClick={() => openWhForm()}>
              <Plus size={16} /> Nuevo Almacén
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 'var(--space-5)' }}>
            {warehouses.map(wh => (
              <div key={wh.id} className="glass-card animate-slide-up" style={{ padding: 'var(--space-5)', position: 'relative', overflow: 'hidden' }}>
                {/* Active/Inactive ribbon */}
                {!wh.activo && (
                  <div style={{
                    position: 'absolute', top: 12, right: -28, background: '#DC2626', color: 'white',
                    padding: '2px 32px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    transform: 'rotate(45deg)', textTransform: 'uppercase',
                  }}>Inactivo</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: wh.activo ? 'var(--success)' : 'var(--danger)',
                      }} />
                      <Warehouse size={18} style={{ color: 'var(--accent-primary)' }} />
                      {wh.nombre}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{wh.codigo}</span>
                      {wh.ciudad && (
                        <>
                          <span>·</span>
                          <MapPin size={12} style={{ flexShrink: 0 }} />
                          {wh.ciudad}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleWarehouseActive(wh)}
                      title={wh.activo ? 'Desactivar' : 'Activar'} style={{ color: wh.activo ? 'var(--success)' : 'var(--text-muted)' }}>
                      {wh.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openWhForm(wh)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDelete({ id: wh.id, nombre: wh.nombre, type: 'warehouse' })}
                      title="Eliminar" style={{ color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {wh.direccion && (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                    <MapPin size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    {wh.direccion}
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <div style={{
                    flex: 1, padding: 'var(--space-3)', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {wh._count.locations}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Ubicaciones
                    </div>
                  </div>
                  <div style={{
                    flex: 1, padding: 'var(--space-3)', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                      {wh._count.movements}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Movimientos
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warehouse Form Modal */}
          {showWhForm && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-card" style={{ width: 520, padding: 'var(--space-6)', animation: 'slideUp 300ms ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                  <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Warehouse size={20} style={{ color: 'var(--accent-primary)' }} />
                    {editWhId ? 'Editar' : 'Crear'} Almacén
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowWhForm(false); setConfirmEdit(null); }}><X size={16} /></button>
                </div>

                <div className="form-group">
                  <label className="form-label">Código del Almacén</label>
                  <input type="text" className="form-input" value={whCodigo} onChange={e => setWhCodigo(e.target.value.toUpperCase())}
                    placeholder="Ej: CEDIS-GT, BOD-DEV, CD-MIXCO" style={{ fontFamily: 'monospace', fontWeight: 600 }}
                    disabled={!!editWhId} />
                  {!editWhId && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Código único — no se puede cambiar después de crear
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Almacén</label>
                  <input type="text" className="form-input" value={whNombre} onChange={e => setWhNombre(e.target.value)}
                    placeholder="Ej: CEDIS Guatemala, Bodega Devoluciones, Centro Distribución" />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Puede ser CEDIS, Bodega, Centro de Distribución, o cualquier nombre descriptivo
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Ciudad</label>
                    <input type="text" className="form-input" value={whCiudad} onChange={e => setWhCiudad(e.target.value)}
                      placeholder="Ej: Guatemala City" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección</label>
                    <input type="text" className="form-input" value={whDireccion} onChange={e => setWhDireccion(e.target.value)}
                      placeholder="Ej: Zona 12, Km 15.5" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
                  <button className="btn btn-ghost" onClick={() => { setShowWhForm(false); setConfirmEdit(null); }} style={{ flex: 1 }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveWarehouse} disabled={!whCodigo || !whNombre} style={{ flex: 1 }}>
                    <Save size={16} /> {editWhId ? 'Guardar Cambios' : 'Crear Almacén'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ PLATFORM TAB ============ */}
      {tab === 'platform' && (
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-6)', maxWidth: 600 }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Image size={20} style={{ color: 'var(--accent-primary)' }} />
            Configuración de Plataforma
          </h2>

          <div className="form-group">
            <label className="form-label">Nombre de la Plataforma</label>
            <input type="text" className="form-input" value={platformName} onChange={e => setPlatformName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Subtítulo</label>
            <input type="text" className="form-input" value={platformSub} onChange={e => setPlatformSub(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">URL del Logo</label>
            <input type="text" className="form-input" value={platformLogo} onChange={e => setPlatformLogo(e.target.value)}
              placeholder="https://ejemplo.com/logo.png" />
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
              📐 <strong>Medida recomendada:</strong> 200 × 60 px · <strong>Formato:</strong> PNG o SVG con fondo transparente
            </div>
          </div>

          {platformLogo && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Vista previa:</div>
              <img src={platformLogo} alt="Logo" style={{ maxWidth: 200, maxHeight: 60, objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}

          <button className="btn btn-primary" onClick={savePlatform} style={{ marginTop: 'var(--space-5)' }}>
            <Save size={16} /> Guardar Configuración
          </button>
        </div>
      )}

      {/* ============ CONFIRM DELETE POPUP ============ */}
      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: 440, padding: 'var(--space-6)', animation: 'slideUp 200ms ease-out', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <AlertTriangle size={28} style={{ color: '#DC2626' }} />
            </div>

            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              ¿Eliminar {confirmDelete.type === 'warehouse' ? 'almacén' : 'rol'}?
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
              Estás a punto de eliminar <strong style={{ color: 'var(--danger)' }}>"{confirmDelete.nombre}"</strong>.
            </p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              {confirmDelete.type === 'warehouse'
                ? 'Esta acción no se puede deshacer. Solo se pueden eliminar almacenes sin ubicaciones ni movimientos asociados.'
                : 'Esta acción no se puede deshacer. Solo se pueden eliminar roles sin usuarios asignados.'
              }
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)} style={{ flex: 1, fontWeight: 600 }}>
                Cancelar
              </button>
              <button className="btn" onClick={() => {
                if (confirmDelete.type === 'warehouse') handleDeleteWarehouse(confirmDelete.id);
                else handleDeleteRole(confirmDelete.id);
              }} style={{
                flex: 1, fontWeight: 600, background: '#DC2626', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', cursor: 'pointer',
              }}>
                <Trash2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ CONFIRM EDIT NAME POPUP ============ */}
      {confirmEdit && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="glass-card" style={{ width: 440, padding: 'var(--space-6)', animation: 'slideUp 200ms ease-out', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--warning-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <AlertTriangle size={28} style={{ color: 'var(--warning)' }} />
            </div>

            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              ¿Cambiar nombre del almacén?
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
              El nombre cambiará de <strong>"{confirmEdit.nombre}"</strong> a <strong style={{ color: 'var(--accent-primary)' }}>"{confirmEdit.newNombre}"</strong>.
              <br />Esto se reflejará en todo el sistema.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmEdit(null)} style={{ flex: 1, fontWeight: 600 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveWarehouse} style={{ flex: 1, fontWeight: 600 }}>
                <Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sí, Cambiar Nombre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
