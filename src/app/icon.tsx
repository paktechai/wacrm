import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#7A7CFF 0%,#5265FF 58%,#2DD4BF 100%)",
          borderRadius: 8,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
          <path
            d="M14 21.5A7.5 7.5 0 0 1 21.5 14H47l-8 8H23v7h18.5A8.5 8.5 0 0 1 50 37.5 8.5 8.5 0 0 1 41.5 46H14l8-8h18a.5.5 0 0 0 0-1H22.5A8.5 8.5 0 0 1 14 28.5v-7Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
