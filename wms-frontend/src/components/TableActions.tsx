import { Printer, Download } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

interface TableActionsProps {
  data: any[];
  columns: Column[];
  title: string;
  filename: string;
}

export function downloadCSV(data: any[], columns: Column[], filename: string) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key];
      const str = String(value ?? '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printTable(data: any[], columns: Column[], title: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} — TB WMS</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; padding: 24px; color: #1a1a2e; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 700; 
             border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 16px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>
      <h1>📦 ${title}</h1>
      <div class="subtitle">Generado: ${new Date().toLocaleString('es-GT')} · TB WMS CEDIS Guatemala</div>
      <table>
        <thead>
          <tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.map(row => `<tr>${columns.map(col => {
            const value = col.format ? col.format(row[col.key], row) : row[col.key];
            return `<td>${value ?? '—'}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">
        <span>${data.length} registros</span>
        <span>TB WMS v2.0</span>
      </div>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }
}

export function TableActions({ data, columns, title, filename }: TableActionsProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => printTable(data, columns, title)}
        style={{ fontSize: 'var(--font-xs)', gap: 4, color: 'var(--text-secondary)' }}
        title="Imprimir"
      >
        <Printer size={14} /> Imprimir
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => downloadCSV(data, columns, filename)}
        style={{ fontSize: 'var(--font-xs)', gap: 4, color: 'var(--accent-primary)' }}
        title="Descargar CSV"
      >
        <Download size={14} /> CSV
      </button>
    </div>
  );
}
