// AppIcon.jsx — production-ready React component for the GPX export app icon.
// Concept: "Route divider" — a white activity route is the boundary between
// Strava orange (above) and Komoot green (below); a download badge sits at
// the lower-right. Resolution-independent (single 100-unit SVG, scaled).
//
// Usage:
//   <AppIcon size={64} />            // full-bleed square (let a container round it)
//   <AppIcon size={64} rounded />    // rounded preview (iOS-squircle approximation)

import React from 'react';

export const ICON_TOKENS = {
  orange: '#FC4C02', // Strava — background, above the route
  green:  '#5E9E2E', // Komoot — below the route
  ink:    '#15191C', // download arrow
  white:  '#FFFFFF', // route + badge
};

// Shared geometry (100×100 design space)
const ROUTE = 'M22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33';
const GREEN_FILL =
  'M0 57 L22 53 C 30 53, 33 43, 41 45 C 47 46, 50 59, 58 52 C 64 47, 69 35, 77 33 L100 28 L100 100 L0 100 Z';

export default function AppIcon({ size = 64, rounded = false, title = 'GPX export' }) {
  const t = ICON_TOKENS;
  const clipId = React.useId();
  const content = (
    <>
      <rect width="100" height="100" fill={t.orange} />
      <path d={GREEN_FILL} fill={t.green} />
      <path d={ROUTE} fill="none" stroke={t.white} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="53" r="4.6" fill={t.white} />
      <circle cx="77" cy="33" r="4.6" fill={t.white} />
      <circle cx="72" cy="73.5" r="14.5" fill={t.white} />
      <g fill="none" stroke={t.ink} strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M72 66.5 V76" />
        <path d="M66.8 71.6 L72 77 L77.2 71.6" />
        <path d="M66 80.5 H78" />
      </g>
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
      {rounded ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect width="100" height="100" rx="22.37" ry="22.37" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>{content}</g>
        </>
      ) : content}
    </svg>
  );
}
