import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "tonal.coach";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const dmSansBold = await readFile(join(process.cwd(), "src/app/fonts/DMSans-Bold.ttf"));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        borderRadius: "36px",
      }}
    >
      <span
        style={{
          fontSize: "100px",
          fontFamily: "DM Sans",
          fontWeight: 700,
          color: "#00cacb",
          letterSpacing: "-3px",
        }}
      >
        tc
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
