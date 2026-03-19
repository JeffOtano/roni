import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export async function createOgImage(title: string, subtitle?: string) {
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
      <div style={{ display: "flex", fontSize: "48px", fontFamily: "DM Sans", fontWeight: 700 }}>
        <span style={{ color: "#ffffff" }}>tonal</span>
        <span style={{ color: "#00cacb" }}>.</span>
        <span style={{ color: "#ffffff" }}>coach</span>
      </div>
      <span
        style={{
          fontSize: "36px",
          color: "#ffffff",
          marginTop: "24px",
          fontFamily: "DM Sans",
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: "20px",
            color: "#a0a0a0",
            marginTop: "12px",
            fontFamily: "DM Sans",
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "700px",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>,
    {
      ...ogSize,
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
