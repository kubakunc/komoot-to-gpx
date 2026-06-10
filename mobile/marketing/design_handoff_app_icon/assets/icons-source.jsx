// icons-v5.jsx — 10 duotone (Strava orange + Komoot green) variations.
// Constant motif: white activity line + white download badge (ink arrow).
// Only the orange/green division changes. Exports DUO to window.

const O = '#FC4C02';      // Strava
const G = '#5E9E2E';      // Komoot
const INK = '#15191C';
const W = '#FFFFFF';
const ACT5 = 'M22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33';

function ActLine() {
  return (
    <g>
      <path d={ACT5} fill="none" stroke={W} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="53" r="4.6" fill={W} />
      <circle cx="77" cy="33" r="4.6" fill={W} />
    </g>
  );
}
function Badge({ cx = 72, cy = 73.5 }) {
  return (
    <g transform={`translate(${cx - 72} ${cy - 73.5})`}>
      <circle cx="72" cy="73.5" r="14.5" fill={W} />
      <g stroke={INK} strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M72 66.5 V76" /><path d="M66.8 71.6 L72 77 L77.2 71.6" /><path d="M66 80.5 H78" />
      </g>
    </g>
  );
}
const Svg = ({ children }) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">{children}</svg>
);

/* 1 · Poziomy 50/50 (klasyk) */
function D1() {
  return (<Svg>
    <defs><linearGradient id="d1" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d1)" /><ActLine /><Badge />
  </Svg>);
}
/* 2 · Poziomy odwrócony */
function D2() {
  return (<Svg>
    <defs><linearGradient id="d2" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={G} /><stop offset="0.5" stopColor={O} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d2)" /><ActLine /><Badge />
  </Svg>);
}
/* 3 · Pionowy */
function D3() {
  return (<Svg>
    <defs><linearGradient id="d3" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d3)" /><ActLine /><Badge />
  </Svg>);
}
/* 4 · Diagonal ↘ (pomarańcz górny-lewy) */
function D4() {
  return (<Svg>
    <defs><linearGradient id="d4" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d4)" /><ActLine /><Badge />
  </Svg>);
}
/* 5 · Diagonal ↗ (pomarańcz górny-prawy) */
function D5() {
  return (<Svg>
    <defs><linearGradient id="d5" x1="100" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d5)" /><ActLine /><Badge />
  </Svg>);
}
/* 6 · Miękki blend */
function D6() {
  return (<Svg>
    <defs><linearGradient id="d6" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.2" stopColor={O} /><stop offset="0.8" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d6)" /><ActLine /><Badge />
  </Svg>);
}
/* 7 · Podział wzdłuż trasy (nad linią pomarańcz, pod zieleń) */
function D7() {
  return (<Svg>
    <rect width="100" height="100" fill={O} />
    <path d="M0 57 L22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33 L100 28 L100 100 L0 100 Z" fill={G} />
    <ActLine /><Badge />
  </Svg>);
}
/* 8 · Fala */
function D8() {
  return (<Svg>
    <rect width="100" height="100" fill={O} />
    <path d="M0 62 C 22 50, 38 74, 58 60 C 76 47, 90 58, 100 54 L100 100 L0 100 Z" fill={G} />
    <ActLine /><Badge />
  </Svg>);
}
/* 9 · Szew kontrastowy */
function D9() {
  return (<Svg>
    <defs><linearGradient id="d9" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d9)" />
    <line x1="0" y1="50" x2="100" y2="50" stroke={INK} strokeWidth="2.4" opacity="0.85" />
    <ActLine /><Badge />
  </Svg>);
}
/* 10 · Badge na szwie */
function D10() {
  return (<Svg>
    <defs><linearGradient id="d10" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0.5" stopColor={O} /><stop offset="0.5" stopColor={G} /></linearGradient></defs>
    <rect width="100" height="100" fill="url(#d10)" />
    <ActLine /><Badge cx={72} cy={50} />
  </Svg>);
}

const DUO = [
  { key: 'd1', name: 'Poziomy 50/50', sub: 'klasyk — pomarańcz góra', Comp: D1 },
  { key: 'd2', name: 'Poziomy odwrócony', sub: 'zieleń góra', Comp: D2 },
  { key: 'd3', name: 'Pionowy', sub: 'pomarańcz lewa / zieleń prawa', Comp: D3 },
  { key: 'd4', name: 'Ukos ↘', sub: 'pomarańcz górny-lewy', Comp: D4 },
  { key: 'd5', name: 'Ukos ↗', sub: 'pomarańcz górny-prawy', Comp: D5 },
  { key: 'd6', name: 'Miękki blend', sub: 'płynne przejście', Comp: D6 },
  { key: 'd7', name: 'Podział wzdłuż trasy', sub: 'linia dzieli marki', Comp: D7 },
  { key: 'd8', name: 'Fala', sub: 'falisty podział', Comp: D8 },
  { key: 'd9', name: 'Szew kontrastowy', sub: 'cienka linia podziału', Comp: D9 },
  { key: 'd10', name: 'Badge na szwie', sub: 'plakietka mostkuje kolory', Comp: D10 },
];

Object.assign(window, { DUO });
