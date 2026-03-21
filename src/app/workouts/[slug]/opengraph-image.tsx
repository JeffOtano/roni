import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";

export const alt = "Tonal workout — tonal.coach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function WorkoutOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workout = await fetchQuery(api.libraryWorkouts.getBySlug, { slug });

  const dmSansBold = await readFile(join(process.cwd(), "src/app/fonts/DMSans-Bold.ttf"));

  const title = workout?.title ?? "Tonal Workout";
  const sessionLabel = workout
    ? getSessionTypeLabel(workout.sessionType as LibrarySessionType)
    : "";
  const goalLabel = workout ? getGoalLabel(workout.goal as LibraryGoal) : "";
  const duration = workout ? `${workout.durationMinutes}min` : "";
  const level = workout ? workout.level.charAt(0).toUpperCase() + workout.level.slice(1) : "";
  const muscles = workout ? workout.targetMuscleGroups.slice(0, 3).join(" · ") : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0a0a0a",
        padding: "60px",
        position: "relative",
      }}
    >
      {/* Subtle teal glow */}
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "250px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,202,203,0.12) 0%, transparent 70%)",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Top: branding */}
      <div style={{ display: "flex", fontSize: "28px", fontFamily: "DM Sans", fontWeight: 700 }}>
        <span style={{ color: "#ffffff" }}>tonal</span>
        <span style={{ color: "#00cacb" }}>.</span>
        <span style={{ color: "#ffffff" }}>coach</span>
      </div>

      {/* Middle: title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            fontSize: "52px",
            fontFamily: "DM Sans",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            maxWidth: "900px",
          }}
        >
          {title}
        </div>
        {muscles && (
          <div
            style={{
              fontSize: "22px",
              fontFamily: "DM Sans",
              fontWeight: 700,
              color: "#00cacb",
            }}
          >
            {muscles}
          </div>
        )}
      </div>

      {/* Bottom: meta pills */}
      <div style={{ display: "flex", gap: "16px" }}>
        {[sessionLabel, goalLabel, duration, level].filter(Boolean).map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "8px 18px",
              fontSize: "18px",
              fontFamily: "DM Sans",
              fontWeight: 700,
              color: "#a0a0a0",
            }}
          >
            {label}
          </div>
        ))}
      </div>
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
