import { format } from "date-fns";
import type { Capture } from "@/lib/database.types";
import { MEDIA_SCHEME, mediaSrcToPath, sanitizeFileName } from "@/lib/media/noteMedia";

const MEDIA_SRC_RE = /media:\/\/note-media\/[^\s)\]"'<>]+/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function yamlScalar(value: string) {
  if (
    value === "" ||
    /[:#{}[\],&*?|>!%@`]/.test(value) ||
    /^\s|\s$/.test(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
}

function yamlTags(tags: string[]) {
  if (!tags.length) return "[]";
  return `[${tags.map((t) => yamlScalar(t)).join(", ")}]`;
}

/** Unique media://note-media/... URLs found in markdown content. */
export function extractMediaSrcs(content: string): string[] {
  const matches = content.match(MEDIA_SRC_RE) ?? [];
  return [...new Set(matches.filter((src) => src.startsWith(MEDIA_SCHEME)))];
}

/**
 * Rewrite media:// links to relative paths. Missing sources become HTML comments
 * (markdown image/link nodes replaced entirely when possible).
 */
export function rewriteMediaLinks(
  content: string,
  linkMap: Record<string, string>,
  missingSrcs: string[] = [],
): string {
  let out = content;

  for (const src of missingSrcs) {
    const label = mediaSrcToPath(src).split("/").pop() ?? src;
    const stub = `<!-- missing media: ${label} -->`;
    const escaped = escapeRegExp(src);
    out = out.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g"), stub);
    out = out.replace(new RegExp(`\\[[^\\]]*\\]\\(${escaped}\\)`, "g"), stub);
    out = out.split(src).join(stub);
  }

  for (const [src, relativePath] of Object.entries(linkMap)) {
    out = out.split(src).join(relativePath);
  }

  return out;
}

/** Basename from storage path, sanitized and unique within `used`. */
export function uniqueMediaFileName(path: string, used: Set<string>): string {
  const rawBase = path.split("/").pop() || "file";
  const sanitized = sanitizeFileName(rawBase) || "file";
  if (!used.has(sanitized)) {
    used.add(sanitized);
    return sanitized;
  }

  const dot = sanitized.lastIndexOf(".");
  const stem = dot > 0 ? sanitized.slice(0, dot) : sanitized;
  const ext = dot > 0 ? sanitized.slice(dot) : "";
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export function captureFilename(
  capture: Pick<Capture, "id" | "created_at">,
): string {
  const date = format(new Date(capture.created_at), "yyyy-MM-dd");
  const shortId = capture.id.replace(/-/g, "").slice(0, 8);
  return `${date}-${shortId}.md`;
}

export function captureToMarkdownFile(
  capture: Capture,
  linkMap: Record<string, string>,
  missingSrcs: string[] = [],
): { filename: string; markdown: string } {
  const body = rewriteMediaLinks(capture.content, linkMap, missingSrcs);
  const priority =
    capture.priority === null || capture.priority === undefined
      ? "null"
      : capture.priority;

  const markdown = [
    "---",
    `id: ${capture.id}`,
    `created: ${capture.created_at}`,
    `updated: ${capture.updated_at}`,
    `visibility: ${capture.visibility}`,
    `tags: ${yamlTags(capture.tags ?? [])}`,
    `priority: ${priority}`,
    "---",
    "",
    body,
  ].join("\n");

  return {
    filename: captureFilename(capture),
    markdown,
  };
}
