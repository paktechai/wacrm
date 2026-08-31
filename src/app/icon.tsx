import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg,#a78bfa 0%,#6d5dfc 58%,#22d3ee 100%)',
        borderRadius: 8,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
        <path
          d="M10 17 17 47l15-20 15 20 7-30"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    { ...size }
  );
}
