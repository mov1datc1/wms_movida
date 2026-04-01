import { useState, useEffect } from 'react';
import { MapPin, Loader2, Wifi, ArrowRightLeft } from 'lucide-react';
import { useWarehouse } from '../contexts/WarehouseContext';

import { API } from '../config/api';

interface Location {
  id: string;
  codigo: string;
  almacenId: string;
  zona: string;
  pasillo: string;
  rack: string;
  nivel: string;
  posicion: string;
  tipoUbicacion: string;
  temperatura: string;
  capacidad: number;
  ocupacion: number;
  estado: string;
  almacen?: { codigo: string; nombre: string };
}

interface Lot {
  id: string;
  lote: string;
  cantidadDisponible: number;
  sku: { codigoDynamics: string; descripcion: string };
  ubicacion: { codigo: string } | null;
}

export function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterZona, setFilterZona] = useState('TODAS');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ lotId: '', toLocationId: '', cantidad: '' });
  const [transferMsg, setTransferMsg] = useState<string | null>(null);
  const { selectedWarehouseId } = useWarehouse();

  useEffect(() => {
    async function load() {
      try {
        const whParam = selectedWarehouseId ? `?almacenId=${selectedWarehouseId}` : '';
        const [locRes, lotRes] = await Promise.all([
          fetch(`${API}/locations${whParam}`),
          fetch(`${API}/lots${whParam}`),
        ]);
        setLocations(await locRes.json());
        setLots(await lotRes.json());
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [selectedWarehouseId]);

  const filtered = locations.filter(loc => {
    const matchZona = filterZona === 'TODAS' || loc.temperatura === filterZona;
    const matchTipo = filterTipo === 'TODOS' || loc.tipoUbicacion === filterTipo;
    return matchZona && matchTipo;
  });

  const totalLocations = locations.length;
  const occupied = locations.filter(l => l.estado === 'OCUPADO').length;
  const free = locations.filter(l => l.estado === 'LIBRE').length;
  const blocked = locations.filter(l => l.estado === 'BLOQUEADO').length;
  const avgOcupacion = totalLocations > 0 ? Math.round(locations.reduce((s, l) => s + l.ocupacion, 0) / totalLocations) : 0;

  const selected = locations.find(l => l.id === selectedLoc);
  const lotsInLocation = selected ? lots.filter(l => l.ubicacion?.codigo === selected.codigo) : [];

  const handleTransfer = async () => {
    if (!transferForm.lotId || !transferForm.toLocationId) return;
    const lot = lots.find(l => l.id === transferForm.lotId);
    if (!lot) return;
    const fromLoc = locations.find(l => l.codigo === lot.ubicacion?.codigo);

    try {
      await fetch(`${API}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: transferForm.lotId,
          fromLocationId: fromLoc?.id || '',
          toLocationId: transferForm.toLocationId,
          cantidad: parseInt(transferForm.cantidad) || lot.cantidadDisponible,
          usuario: 'Jonathan P.',
          motivo: 'Transferencia manual entre ubicaciones',
        }),
      });
      setTransferMsg(`✅ Lote ${lot.lote} transferido exitosamente`);
      setShowTransfer(false);
      setTransferForm({ lotId: '', toLocationId: '', cantidad: '' });
      // Reload
      const [locRes, lotRes] = await Promise.all([fetch(`${API}/locations`), fetch(`${API}/lots`)]);
      setLocations(await locRes.json());
      setLots(await lotRes.json());
      setTimeout(() => setTransferMsg(null), 4000);
    } catch(e: any) {
      setTransferMsg(`❌ Error: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando ubicaciones desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h1>Ubicaciones del CEDIS</h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              Mapa de ubicaciones por zona y temperatura
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
                color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                <Wifi size={10} /> Supabase
              </span>
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowTransfer(!showTransfer)}>
            <ArrowRightLeft size={16} /> Transferir Lote
          </button>
        </div>
      </div>

      {transferMsg && (
        <div style={{
          background: transferMsg.includes('✅') ? 'var(--success-soft)' : '#FEF2F2',
          border: `1px solid ${transferMsg.includes('✅') ? 'var(--success)' : '#FCA5A5'}`,
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-4)', fontSize: 'var(--font-sm)', fontWeight: 600,
          color: transferMsg.includes('✅') ? 'var(--success)' : '#DC2626',
        }}>
          {transferMsg}
        </div>
      )}

      {/* Transfer Panel */}
      {showTransfer && (
        <div className="glass-card animate-slide-up" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ArrowRightLeft size={18} style={{ color: 'var(--accent-primary)' }} />
            Transferir / Mover Lote entre Ubicaciones
          </h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Lote a Mover</label>
              <select className="form-select" value={transferForm.lotId}
                onChange={e => setTransferForm(f => ({ ...f, lotId: e.target.value }))}>
                <option value="">Seleccionar lote...</option>
                {lots.filter(l => l.cantidadDisponible > 0).map(l => (
                  <option key={l.id} value={l.id}>
                    {l.lote} — {l.sku.descripcion} ({l.cantidadDisponible} UN) @ {l.ubicacion?.codigo || '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ubicación Destino</label>
              <select className="form-select" value={transferForm.toLocationId}
                onChange={e => setTransferForm(f => ({ ...f, toLocationId: e.target.value }))}>
                <option value="">Seleccionar destino...</option>
                {locations.filter(l => l.estado !== 'BLOQUEADO').map(l => (
                  <option key={l.id} value={l.id}>
                    {l.codigo} · {l.zona} · {l.temperatura} · {l.tipoUbicacion}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input type="number" className="form-input" placeholder="Todo" min="1"
                value={transferForm.cantidad} onChange={e => setTransferForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleTransfer}
            disabled={!transferForm.lotId || !transferForm.toLocationId}>
            <ArrowRightLeft size={16} /> Ejecutar Transferencia
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat-card glass-card stagger-1">
          <div className="stat-card-value">{totalLocations}</div>
          <div className="stat-card-label">Total Ubicaciones</div>
        </div>
        <div className="stat-card glass-card stagger-2">
          <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>{occupied}</div>
          <div className="stat-card-label">Ocupadas</div>
        </div>
        <div className="stat-card glass-card stagger-3">
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{free}</div>
          <div className="stat-card-label">Libres</div>
        </div>
        <div className="stat-card glass-card stagger-4">
          <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{blocked}</div>
          <div className="stat-card-label">Bloqueadas</div>
        </div>
        <div className="stat-card glass-card stagger-5">
          <div className="stat-card-value">{avgOcupacion}%</div>
          <div className="stat-card-label">Ocupación Prom.</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-select" value={filterZona} onChange={e => setFilterZona(e.target.value)}>
          <option value="TODAS">Todas las zonas</option>
          <option value="AMBIENTE">🟢 Ambiente</option>
          <option value="REFRIGERADO">🔵 Refrigerado</option>
          <option value="CONGELADO">🟣 Congelado</option>
        </select>
        <select className="form-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="TODOS">Todos los tipos</option>
          <option value="PICKING">Picking</option>
          <option value="RESERVA">Reserva</option>
          <option value="RECIBO">Recibo</option>
          <option value="STAGING">Staging</option>
          <option value="CUARENTENA">Cuarentena</option>
          <option value="QUIMICOS">Químicos</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-6)' }}>
        {/* Location Grid */}
        <div className="glass-card animate-slide-up">
          <div className="data-table-header">
            <div className="data-table-title">
              <MapPin size={16} style={{ verticalAlign: -3, marginRight: 8 }} />
              Mapa de Ubicaciones ({filtered.length})
            </div>
          </div>
          <div className="warehouse-grid">
            {filtered.map(loc => {
              const fill = loc.estado === 'BLOQUEADO' ? 'blocked' : loc.ocupacion > 0 ? 'occupied' : 'empty';
              return (
                <div key={loc.id} className={`location-cell ${fill}`}
                  onClick={() => setSelectedLoc(loc.id)}
                  title={`${loc.codigo} — ${loc.estado} (${loc.ocupacion}%)`}
                  style={{
                    outline: selectedLoc === loc.id ? '2px solid var(--accent-primary)' : undefined,
                    opacity: loc.estado === 'BLOQUEADO' ? 0.7 : 1,
                  }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, lineHeight: 1.1 }}>{loc.pasillo}</div>
                    <div style={{ fontSize: 7, opacity: 0.7 }}>{loc.rack}-{loc.nivel}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)' }}></div> Ocupado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}></div> Libre
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}></div> Bloqueado
            </span>
          </div>
        </div>

        {/* Detail */}
        <div>
          {selected ? (
            <div className="glass-card animate-slide-left" style={{ padding: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <MapPin size={18} style={{ color: 'var(--accent-primary)' }} />
                {selected.codigo}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Almacén', value: selected.almacen?.nombre || selected.almacenId },
                  { label: 'Zona', value: selected.zona },
                  { label: 'Pasillo', value: selected.pasillo },
                  { label: 'Rack / Nivel', value: `${selected.rack} / ${selected.nivel}` },
                  { label: 'Tipo', value: selected.tipoUbicacion },
                  { label: 'Temperatura', value: selected.temperatura, badge: true },
                  { label: 'Estado', value: selected.estado, badge: true },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--font-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    {item.badge ? (
                      <span className={`badge badge-${item.value.toLowerCase()}`}>{item.value}</span>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                  <span>Ocupación</span>
                  <span style={{ fontWeight: 700,
                    color: selected.ocupacion > 90 ? 'var(--danger)' : selected.ocupacion > 70 ? 'var(--warning)' : 'var(--success)' }}>
                    {selected.ocupacion}%
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{
                    width: `${selected.ocupacion}%`,
                    background: selected.ocupacion > 90 ? 'var(--danger)' : selected.ocupacion > 70
                      ? 'linear-gradient(90deg, var(--warning), var(--danger))'
                      : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                  }}></div>
                </div>
              </div>

              {/* Lots in this location */}
              {lotsInLocation.length > 0 && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                    📦 Lotes en esta ubicación
                  </div>
                  {lotsInLocation.map(l => (
                    <div key={l.id} style={{ padding: 'var(--space-2)', fontSize: 'var(--font-xs)',
                      borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 600 }}>{l.sku.descripcion}</div>
                      <div style={{ color: 'var(--text-muted)' }}>Lote: {l.lote} · {l.cantidadDisponible} UN</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: 'var(--space-4)' }}>📍</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
                Selecciona una ubicación del mapa
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
