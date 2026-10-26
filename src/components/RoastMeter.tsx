/** Indicador de nivel de tueste: tres segmentos color grano, se llenan hasta el nivel. */
const LEVELS = ['light', 'medium', 'dark'] as const;

export function RoastMeter({ level, label }: { level: (typeof LEVELS)[number]; label: string }) {
  const n = LEVELS.indexOf(level) + 1;
  return (
    <span className="roast-meter" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {LEVELS.map((l, i) => (
        <span key={l} className={`roast-meter__seg roast-meter__seg--${l} ${i < n ? 'is-on' : ''}`} />
      ))}
    </span>
  );
}
