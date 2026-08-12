const MAX_TITLE_LEN = 80;

function stripMarkdownNoise(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → label
    .replace(/[*_~`]+/g, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateTitle(text: string, max = MAX_TITLE_LEN): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

function isSkippableLine(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  // Image-only / horizontal rules / HTML comments
  if (/^!\[.*\]\(.*\)\s*$/.test(t)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return true;
  if (/^<!--/.test(t)) return true;
  return false;
}

/** Prefer first ATX H1; else first non-empty line; else fallback. */
export function previewTitleFromMarkdown(
  content: string,
  fallback = "Shared note",
): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    if (!h1) continue;
    const title = stripMarkdownNoise(h1[1] ?? "");
    if (title) return truncateTitle(title);
  }

  for (const line of lines) {
    if (isSkippableLine(line)) continue;
    // Prefer a dedicated title line; skip other heading levels as "first line"
    // only after stripping markers via stripMarkdownNoise.
    const title = stripMarkdownNoise(line);
    if (title) return truncateTitle(title);
  }

  return fallback;
}
