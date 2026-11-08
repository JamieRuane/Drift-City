import type { CityId } from '../../game/cities/types';

/** Small SVG flags (flag emoji do not render on Windows). */
export function Flag({ id, size = 28 }: { id: CityId; size?: number }) {
  const h = Math.round(size * 0.68);
  const common = { width: size, height: h, viewBox: '0 0 30 20', className: 'flag-svg', 'aria-hidden': true } as const;
  switch (id) {
    case 'paris':
      return (
        <svg {...common}>
          <rect width="10" height="20" fill="#0055a4" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#ef4135" />
        </svg>
      );
    case 'dublin':
      return (
        <svg {...common}>
          <rect width="10" height="20" fill="#169b62" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#ff883e" />
        </svg>
      );
    case 'tokyo':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#fff" />
          <circle cx="15" cy="10" r="6" fill="#bc002d" />
        </svg>
      );
    case 'london':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
          <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6" />
          <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.4" />
        </svg>
      );
    case 'newyork':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#fff" />
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} y={(i * 2 * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
          ))}
          <rect width="13" height={(20 / 13) * 7} fill="#3c3b6e" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={1.6 + (i % 4) * 3.2} cy={1.8 + Math.floor(i / 4) * 3.4} r="0.7" fill="#fff" />
          ))}
        </svg>
      );
  }
}
