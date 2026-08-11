import { zipSync, strToU8 } from "fflate";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capture } from "@/lib/database.types";
import {
  mediaSrcToPath,
  resolveMediaUrl,
} from "@/lib/media/noteMedia";
import {
  captureToMarkdownFile,
  extractMediaSrcs,
  uniqueMediaFileName,
} from "@/lib/export/noteMarkdown";

export type ExportDownload = {
  blob: Blob;
  filename: string;
};

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadExport(result: ExportDownload) {
  triggerBrowserDownload(result.blob, result.filename);
}

type MediaResolution = {
  /** mediaSrc -> relative path used inside that note's markdown */
  linkMaps: Map<string, Record<string, string>>;
  missingByCapture: Map<string, string[]>;
  /** zip path (media/foo.png) -> bytes */
  mediaFiles: Record<string, Uint8Array>;
};

async function resolveMediaForCaptures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  captures: Capture[],
  relativePrefix: "media/" | "../media/",
): Promise<MediaResolution> {
  const usedNames = new Set<string>();
  /** storage path -> zip basename (shared across notes) */
  const pathToBasename = new Map<string, string>();
  const mediaFiles: Record<string, Uint8Array> = {};
  const failedPaths = new Set<string>();
  const linkMaps = new Map<string, Record<string, string>>();
  const missingByCapture = new Map<string, string[]>();

  const allSrcs = new Set<string>();
  for (const capture of captures) {
    for (const src of extractMediaSrcs(capture.content)) {
      allSrcs.add(src);
    }
  }

  for (const src of allSrcs) {
    const storagePath = mediaSrcToPath(src);
    if (pathToBasename.has(storagePath) || failedPaths.has(storagePath)) {
      continue;
    }

    try {
      const signed = await resolveMediaUrl(supabase, src);
      const res = await fetch(signed);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = new Uint8Array(await res.arrayBuffer());
      const basename = uniqueMediaFileName(storagePath, usedNames);
      pathToBasename.set(storagePath, basename);
      mediaFiles[`media/${basename}`] = buffer;
    } catch {
      failedPaths.add(storagePath);
    }
  }

  for (const capture of captures) {
    const linkMap: Record<string, string> = {};
    const missing: string[] = [];
    for (const src of extractMediaSrcs(capture.content)) {
      const storagePath = mediaSrcToPath(src);
      const basename = pathToBasename.get(storagePath);
      if (basename) {
        linkMap[src] = `${relativePrefix}${basename}`;
      } else {
        missing.push(src);
      }
    }
    linkMaps.set(capture.id, linkMap);
    missingByCapture.set(capture.id, missing);
  }

  return { linkMaps, missingByCapture, mediaFiles };
}

/** Export one note: plain .md when no media; ZIP with media/ otherwise. */
export async function exportSingleCapture(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  capture: Capture,
): Promise<ExportDownload> {
  const srcs = extractMediaSrcs(capture.content);
  if (srcs.length === 0) {
    const { filename, markdown } = captureToMarkdownFile(capture, {});
    return {
      blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      filename,
    };
  }

  const { linkMaps, missingByCapture, mediaFiles } =
    await resolveMediaForCaptures(supabase, [capture], "media/");
  const { filename, markdown } = captureToMarkdownFile(
    capture,
    linkMaps.get(capture.id) ?? {},
    missingByCapture.get(capture.id) ?? [],
  );

  const files: Record<string, Uint8Array> = {
    [filename]: strToU8(markdown),
    ...mediaFiles,
  };
  const zipped = zipSync(files);
  const base = filename.replace(/\.md$/, "");
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    filename: `${base}.zip`,
  };
}

/** Bulk export loaded captures as notes/ + media/ ZIP. */
export async function exportCapturesBulk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  captures: Capture[],
): Promise<ExportDownload> {
  if (captures.length === 0) {
    throw new Error("No notes to export");
  }

  const { linkMaps, missingByCapture, mediaFiles } =
    await resolveMediaForCaptures(supabase, captures, "../media/");

  const files: Record<string, Uint8Array> = { ...mediaFiles };
  const usedMdNames = new Set<string>();

  for (const capture of captures) {
    let { filename, markdown } = captureToMarkdownFile(
      capture,
      linkMaps.get(capture.id) ?? {},
      missingByCapture.get(capture.id) ?? [],
    );
    // Disambiguate rare filename collisions (same day + short id collide only if ids share prefix — still guard).
    if (usedMdNames.has(filename)) {
      const full = `${format(new Date(capture.created_at), "yyyy-MM-dd")}-${capture.id}.md`;
      filename = full;
    }
    usedMdNames.add(filename);
    files[`notes/${filename}`] = strToU8(markdown);
  }

  // Ensure empty notes still produce a valid zip structure hint
  if (!Object.keys(files).some((k) => k.startsWith("notes/"))) {
    files["notes/.keep"] = strToU8("");
  }

  const zipped = zipSync(files);
  const day = format(new Date(), "yyyy-MM-dd");
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    filename: `ghost-writer-notes-${day}.zip`,
  };
}
