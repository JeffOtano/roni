import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "tonal.coach Features — AI-Powered Custom Workouts for Tonal";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Features", "AI-Powered Custom Workouts for Tonal");
}
