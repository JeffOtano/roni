import { createOgImage, ogContentType, ogSize } from "../_components/createOgImage";

export const alt = "Roni FAQ — Common Questions";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("FAQ", "Common Questions About Roni");
}
