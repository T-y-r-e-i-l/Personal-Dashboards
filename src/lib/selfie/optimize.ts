export const SELFIE_MAX_EDGE = 720;
export const SELFIE_JPEG_QUALITY = 0.82;

/** Center-crop to square, resize to max edge, encode as JPEG. */
export async function optimizeSelfieBlob(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  {
    maxEdge = SELFIE_MAX_EDGE,
    quality = SELFIE_JPEG_QUALITY,
  }: { maxEdge?: number; quality?: number } = {},
): Promise<Blob> {
  const side = Math.min(sourceWidth, sourceHeight);
  const sx = Math.floor((sourceWidth - side) / 2);
  const sy = Math.floor((sourceHeight - side) / 2);
  const out = Math.min(maxEdge, side);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo");

  ctx.drawImage(source, sx, sy, side, side, 0, 0, out, out);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
  });
  if (!blob) throw new Error("Could not encode photo");
  return blob;
}

export async function optimizeSelfieFromVideo(
  video: HTMLVideoElement,
): Promise<Blob> {
  return optimizeSelfieBlob(video, video.videoWidth, video.videoHeight);
}

export async function optimizeSelfieFromImageUrl(
  url: string,
): Promise<Blob> {
  const image = await loadImage(url);
  return optimizeSelfieBlob(image, image.naturalWidth, image.naturalHeight);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}
