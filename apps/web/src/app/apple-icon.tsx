import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon (home-screen) — HearMe mark on brand gradient. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #5B5BEF 0%, #9D8DF1 100%)',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 48 48" fill="none">
          <path
            d="M9 18c-2.2 2-2.2 10 0 12M5 15c-3.5 3-3.5 15 0 18"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.7}
          />
          <path
            d="M18 12v24M30 12v24M18 24h12"
            stroke="white"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M39 18c2.2 2 2.2 10 0 12M43 15c3.5 3 3.5 15 0 18"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.7}
          />
        </svg>
      </div>
    ),
    size,
  );
}
