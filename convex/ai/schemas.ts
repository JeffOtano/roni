import { z } from "zod";

export const weekPlanPresentationSchema = z.object({
  weekStartDate: z.string(),
  split: z.enum(["ppl", "upper_lower", "full_body"]),
  days: z.array(
    z.object({
      dayName: z.string(),
      sessionType: z.string(),
      targetMuscles: z.string(),
      durationMinutes: z.number(),
      exercises: z.array(
        z.object({
          name: z.string(),
          sets: z.number(),
          reps: z.number(),
          targetWeight: z.number().optional(),
          lastWeight: z.number().optional(),
          lastReps: z.number().optional(),
          note: z.string().optional(),
        }),
      ),
    }),
  ),
  summary: z.string(),
});

export type WeekPlanPresentation = z.infer<typeof weekPlanPresentationSchema>;
