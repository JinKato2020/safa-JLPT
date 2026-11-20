import type { Daylight } from '../data/daylight';

// The study-room character is lower in the night artwork.
const FACE_Y: Record<Daylight, number> = { day: 0.485, night: 0.56 };

export function studyBannerFrame(
  period: Daylight, width: number, windowHeight: number, sourceWidth?: number, sourceHeight?: number,
) {
  const height = Math.max(windowHeight < 700 ? 88 : 120, Math.ceil(width * 0.19));
  if (!width) return { height };
  if (!sourceWidth || !sourceHeight) return { height, image: { width, height, top: 0 } };
  const imageHeight = Math.max(height, width * sourceHeight / sourceWidth);
  const offset = Math.min(imageHeight - height, Math.max(0, imageHeight * FACE_Y[period] - height / 2));
  return { height, image: { width, height: imageHeight, top: -offset } };
}
