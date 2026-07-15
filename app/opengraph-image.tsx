import { renderSocialImage, socialImageSize } from "./social-image";

export const alt = "BUBBLE HEX — Blue $nake Studio";
export const size = socialImageSize;
export const contentType = "image/png";

export default function Image() {
  return renderSocialImage();
}
