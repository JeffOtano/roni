import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "Roni Features — AI-Powered Custom Workouts, compatible with Tonal";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Features", "AI-Powered Custom Workouts, compatible with Tonal");
}
