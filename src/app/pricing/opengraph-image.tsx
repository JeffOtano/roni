import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "Roni Pricing — Free and Open Source";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Pricing", "Free and Open Source");
}
