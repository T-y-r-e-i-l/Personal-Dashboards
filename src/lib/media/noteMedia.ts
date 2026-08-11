import type { SupabaseClient } from "@supabase/supabase-js";

export const NOTE_MEDIA_BUCKET = "note-media";
export const MEDIA_SCHEME = "media://note-media/";
const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "application/pdf",
]);

export function isMediaSrc(src?: string | null) {
  return Boolean(src?.startsWith(MEDIA_SCHEME));
}

export function mediaSrcToPath(src: string) {
  return src.slice(MEDIA_SCHEME.length);
}

export function pathToMediaSrc(path: string) {
  return `${MEDIA_SCHEME}${path}`;
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function validateMediaFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      "Unsupported file type. Use image, video, audio, or PDF.",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large. Max size is 20MB.");
  }
}

export function markdownForMedia(file: File, mediaSrc: string) {
  const safeName = file.name.replace(/]/g, "");
  if (file.type.startsWith("image/")) {
    return `![${safeName}](${mediaSrc})`;
  }
  if (file.type.startsWith("video/")) {
    return `[🎬 ${safeName}](${mediaSrc})`;
  }
  if (file.type.startsWith("audio/")) {
    return `[🎧 ${safeName}](${mediaSrc})`;
  }
  return `[📎 ${safeName}](${mediaSrc})`;
}

export async function uploadNoteMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  file: File,
) {
  validateMediaFile(file);

  const safe = sanitizeFileName(file.name);
  const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;

  const { error } = await supabase.storage
    .from(NOTE_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  return {
    path,
    mediaSrc: pathToMediaSrc(path),
    markdown: markdownForMedia(file, pathToMediaSrc(path)),
  };
}

export async function resolveMediaUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  src: string,
) {
  if (!isMediaSrc(src)) return src;
  const path = mediaSrcToPath(src);
  const { data, error } = await supabase.storage
    .from(NOTE_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not resolve media URL");
  }
  return data.signedUrl;
}

export function mediaKindFromSrc(src: string) {
  const lower = src.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)) return "image" as const;
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return "video" as const;
  if (/\.(mp3|wav|webm|m4a)(\?|$)/.test(lower)) return "audio" as const;
  if (/\.pdf(\?|$)/.test(lower)) return "pdf" as const;
  return "file" as const;
}
