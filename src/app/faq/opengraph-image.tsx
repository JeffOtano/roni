import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "tonal.coach FAQ — Common Questions";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("FAQ", "Common Questions About tonal.coach");
}
