import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "How tonal.coach Works — Custom Tonal Workouts in 3 Steps";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("How It Works", "Custom Tonal Workouts in 3 Steps");
}
