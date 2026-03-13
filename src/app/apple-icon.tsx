import { ImageResponse } from "next/og";

export const alt = "tonal.coach";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const dmSansBold = await fetch(
    new URL(
      "https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwA_oBpSxE.ttf",
    ),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
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
      </div>
    ),
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
