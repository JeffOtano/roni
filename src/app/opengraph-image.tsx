import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "tonal.coach — AI Personal Trainer for Tonal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const dmSansBold = await readFile(join(process.cwd(), "src/app/fonts/DMSans-Bold.ttf"));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        position: "relative",
      }}
    >
      {/* Subtle teal glow */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,202,203,0.15) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Wordmark */}
      <div style={{ display: "flex", fontSize: "72px", fontFamily: "DM Sans", fontWeight: 700 }}>
        <span style={{ color: "#ffffff" }}>tonal</span>
        <span style={{ color: "#00cacb" }}>.</span>
        <span style={{ color: "#ffffff" }}>coach</span>
      </div>
      {/* Tagline */}
      <span
        style={{
          fontSize: "24px",
          color: "#a0a0a0",
          marginTop: "16px",
          fontFamily: "DM Sans",
          fontWeight: 700,
        }}
      >
        AI Personal Trainer for Tonal
      </span>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "DM Sans",
          data: dmSansBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
