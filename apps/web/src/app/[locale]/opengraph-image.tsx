import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'HearMe — a safe space to talk, reflect, and feel heard';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Branded social card shared across marketing pages. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #5B5BEF 0%, #9D8DF1 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: 80,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, opacity: 0.95 }}>
          ((H)) HearMe
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, marginTop: 28, lineHeight: 1.1, maxWidth: 900 }}>
          A safe space to talk, reflect, and feel heard.
        </div>
        <div style={{ fontSize: 30, marginTop: 28, opacity: 0.9, maxWidth: 820 }}>
          Voice-first AI companion · talk in your language · insights & mood reports
        </div>
      </div>
    ),
    size,
  );
}
