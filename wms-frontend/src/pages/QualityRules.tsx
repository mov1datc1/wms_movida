import { CheckCircle2, XCircle } from 'lucide-react';

export function QualityRules() {
  return (
    <div>
      <div className="page-header">
        <h1>Reglas de Calidad</h1>
        <p>Control de incompatibilidades, alérgenos, químicos y restricciones de almacenaje</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <div className="glass-card animate-slide-up stagger-1" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Reglas Activas</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Validaciones automáticas en putaway y trasiego</div>
            </div>
          </div>
          {[
            'FEFO obligatorio para todos los alimentos',
            'No mezclar QUIMICO con ALIMENTO en misma ubicación',
            'Alérgenos en rack dedicado',
            'Temperatura compatible validada en putaway',
            'Override FEFO requiere autorización supervisor',
            'Bloqueo automático a 2 días de vencimiento',
            'Trasiegos solo con motivo y usuario registrado',
          ].map((rule, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) 0',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 'var(--font-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
              {rule}
            </div>
          ))}
        </div>

        <div className="glass-card animate-slide-up stagger-2" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={20} style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Matriz de Incompatibilidades</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Productos que no pueden coexistir en misma ubicación</div>
            </div>
          </div>
          <div className="data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Alimento</th>
                  <th>Químico</th>
                  <th>Empaque</th>
                  <th>Textil</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cat: 'Alimento', vals: ['✅', '❌', '✅', '⚠️'] },
                  { cat: 'Químico', vals: ['❌', '✅', '❌', '❌'] },
                  { cat: 'Empaque', vals: ['✅', '❌', '✅', '✅'] },
                  { cat: 'Textil', vals: ['⚠️', '❌', '✅', '✅'] },
                ].map((row) => (
                  <tr key={row.cat}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.cat}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} style={{ textAlign: 'center', fontSize: 'var(--font-base)' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{
            marginTop: 'var(--space-4)',
            fontSize: 'var(--font-xs)',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: 'var(--space-4)',
          }}>
            <span>✅ Compatible</span>
            <span>❌ Incompatible</span>
            <span>⚠️ Condicional</span>
          </div>
        </div>
      </div>
    </div>
  );
}
