import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "tonal.coach Pricing — Free During Beta";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Pricing", "Free During Beta");
}
