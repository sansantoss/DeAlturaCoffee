/**
 * Gráficas del panel (server components, HTML + CSS, sin librería).
 * Una sola serie por gráfica → un solo color (turquesa), sin leyenda; el título dice qué es.
 * Barras ≤ 24px con punta redondeada, ejes discretos, valor al pasar el mouse o enfocar,
 * y cada gráfica trae su tabla (datos accesibles sin depender del color ni del hover).
 */

export interface Column { key: string; label: string; value: number; display: string; detail?: string; current?: boolean }

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export function ColumnChart({ columns, formatTick, empty, label }: {
  columns: Column[]; formatTick: (v: number) => string; empty: string; label: string;
}) {
  const max = niceMax(Math.max(0, ...columns.map((c) => c.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const hasData = columns.some((c) => c.value > 0);
  const every = Math.ceil(columns.length / 12); // no más de ~12 etiquetas en el eje X

  return (
    <figure className="chart" aria-label={label}>
      <div className="chart__plot">
        <div className="chart__ticks" aria-hidden="true">
          {ticks.map((v) => (
            <div key={v} className="chart__tick" style={{ bottom: `${(v / max) * 100}%` }}>
              <span>{formatTick(v)}</span>
            </div>
          ))}
        </div>
        <ol className="chart__cols" style={{ ['--n' as string]: columns.length }}>
          {columns.map((c, i) => (
            <li key={c.key} className={`chart__col ${c.current ? 'is-current' : ''}`} tabIndex={0} aria-label={`${c.label}: ${c.display}`}>
              <span className="chart__bar" style={{ height: `${(c.value / max) * 100}%` }} />
              <span className="chart__tip" role="tooltip">
                <strong>{c.display}</strong>
                <span>{c.label}{c.detail ? ` · ${c.detail}` : ''}</span>
              </span>
              <span className={`chart__x ${i % every === 0 || c.current ? '' : 'is-hidden'}`}>{c.label}</span>
            </li>
          ))}
        </ol>
        {!hasData && <p className="chart__empty">{empty}</p>}
      </div>
    </figure>
  );
}

export interface BarItem { key: string; label: string; value: number; display: string; sub?: string }

export function BarList({ items, empty, label }: { items: BarItem[]; empty: string; label: string }) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  if (!items.length) return <p className="chart__empty chart__empty--static">{empty}</p>;
  return (
    <ul className="barlist" aria-label={label}>
      {items.map((it) => (
        <li key={it.key} className="barlist__row">
          <span className="barlist__label">
            <strong>{it.label}</strong>
            {it.sub && <small>{it.sub}</small>}
          </span>
          <span className="barlist__track">
            <span className="barlist__bar" style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </span>
          <span className="barlist__value nums">{it.display}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, delta, hint }: { label: string; value: string; delta?: { text: string; dir: 'up' | 'down' | 'flat' }; hint?: string }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <strong className="tile__value">{value}</strong>
      {delta && (
        <span className={`tile__delta tile__delta--${delta.dir}`}>
          <span aria-hidden="true">{delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '•'}</span> {delta.text}
        </span>
      )}
      {hint && <span className="tile__hint">{hint}</span>}
    </div>
  );
}
