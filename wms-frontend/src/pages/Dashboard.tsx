import { useState, useEffect } from 'react';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Package, Layers, Boxes, ClipboardList,
  TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight,
  ArrowDownToLine, Truck, RotateCw, Loader2, Wifi
} from 'lucide-react';
import { dailyMovements, zoneDistribution, dispatchByRestaurant } from '../data/mockData';

import { API } from '../config/api';

interface DashboardStats {
  skusActivos: number;
  lotesEnStock: number;
  ubicaciones: number;
  fillRate: number;
  pedidosPendientes: number;
  lotesPorVencer: number;
}

interface Movement {
  id: string;
  tipoMovimiento: string;
  cantidad: number;
  usuario: string;
  motivo: string;
  fechaHora: string;
  sku?: { codigoDynamics: string; descripcion: string };
  fromLocation?: { codigo: string } | null;
  toLocation?: { codigo: string } | null;
}

const movementIcons: Record<string, { icon: React.ReactNode; bg: string }> = {
  ENTRADA: { icon: <ArrowDownToLine size={14} />, bg: 'var(--success-soft)' },
  SALIDA: { icon: <Truck size={14} />, bg: 'var(--info-soft)' },
  TRASIEGO: { icon: <RotateCw size={14} />, bg: 'var(--warning-soft)' },
  AJUSTE: { icon: <AlertTriangle size={14} />, bg: 'var(--danger-soft)' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 'var(--font-xs)',
      }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, margin: '2px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const { selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const whParam = selectedWarehouseId ? `almacenId=${selectedWarehouseId}` : '';
        const [statsRes, movRes] = await Promise.all([
          fetch(`${API}/dashboard/stats?${whParam}`),
          fetch(`${API}/movements?limit=5&${whParam}`),
        ]);
        setStats(await statsRes.json());
        setMovements(await movRes.json());
        setConnected(true);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [selectedWarehouseId]);

  const statCards = stats ? [
    { label: 'SKUs Activos', value: stats.skusActivos.toString(), trend: 'live', trendDir: 'up' as const, icon: <Package size={20} />, color: 'purple' },
    { label: 'Lotes en Stock', value: stats.lotesEnStock.toString(), trend: 'live', trendDir: 'up' as const, icon: <Layers size={20} />, color: 'teal' },
    { label: 'Ubicaciones', value: stats.ubicaciones.toString(), trend: `${stats.fillRate}% ocupación`, trendDir: 'up' as const, icon: <Boxes size={20} />, color: 'info' },
    { label: 'Pedidos Pendientes', value: stats.pedidosPendientes.toString(), trend: 'hoy', trendDir: 'up' as const, icon: <ClipboardList size={20} />, color: 'warning' },
    { label: 'Fill Rate', value: `${stats.fillRate}%`, trend: 'tiempo real', trendDir: 'up' as const, icon: <TrendingUp size={20} />, color: 'success' },
    { label: 'Lotes por Vencer', value: stats.lotesPorVencer.toString(), trend: '< 7 días', trendDir: stats.lotesPorVencer > 0 ? 'down' as const : 'up' as const, icon: <AlertTriangle size={20} />, color: 'danger' },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard Operativo</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Vista general del CEDIS Taco Bell Guatemala — {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {connected && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
              color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
              <Wifi size={10} /> Supabase Live
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
          <div>Conectando con Supabase...</div>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="stat-grid">
            {statCards.map((stat, i) => (
              <div key={stat.label} className={`stat-card glass-card stagger-${i + 1}`}>
                <div className="stat-card-header">
                  <div className={`stat-card-icon ${stat.color}`}>{stat.icon}</div>
                  <div className={`stat-card-trend ${stat.trendDir}`}>
                    {stat.trendDir === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {stat.trend}
                  </div>
                </div>
                <div className="stat-card-value">{stat.value}</div>
                <div className="stat-card-label">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="charts-grid">
            <div className="chart-card glass-card animate-slide-up stagger-2">
              <div className="chart-title">Movimientos por Día</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyMovements}>
                  <defs>
                    <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                  <XAxis dataKey="dia" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                  <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#7C3AED" fill="url(#gradEntradas)" strokeWidth={2} />
                  <Area type="monotone" dataKey="salidas" name="Salidas" stroke="#14B8A6" fill="url(#gradSalidas)" strokeWidth={2} />
                  <Area type="monotone" dataKey="trasiegos" name="Trasiegos" stroke="#F59E0B" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card glass-card animate-slide-up stagger-3">
              <div className="chart-title">Distribución por Zona</div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={zoneDistribution} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">
                    {zoneDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => (
                    <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                  )} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dispatch Chart */}
          <div className="chart-card glass-card animate-slide-up stagger-4" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="chart-title">Despachos por Restaurante (últimos 7 días)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dispatchByRestaurant} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="despachos" name="Despachos" radius={[6, 6, 0, 0]}>
                  {dispatchByRestaurant.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Row */}
          <div className="charts-grid">
            {/* Connection status */}
            <div className="glass-card animate-slide-up stagger-5">
              <div className="data-table-header">
                <div className="data-table-title">📡 Estado de Conexión</div>
                <span className="badge badge-liberado">En línea</span>
              </div>
              {[
                { label: 'Backend NestJS', status: API.replace('/api', ''), ok: connected },
                { label: 'Supabase PostgreSQL', status: 'us-west-2', ok: connected },
                { label: 'SKUs en DB', status: `${stats?.skusActivos || 0} registros`, ok: true },
                { label: 'Ubicaciones', status: `${stats?.ubicaciones || 0} slots`, ok: true },
                { label: 'Fill Rate CEDIS', status: `${stats?.fillRate || 0}%`, ok: (stats?.fillRate || 0) < 90 },
              ].map((item) => (
                <div key={item.label} className="alert-item">
                  <div className={`alert-dot ${item.ok ? 'info' : 'danger'}`}></div>
                  <div className="alert-text">{item.label}</div>
                  <div className="alert-time" style={{ fontWeight: 600 }}>{item.status}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="glass-card animate-slide-up stagger-6" style={{ padding: 'var(--space-5)' }}>
              <div className="chart-title">Últimos Movimientos {movements.length > 0 ? '(Live)' : '(Sin movimientos aún)'}</div>
              {movements.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                  <ArrowDownToLine size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
                  <div>No hay movimientos registrados aún.</div>
                  <div style={{ fontSize: 'var(--font-xs)', marginTop: 'var(--space-2)' }}>
                    Registra una recepción para ver los movimientos aquí.
                  </div>
                </div>
              ) : (
                movements.slice(0, 5).map((mov) => {
                  const mi = movementIcons[mov.tipoMovimiento];
                  return (
                    <div key={mov.id} className="timeline-item">
                      <div className="timeline-dot" style={{ background: mi?.bg || 'var(--bg-elevated)' }}>
                        {mi?.icon}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-title">
                          {mov.tipoMovimiento} — {mov.sku?.descripcion || 'SKU'}
                        </div>
                        <div className="timeline-desc">
                          {mov.fromLocation?.codigo || '—'} → {mov.toLocation?.codigo || '—'} · {mov.cantidad} UN · {mov.usuario}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
