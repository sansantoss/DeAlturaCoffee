/**
 * Drawings made in code, in the brand palette. They stand in for photography until DeAltura has
 * its own photos of the farm, the roaster and the bags; swap them for real pictures then.
 */

const C = {
  turquoise: '#2F6A5C',
  forest: '#0C3B32',
  sand: '#E5ECE5',
  coffee: '#2B2B2B',
  gold: '#B67D43',
  cream: '#F5EFE4',
  deep: '#1D5446',
  sand2: '#C9D9CF',
};

/* ---------- topographic contours, like the side of the bag ---------- */
function contour(cx: number, cy: number, r: number, seed: number, points = 72) {
  const pts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble =
      1 + 0.09 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 1.7) + 0.03 * Math.cos(a * 7 + seed * 0.3);
    const x = cx + Math.cos(a) * r * wobble * 1.35;
    const y = cy + Math.sin(a) * r * wobble;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ') + 'Z';
}

export function Topo({ className }: { className?: string }) {
  const hills = [
    { cx: 180, cy: 760, n: 9, step: 46, seed: 1 },
    { cx: 1320, cy: 180, n: 8, step: 44, seed: 4 },
    { cx: 1180, cy: 900, n: 6, step: 50, seed: 7 },
  ];
  return (
    <svg className={className} viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {hills.map((h, hi) => (
        <g key={hi} fill="none" stroke="currentColor" strokeWidth="2">
          {Array.from({ length: h.n }, (_, i) => (
            <path key={i} d={contour(h.cx, h.cy, 40 + i * h.step, h.seed + i * 0.35)} />
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ---------- the bag ---------- */
export function Bag({ title, origin, notes, label }: { title: string; origin: string; notes: string; label: string }) {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label}>
      <g className="bag-float">
        {/* gusset shadow side */}
        <path d="M268 72 L300 86 L300 352 L268 362 Z" fill={C.deep} />
        {/* body */}
        <path d="M110 66 Q110 58 118 58 L260 58 Q268 58 268 66 L268 362 L110 362 Z" fill={C.turquoise} />
        {/* top seal */}
        <rect x="110" y="58" width="158" height="22" fill={C.deep} />
        <rect x="110" y="92" width="158" height="5" fill={C.deep} />
        {/* valve */}
        <circle cx="189" cy="126" r="11" fill={C.deep} />
        {/* label */}
        <rect x="126" y="150" width="126" height="190" fill={C.cream} />
        <text x="189" y="186" textAnchor="middle" fontFamily="Jost Variable, Jost, sans-serif" fontSize="17" letterSpacing="1.2" fill={C.forest}>DEALTURA</text>
        <text x="190" y="198" textAnchor="middle" fontFamily="Jost Variable, Jost, sans-serif" fontSize="6" letterSpacing="3.4" fill={C.forest}>COFFEE</text>
        <rect x="180" y="208" width="18" height="2" fill={C.gold} />
        <text x="189" y="236" textAnchor="middle" fontFamily="Jost Variable, Jost, sans-serif" fontSize="11" fontWeight="600" fill={C.forest}>{origin}</text>
        <text x="189" y="252" textAnchor="middle" fontFamily="Jost Variable, Jost, sans-serif" fontSize="8.5" fill={C.forest}>{title}</text>
        <rect x="138" y="266" width="102" height="34" fill={C.sand} />
        <text x="189" y="287" textAnchor="middle" fontFamily="Cormorant Garamond Variable, serif" fontStyle="italic" fontSize="9.5" fill={C.forest}>{notes}</text>
        <rect x="138" y="312" width="44" height="14" fill={C.forest} />
        <rect x="186" y="312" width="54" height="14" fill={C.gold} />
      </g>
    </svg>
  );
}

/* ---------- six moments, 4:5 ---------- */
const box = { viewBox: '0 0 280 350', role: 'img' as const };

function Picked({ alt }: { alt: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.turquoise} />
      <path d="M-10 70 Q120 120 300 90" stroke={C.forest} strokeWidth="9" fill="none" />
      {[[40, 92, -30], [110, 108, 25], [180, 104, -20], [240, 96, 30]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y - 38} rx="16" ry="40" fill={C.deep} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {[[60, 150], [84, 162], [70, 182], [150, 156], [170, 176], [146, 196], [212, 150], [230, 172]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="15" fill={i % 3 === 0 ? C.gold : C.coffee} />
      ))}
      <path d="M40 350 Q80 250 140 240 Q200 250 240 350 Z" fill={C.cream} />
      <path d="M118 262 q22 -20 44 0" stroke={C.forest} strokeWidth="6" fill="none" />
    </svg>
  );
}

function Dried({ alt }: { alt: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.sand} />
      <circle cx="210" cy="72" r="34" fill={C.gold} />
      {Array.from({ length: 6 }, (_, r) => (
        <g key={r}>
          <rect x="20" y={140 + r * 34} width="240" height="22" fill={C.sand2} />
          {Array.from({ length: 11 }, (_, c) => (
            <ellipse key={c} cx={34 + c * 21.5} cy={151 + r * 34} rx="7" ry="5" fill={r < 2 ? C.gold : C.coffee} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Shipped({ alt }: { alt: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.cream} />
      <path d="M0 170 L70 90 L120 140 L170 70 L280 180 L280 350 L0 350 Z" fill={C.turquoise} />
      {[[30, 220], [140, 220], [85, 160]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="110" height="80" rx="18" fill={C.sand} />
          <rect x={x + 30} y={y + 30} width="50" height="8" fill={C.forest} />
          <rect x={x + 40} y={y + 44} width="30" height="6" fill={C.forest} />
        </g>
      ))}
    </svg>
  );
}

function Roasted({ alt }: { alt: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.forest} />
      <rect x="70" y="40" width="34" height="70" fill={C.coffee} />
      <path d="M60 110 L114 110 L104 140 L70 140 Z" fill={C.gold} />
      <circle cx="130" cy="190" r="62" fill={C.coffee} />
      <circle cx="130" cy="190" r="40" fill={C.gold} />
      <circle cx="130" cy="190" r="12" fill={C.coffee} />
      <rect x="60" y="255" width="140" height="18" fill={C.coffee} />
      <ellipse cx="200" cy="300" rx="64" ry="18" fill={C.turquoise} />
      {[[180, 296], [196, 304], [212, 294], [224, 302], [204, 290]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="6" ry="4" fill={C.cream} />
      ))}
    </svg>
  );
}

function Packed({ alt, day }: { alt: string; day: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.sand} />
      <path d="M70 60 L210 60 L210 310 L70 310 Z" fill={C.turquoise} />
      <rect x="70" y="60" width="140" height="18" fill={C.deep} />
      <rect x="88" y="120" width="104" height="150" fill={C.cream} />
      <rect x="104" y="140" width="72" height="10" fill={C.forest} />
      <rect x="120" y="158" width="40" height="4" fill={C.gold} />
      <rect x="100" y="180" width="80" height="6" fill={C.forest} />
      <rect x="110" y="194" width="60" height="6" fill={C.forest} />
      <g transform="rotate(-12 196 250)">
        <rect x="150" y="226" width="96" height="46" fill={C.coffee} />
        <text x="198" y="257" textAnchor="middle" fontFamily="Jost Variable, Jost, sans-serif" fontSize="18" fontWeight="600" fill={C.cream}>{day}</text>
      </g>
    </svg>
  );
}

function Counter({ alt }: { alt: string }) {
  return (
    <svg {...box} aria-label={alt}>
      <rect width="280" height="350" fill={C.turquoise} />
      <rect y="250" width="280" height="100" fill={C.coffee} />
      <ellipse cx="140" cy="250" rx="86" ry="14" fill={C.cream} />
      <path d="M86 170 L194 170 L184 244 Q140 256 96 244 Z" fill={C.cream} />
      <path d="M194 186 q30 4 22 30 q-6 16 -26 16" stroke={C.cream} strokeWidth="10" fill="none" />
      <ellipse cx="140" cy="172" rx="54" ry="8" fill={C.coffee} />
      <path d="M118 140 q-10 -20 4 -36 q12 -14 0 -32" stroke={C.cream} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M154 140 q-10 -20 4 -36 q12 -14 0 -32" stroke={C.cream} strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MomentArt({ index, alt, day }: { index: number; alt: string; day: string }) {
  switch (index) {
    case 0: return <Picked alt={alt} />;
    case 1: return <Dried alt={alt} />;
    case 2: return <Shipped alt={alt} />;
    case 3: return <Roasted alt={alt} />;
    case 4: return <Packed alt={alt} day={day} />;
    default: return <Counter alt={alt} />;
  }
}
