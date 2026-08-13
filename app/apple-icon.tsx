import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1e7d3",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 100 100">
          <path d="M 24 66 A 26 26 0 0 1 76 66 Z" fill="#2a211a" />
          <rect x="18" y="64" width="64" height="7" rx="3.5" fill="#2a211a" />
          <rect x="48" y="32" width="4" height="10" fill="#2a211a" />
          <circle cx="50" cy="28" r="5" fill="#2a211a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
