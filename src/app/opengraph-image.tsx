import { ImageResponse } from 'next/og';

export const alt = 'Wova8 — business software for customer operations';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        color: '#f8fafc',
        background:
          'radial-gradient(circle at 18% 0%,#2b2057 0%,#0b0d14 45%,#07090e 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          fontSize: '36px',
          fontWeight: 800,
        }}
      >
        <div
          style={{
            width: '62px',
            height: '62px',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg,#a78bfa,#6d5dfc 58%,#22d3ee)',
            fontSize: '32px',
          }}
        >
          W
        </div>
        Wova<span style={{ color: '#a78bfa' }}>8</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            maxWidth: '940px',
            fontSize: '70px',
            lineHeight: 1.03,
            letterSpacing: '-3px',
            fontWeight: 700,
          }}
        >
          Business software for clearer customer operations.
        </div>
        <div style={{ marginTop: '30px', fontSize: '27px', color: '#a8b0c1' }}>
          Communication · Relationships · Automation · AI-assisted work
        </div>
      </div>
    </div>,
    size
  );
}
