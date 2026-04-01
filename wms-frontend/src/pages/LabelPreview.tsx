import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWarehouse } from '../contexts/WarehouseContext';
import {
  Tag, Search, Printer, CheckSquare, Square,
  Loader2, Package, ChevronDown
} from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

import { API } from '../config/api';

interface Lot {
  id: string;
  lote: string;
  fechaVencimiento: string | null;
  fechaProduccion: string | null;
  cantidadDisponible: number;
  estadoCalidad: string;
  proveedorNombre: string | null;
  createdAt: string;
  sku: {
    codigoDynamics: string;
    descripcion: string;
    categoria: string;
    temperaturaRequerida: string;
    uomBase: string;
  };
  ubicacion: { codigo: string; zona: string; almacenId: string } | null;
}

interface LabelData {
  lot: Lot;
  qrDataUrl: string;
  barcodeDataUrl: string;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysUntilExpiry(date: string | null): number {
  if (!date) return 999;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function LabelPreview() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [labelSize, setLabelSize] = useState<'4x2' | '4x3' | '3x2'>('4x2');
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const printRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const autoLote = searchParams.get('lote');
  const autoTriggered = useRef(false);

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

  // Auto-select lot from query parameter (coming from Receiving/Inventory)
  useEffect(() => {
    if (autoLote && lots.length > 0 && !autoTriggered.current) {
      const match = lots.find(l => l.lote === autoLote);
      if (match) {
        setSelectedLotIds(new Set([match.id]));
        setSearchTerm(autoLote);
        autoTriggered.current = true;
      }
    }
  }, [autoLote, lots]);

  const filteredLots = lots.filter(lot => {
    const term = searchTerm.toLowerCase();
    return (
      lot.sku.descripcion.toLowerCase().includes(term) ||
      lot.lote.toLowerCase().includes(term) ||
      lot.sku.codigoDynamics.toLowerCase().includes(term) ||
      (lot.proveedorNombre || '').toLowerCase().includes(term)
    );
  });

  const toggleLot = (id: string) => {
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedLotIds.size === filteredLots.length) {
      setSelectedLotIds(new Set());
    } else {
      setSelectedLotIds(new Set(filteredLots.map(l => l.id)));
    }
  };

  const generateLabels = useCallback(async () => {
    if (selectedLotIds.size === 0) return;
    setGenerating(true);

    const selectedLots = lots.filter(l => selectedLotIds.has(l.id));
    const generated: LabelData[] = [];

    for (const lot of selectedLots) {
      // Generate QR Code
      const qrContent = JSON.stringify({
        lot: lot.lote,
        sku: lot.sku.codigoDynamics,
        desc: lot.sku.descripcion,
        exp: lot.fechaVencimiento,
        qty: lot.cantidadDisponible,
        loc: lot.ubicacion?.codigo || '',
        wh: selectedWarehouse?.nombre || '',
        provider: lot.proveedorNombre || '',
        quality: lot.estadoCalidad,
      });

      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(qrContent, {
          width: 140,
          margin: 1,
          color: { dark: '#1a1a2e', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
      } catch { qrDataUrl = ''; }

      // Generate Barcode (Code128)
      let barcodeDataUrl = '';
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, lot.lote, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#1a1a2e',
        });
        barcodeDataUrl = canvas.toDataURL('image/png');
      } catch { barcodeDataUrl = ''; }

      generated.push({ lot, qrDataUrl, barcodeDataUrl });
    }

    setLabels(generated);
    setPreviewMode(true);
    setGenerating(false);
  }, [selectedLotIds, lots, selectedWarehouse]);

  const handlePrint = () => {
    window.print();
  };

  const labelDimensions = {
    '4x2': { width: '384px', height: '192px', name: '4" × 2" (Estándar)' },
    '4x3': { width: '384px', height: '288px', name: '4" × 3" (Grande)' },
    '3x2': { width: '288px', height: '192px', name: '3" × 2" (Compacta)' },
  };

  const currentSize = labelDimensions[labelSize];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto var(--space-4)' }} />
        <div>Cargando lotes desde Supabase...</div>
      </div>
    );
  }

  return (
    <div>
      {/* ===== HEADER ===== */}
      <div className="page-header no-print">
        <h1>Etiquetado de Lotes</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          Generación de etiquetas con QR + Código de Barras para impresoras térmicas
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xs)',
            color: 'var(--accent-primary)', background: 'var(--accent-primary-soft)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
          }}>
            <Printer size={10} /> {currentSize.name}
          </span>
        </p>
      </div>

      {/* ===== PREVIEW MODE ===== */}
      {previewMode ? (
        <div>
          {/* Controls bar */}
          <div className="no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 'var(--space-5)', gap: 'var(--space-3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" onClick={() => setPreviewMode(false)}>
                ← Volver a Selección
              </button>
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', fontWeight: 600 }}>
                {labels.length} etiqueta{labels.length > 1 ? 's' : ''} lista{labels.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {/* Size selector */}
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost" onClick={() => setShowSizeDropdown(!showSizeDropdown)}>
                  📐 {currentSize.name} <ChevronDown size={14} />
                </button>
                {showSizeDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'white', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden', zIndex: 50, minWidth: 200,
                  }}>
                    {(Object.entries(labelDimensions) as [typeof labelSize, typeof currentSize][]).map(([key, val]) => (
                      <button key={key} onClick={() => { setLabelSize(key); setShowSizeDropdown(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-2) var(--space-3)',
                          border: 'none', background: labelSize === key ? 'var(--accent-primary-soft)' : 'white',
                          color: labelSize === key ? 'var(--accent-primary)' : 'var(--text-primary)',
                          cursor: 'pointer', fontSize: 'var(--font-sm)', fontFamily: 'var(--font-family)',
                        }}>
                        {val.name} {labelSize === key && '✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-primary" onClick={handlePrint} style={{ gap: 'var(--space-2)' }}>
                <Printer size={16} /> Imprimir {labels.length > 1 ? `(${labels.length})` : ''}
              </button>
            </div>
          </div>

          {/* Labels Grid */}
          <div ref={printRef} id="print-area" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)',
          }}>
            {labels.map((label, idx) => (
              <LabelCard
                key={label.lot.id}
                label={label}
                warehouseName={selectedWarehouse?.nombre || 'CEDIS'}
                dimensions={currentSize}
                index={idx}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ===== SELECTION MODE ===== */
        <div>
          {/* Action bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 'var(--space-4)', gap: 'var(--space-3)', flexWrap: 'wrap',
          }}>
            <div className="table-search" style={{ flex: '1 1 300px', maxWidth: 400 }}>
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Buscar SKU, lote, proveedor..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                {selectedLotIds.size} seleccionado{selectedLotIds.size !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-primary" onClick={generateLabels}
                disabled={selectedLotIds.size === 0 || generating}>
                {generating ? <Loader2 size={16} className="spin" /> : <Tag size={16} />}
                {generating ? 'Generando...' : `Generar Etiqueta${selectedLotIds.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {/* Lots Table */}
          <div className="data-table-wrapper glass-card animate-slide-up">
            {filteredLots.length === 0 ? (
              <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  Sin lotes disponibles
                </div>
                <div style={{ fontSize: 'var(--font-sm)' }}>
                  Registra recepciones para ver lotes aquí.
                </div>
              </div>
            ) : (
              <div className="data-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <button onClick={selectAll} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-secondary)', padding: 0, display: 'flex',
                        }}>
                          {selectedLotIds.size === filteredLots.length && filteredLots.length > 0
                            ? <CheckSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                            : <Square size={16} />}
                        </button>
                      </th>
                      <th>SKU</th>
                      <th>Código</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Cantidad</th>
                      <th>Ubicación</th>
                      <th>Proveedor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLots.map(lot => {
                      const selected = selectedLotIds.has(lot.id);
                      const daysLeft = getDaysUntilExpiry(lot.fechaVencimiento);
                      return (
                        <tr key={lot.id} onClick={() => toggleLot(lot.id)} style={{
                          cursor: 'pointer',
                          background: selected ? 'var(--accent-primary-soft)' : undefined,
                          transition: 'background 150ms',
                        }}>
                          <td>
                            {selected
                              ? <CheckSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                              : <Square size={16} style={{ color: 'var(--text-muted)' }} />}
                          </td>
                          <td style={{ fontWeight: 600 }}>{lot.sku.descripcion}</td>
                          <td><code style={{ fontSize: 'var(--font-xs)', color: 'var(--accent-secondary)' }}>{lot.sku.codigoDynamics}</code></td>
                          <td style={{ fontFamily: 'monospace' }}>{lot.lote}</td>
                          <td>
                            <span style={{
                              color: daysLeft <= 7 ? 'var(--danger)' : daysLeft <= 14 ? 'var(--warning)' : 'var(--text-primary)',
                              fontWeight: daysLeft <= 7 ? 700 : 400,
                            }}>
                              {formatDate(lot.fechaVencimiento)}
                              {daysLeft <= 14 && daysLeft !== 999 && (
                                <span style={{ fontSize: 10, marginLeft: 4 }}>({daysLeft}d)</span>
                              )}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {lot.cantidadDisponible} {lot.sku.uomBase}
                          </td>
                          <td>
                            <code style={{ fontSize: 'var(--font-xs)', color: 'var(--accent-primary)' }}>
                              {lot.ubicacion?.codigo || '—'}
                            </code>
                          </td>
                          <td style={{ fontSize: 'var(--font-xs)' }}>{lot.proveedorNombre || '—'}</td>
                          <td><span className={`badge badge-${lot.estadoCalidad.toLowerCase()}`}>{lot.estadoCalidad}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-pagination">
              <div className="table-pagination-info">
                {filteredLots.length} lotes · Click para seleccionar · Genera etiquetas con QR + Code128
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   LABEL CARD COMPONENT — The actual label that gets printed
   ==================================================================== */

function LabelCard({ label, warehouseName, dimensions, index }: {
  label: LabelData;
  warehouseName: string;
  dimensions: { width: string; height: string };
  index: number;
}) {
  const { lot, qrDataUrl, barcodeDataUrl } = label;
  const daysLeft = getDaysUntilExpiry(lot.fechaVencimiento);

  return (
    <div className="label-card print-label" style={{
      width: dimensions.width,
      minHeight: dimensions.height,
      border: '2px solid #1a1a2e',
      borderRadius: '6px',
      padding: '10px 14px',
      background: 'white',
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      color: '#1a1a2e',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
      pageBreakAfter: 'always',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid #1a1a2e', paddingBottom: '6px', marginBottom: '6px',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em' }}>TB WMS</div>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {warehouseName}
          </div>
        </div>
        <div style={{
          fontSize: 7, fontWeight: 600, color: '#666', textAlign: 'right',
          lineHeight: 1.4,
        }}>
          <div>ETIQUETA #{(index + 1).toString().padStart(3, '0')}</div>
          <div>{new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* Left: Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* SKU */}
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              PRODUCTO
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lot.sku.descripcion}
            </div>
            <div style={{ fontSize: 9, fontWeight: 600, color: '#555', fontFamily: 'monospace' }}>
              {lot.sku.codigoDynamics}
            </div>
          </div>

          {/* Lote + Fechas in grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', marginBottom: '4px' }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>LOTE</div>
              <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{lot.lote}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>CANTIDAD</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{lot.cantidadDisponible} {lot.sku.uomBase}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>RECEPCIÓN</div>
              <div style={{ fontSize: 9, fontWeight: 600 }}>{formatDate(lot.createdAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, color: daysLeft <= 7 ? '#DC2626' : '#999', textTransform: 'uppercase' }}>
                VENCIMIENTO {daysLeft <= 14 && daysLeft !== 999 ? `(${daysLeft}d)` : ''}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 800,
                color: daysLeft <= 3 ? '#DC2626' : daysLeft <= 7 ? '#F59E0B' : '#1a1a2e',
              }}>
                {formatDate(lot.fechaVencimiento)}
              </div>
            </div>
          </div>

          {/* Location + Provider */}
          <div style={{ display: 'flex', gap: '8px', fontSize: 8, color: '#666' }}>
            <span style={{ fontWeight: 600 }}>📍 {lot.ubicacion?.codigo || '—'}</span>
            <span>·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🚚 {lot.proveedorNombre || '—'}
            </span>
          </div>

          {/* Temperature badge */}
          <div style={{ marginTop: '3px' }}>
            <span style={{
              display: 'inline-block', padding: '1px 6px', borderRadius: '3px',
              fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: lot.sku.temperaturaRequerida === 'CONGELADO' ? '#DBEAFE' :
                lot.sku.temperaturaRequerida === 'REFRIGERADO' ? '#D1FAE5' : '#FEF3C7',
              color: lot.sku.temperaturaRequerida === 'CONGELADO' ? '#1E40AF' :
                lot.sku.temperaturaRequerida === 'REFRIGERADO' ? '#065F46' : '#92400E',
            }}>
              {lot.sku.temperaturaRequerida === 'CONGELADO' ? '❄️' :
                lot.sku.temperaturaRequerida === 'REFRIGERADO' ? '🧊' : '🌡️'} {lot.sku.temperaturaRequerida}
            </span>
            <span style={{
              display: 'inline-block', padding: '1px 6px', borderRadius: '3px', marginLeft: '3px',
              fontSize: 7, fontWeight: 700, textTransform: 'uppercase',
              background: lot.estadoCalidad === 'LIBERADO' ? '#D1FAE5' :
                lot.estadoCalidad === 'CUARENTENA' ? '#FEF3C7' : '#FEE2E2',
              color: lot.estadoCalidad === 'LIBERADO' ? '#065F46' :
                lot.estadoCalidad === 'CUARENTENA' ? '#92400E' : '#DC2626',
            }}>
              {lot.estadoCalidad}
            </span>
          </div>
        </div>

        {/* Right: QR + Barcode */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          width: '100px', flexShrink: 0,
        }}>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR" style={{ width: 80, height: 80 }} />
          )}
          {barcodeDataUrl && (
            <div style={{ textAlign: 'center', marginTop: '2px' }}>
              <img src={barcodeDataUrl} alt="Barcode" style={{ width: 96, height: 28 }} />
              <div style={{ fontSize: 8, fontWeight: 600, fontFamily: 'monospace', marginTop: '1px' }}>
                {lot.lote}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
