import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouse } from '../contexts/WarehouseContext';
import { Search, ArrowUpDown, Loader2, PackageOpen, Wifi, Tag } from 'lucide-react';

import { API } from '../config/api';

interface Lot {
  id: string;
  lote: string;
  fechaVencimiento: string | null;
  cantidadDisponible: number;
  cantidadReservada: number;
  estadoCalidad: string;
  proveedorNombre: string;
  sku: { codigoDynamics: string; descripcion: string; categoria: string; temperaturaRequerida: string };
  ubicacion: { codigo: string; zona: string } | null;
}

function getDaysUntilExpiry(date: string | null): number {
  if (!date) return 999;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getExpiryClass(days: number): string {
  if (days <= 3) return 'expiry-critical';
  if (days <= 7) return 'expiry-warning';
  if (days <= 14) return 'expiry-caution';
  return 'expiry-ok';
}

export function Inventory() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [sortField, setSortField] = useState<'vencimiento' | 'cantidad' | 'sku'>('vencimiento');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { selectedWarehouseId } = useWarehouse();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadLots() {
      try {
        const whParam = selectedWarehouseId ? `?almacenId=${selectedWarehouseId}` : '';
        const res = await fetch(`${API}/lots${whParam}`);
        setLots(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    loadLots();
  }, [selectedWarehouseId]);

  const filteredLots = lots
    .filter((lot) => {
      const matchSearch =
        lot.sku.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.lote.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.sku.codigoDynamics.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEstado = filterEstado === 'TODOS' || lot.estadoCalidad === filterEstado;
      return matchSearch && matchEstado;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'vencimiento') {
        cmp = (new Date(a.fechaVencimiento || '2099-01-01').getTime()) - (new Date(b.fechaVencimiento || '2099-01-01').getTime());
      } else if (sortField === 'cantidad') {
        cmp = a.cantidadDisponible - b.cantidadDisponible;
      } else {
        cmp = a.sku.descripcion.localeCompare(b.sku.descripcion);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const totalDisponible = filteredLots.reduce((s, l) => s + l.cantidadDisponible, 0);
  const totalReservada = filteredLots.reduce((s, l) => s + l.cantidadReservada, 0);
  const lotesProxVencer = filteredLots.filter((l) => getDaysUntilExpiry(l.fechaVencimiento) <= 7).length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando inventario desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Inventario por Lote</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Control FEFO — Primero en vencer, primero en despachar
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
            <Wifi size={10} /> Supabase
          </span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-value">{filteredLots.length}</div>
          <div className="stat-card-label">Lotes Activos</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value">{totalDisponible.toLocaleString()}</div>
          <div className="stat-card-label">Unidades Disponibles</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value">{totalReservada.toLocaleString()}</div>
          <div className="stat-card-label">Unidades Reservadas</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value" style={{ color: lotesProxVencer > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {lotesProxVencer}
          </div>
          <div className="stat-card-label">Próximos a Vencer (&lt;7d)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="table-search">
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar SKU, lote, código..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} id="inventory-search" />
        </div>
        <select className="form-select" value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)} id="filter-estado">
          <option value="TODOS">Todos los estados</option>
          <option value="LIBERADO">✅ Liberado</option>
          <option value="CUARENTENA">⚠️ Cuarentena</option>
          <option value="BLOQUEADO">🚫 Bloqueado</option>
        </select>
      </div>

      {/* Table */}
      <div className="data-table-wrapper glass-card animate-slide-up">
        {filteredLots.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <PackageOpen size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Sin lotes en inventario
            </div>
            <div style={{ fontSize: 'var(--font-sm)' }}>
              Registra una recepción desde Operaciones → Recepción para ver lotes aquí.
            </div>
          </div>
        ) : (
          <>
            <div className="data-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('sku')} style={{ cursor: 'pointer' }}>
                      SKU <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
                    </th>
                    <th>Código</th>
                    <th>Lote</th>
                    <th onClick={() => toggleSort('vencimiento')} style={{ cursor: 'pointer' }}>
                      Vencimiento <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
                    </th>
                    <th>Días</th>
                    <th>Estado</th>
                    <th onClick={() => toggleSort('cantidad')} style={{ cursor: 'pointer' }}>
                      Disponible <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
                    </th>
                    <th>Reservada</th>
                    <th>Ubicación</th>
                    <th>Proveedor</th>
                    <th style={{ width: 60 }}>Etiqueta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLots.map((lot) => {
                    const daysLeft = getDaysUntilExpiry(lot.fechaVencimiento);
                    return (
                      <tr key={lot.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{lot.sku.descripcion}</td>
                        <td><code style={{ color: 'var(--accent-secondary)', fontSize: 'var(--font-xs)' }}>{lot.sku.codigoDynamics}</code></td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{lot.lote}</td>
                        <td>{formatDate(lot.fechaVencimiento)}</td>
                        <td>
                          <span className={getExpiryClass(daysLeft)} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {daysLeft === 999 ? '—' : `${daysLeft}d`}
                          </span>
                        </td>
                        <td><span className={`badge badge-${lot.estadoCalidad.toLowerCase()}`}>{lot.estadoCalidad}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          {lot.cantidadDisponible.toLocaleString()}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{lot.cantidadReservada.toLocaleString()}</td>
                        <td><code style={{ fontSize: 'var(--font-xs)', color: 'var(--accent-primary)' }}>{lot.ubicacion?.codigo || '—'}</code></td>
                        <td style={{ fontSize: 'var(--font-xs)' }}>{lot.proveedorNombre}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/etiquetado?lote=${encodeURIComponent(lot.lote)}`)}
                            title="Imprimir etiqueta" style={{ color: 'var(--accent-secondary)' }}>
                            <Tag size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <div className="table-pagination-info">
                {filteredLots.length} lotes desde Supabase · FEFO ordenado
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
