import type { JSX } from 'react';
import type { CityId } from '../../game/cities/types';

/** Hand-made SVG skyline illustrations used on city cards and the loading screen. */
export function CityArt({ id }: { id: CityId }) {
  const gid = `sky-${id}`;
  const skies: Record<CityId, [string, string, string]> = {
    paris: ['#ffcf9e', '#ff9a7a', '#7e8ed8'],
    newyork: ['#bfe3ff', '#7fb6ef', '#3c6fc2'],
    london: ['#ffe2c2', '#c7b8d8', '#7b8cb8'],
    tokyo: ['#5a2a7a', '#22164a', '#0b0d2a'],
    dublin: ['#d8f1e4', '#9fd2c4', '#5c9ab8'],
  };
  const [a, b, c] = skies[id];
  return (
    <svg className="city-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={a} />
          <stop offset="0.45" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gid})`} />
      {ART[id]}
    </svg>
  );
}

const hills = (fill: string) => <path d="M0 140 Q60 112 120 132 T240 124 T320 130 V180 H0Z" fill={fill} opacity="0.5" />;

const ART: Record<CityId, JSX.Element> = {
  paris: (
    <g>
      <circle cx="250" cy="70" r="22" fill="#fff3c8" opacity="0.9" />
      {hills('#c98a8a')}
      {/* Eiffel tower */}
      <path d="M150 30 L153 30 L156 70 L162 100 L172 150 L162 150 Q155 128 151.5 128 Q148 128 141 150 L131 150 L141 100 L147 70Z" fill="#5b3d4a" />
      <rect x="140" y="98" width="23" height="4" fill="#5b3d4a" />
      <rect x="145" y="68" width="13" height="3" fill="#5b3d4a" />
      {/* haussmann skyline */}
      <path d="M0 150 V128 L8 122 H40 L46 128 V150Z M50 150 V122 L56 116 H84 L90 122 V150Z M180 150 V124 L186 118 H222 L228 124 V150Z M232 150 V120 L238 114 H274 L280 120 V150Z M284 150 V126 L290 120 H320 V150Z" fill="#7a5468" />
      {/* arc */}
      <path d="M92 150 V122 H124 V150 H116 V136 Q108 128 100 136 V150Z" fill="#8c6478" />
      <rect x="0" y="150" width="320" height="30" fill="#4f7fae" />
      <path d="M0 158 H320 M20 166 H300" stroke="#9fd0ff" strokeWidth="1.5" opacity="0.5" />
    </g>
  ),
  newyork: (
    <g>
      <circle cx="60" cy="50" r="16" fill="#fffbe2" opacity="0.9" />
      <path d="M0 150 V100 H18 V150Z M22 150 V80 H44 V150Z M48 150 V112 H66 V150Z M200 150 V90 H222 V150Z M226 150 V70 H246 V150Z M250 150 V105 H270 V150Z M274 150 V86 H296 V150Z M300 150 V110 H320 V150Z" fill="#35507e" />
      {/* Empire State */}
      <path d="M120 150 V70 H124 V58 H128 V44 H131 V20 H133 V44 H136 V58 H140 V70 H144 V150Z" fill="#26385e" />
      <path d="M70 150 V95 H92 V150Z M150 150 V82 H172 V150Z M176 150 V100 H196 V150Z M96 150 V108 H116 V150Z" fill="#2c4470" />
      <rect x="0" y="150" width="320" height="30" fill="#3d6f9e" />
      {/* bridge */}
      <path d="M0 150 L60 120 L120 150 L180 120 L240 150 L320 132" stroke="#d6e4f2" strokeWidth="1.2" fill="none" opacity="0.8" />
      <path d="M56 150 V112 H64 V150Z M176 150 V112 H184 V150Z" fill="#7e5f4e" />
    </g>
  ),
  london: (
    <g>
      <circle cx="270" cy="56" r="18" fill="#fff0d6" opacity="0.85" />
      {hills('#8c8aa8')}
      {/* London Eye */}
      <circle cx="235" cy="108" r="36" fill="none" stroke="#e8eef8" strokeWidth="2.5" />
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        return <line key={i} x1="235" y1="108" x2={235 + Math.cos(ang) * 36} y2={108 + Math.sin(ang) * 36} stroke="#e8eef8" strokeWidth="0.7" />;
      })}
      {/* Big Ben */}
      <path d="M70 150 V60 H82 V150Z M68 60 L76 30 L84 60Z" fill="#6a5442" />
      <circle cx="76" cy="70" r="4" fill="#f6e7b0" />
      <path d="M86 150 V104 H170 V150Z" fill="#7d6450" />
      {/* Tower bridge */}
      <path d="M110 150 V118 L116 108 L122 118 V150Z M150 150 V118 L156 108 L162 118 V150Z M122 124 H150 V128 H122Z" fill="#8a7a6c" />
      <path d="M0 150 V118 H30 V150Z M30 150 V126 H60 V150Z M276 150 V124 H320 V150Z" fill="#5d5a78" />
      <rect x="0" y="150" width="320" height="30" fill="#4e6788" />
    </g>
  ),
  tokyo: (
    <g>
      <path d="M180 140 L240 70 L300 140Z" fill="#3c2c6a" />
      <path d="M228 84 L240 70 L252 84 L246 88 L240 82 L234 88Z" fill="#e8e4f8" />
      {/* Tokyo tower */}
      <path d="M118 150 L128 60 L130 40 L132 60 L142 150 H136 L130 110 L124 150Z" fill="#ff5a4a" />
      <rect x="121" y="96" width="18" height="3" fill="#ffd6cc" />
      <rect x="125" y="70" width="10" height="3" fill="#ffd6cc" />
      <path d="M0 150 V96 H24 V150Z M28 150 V110 H50 V150Z M54 150 V88 H80 V150Z M84 150 V112 H110 V150Z M150 150 V100 H174 V150Z M178 150 V116 H200 V150Z M204 150 V92 H232 V150Z M236 150 V108 H262 V150Z M266 150 V98 H292 V150Z M296 150 V114 H320 V150Z" fill="#1c1f44" />
      {[[8, 104, '#ff3d8b'], [60, 96, '#22e1ff'], [92, 120, '#ffe23d'], [158, 108, '#9d5cff'], [212, 100, '#ff3d8b'], [272, 106, '#22e1ff'], [36, 118, '#3dff9a'], [242, 116, '#ffe23d']].map(([x, y, col], i) => (
        <rect key={i} x={x as number} y={y as number} width="10" height="16" rx="1.5" fill={col as string} opacity="0.9" />
      ))}
      <rect x="0" y="150" width="320" height="30" fill="#141632" />
      <path d="M40 160 L80 175 M80 160 L40 175 M200 160 L240 175 M240 160 L200 175" stroke="#e8e8f0" strokeWidth="1.5" opacity="0.6" />
    </g>
  ),
  dublin: (
    <g>
      <circle cx="60" cy="56" r="15" fill="#fffbe8" opacity="0.9" />
      {hills('#6fa78a')}
      {/* Spire */}
      <path d="M158 150 L160.5 18 L163 150Z" fill="#d7e2ea" />
      {/* Custom House dome */}
      <path d="M210 150 V116 H290 V150Z" fill="#c9c0a8" />
      <path d="M238 116 Q250 92 262 116Z" fill="#5fa58a" />
      <rect x="248" y="88" width="4" height="10" fill="#5fa58a" />
      {/* Georgian terrace with doors */}
      {[0, 26, 52, 78, 104].map((x, i) => (
        <g key={i}>
          <rect x={x} y="112" width="24" height="38" fill="#a8553f" />
          <rect x={x + 9} y="136" width="6" height="14" fill={['#d33a3a', '#2f6fd6', '#2f9a5a', '#f2b93a', '#8a3fd6'][i]} />
        </g>
      ))}
      <rect x="0" y="150" width="320" height="30" fill="#4c7a7e" />
      {/* Ha'penny bridge */}
      <path d="M40 158 Q90 140 140 158" stroke="#f4f4f4" strokeWidth="3" fill="none" />
    </g>
  ),
};
