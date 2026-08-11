import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Capture } from "@/lib/database.types";
import {
  captureFilename,
  captureToMarkdownFile,
  extractMediaSrcs,
  rewriteMediaLinks,
  uniqueMediaFileName,
} from "@/lib/export/noteMarkdown";

const sampleCapture = (overrides: Partial<Capture> = {}): Capture => ({
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  user_id: "user-1",
  content: "Hello",
  tags: ["life", "work"],
  priority: "high",
  visibility: "private",
  created_at: "2026-08-10T15:30:00.000Z",
  updated_at: "2026-08-11T09:00:00.000Z",
  ...overrides,
});

describe("extractMediaSrcs", () => {
  it("returns unique media:// URLs from markdown", () => {
    const src =
      "media://note-media/user/123-photo.png";
    const content = `See ![a](${src}) and [b](${src}) plus media://note-media/user/456-doc.pdf`;
    assert.deepEqual(extractMediaSrcs(content), [
      "media://note-media/user/123-photo.png",
      "media://note-media/user/456-doc.pdf",
    ]);
  });

  it("returns empty for plain text", () => {
    assert.deepEqual(extractMediaSrcs("no media here"), []);
  });
});

describe("rewriteMediaLinks", () => {
  it("rewrites successful links to relative paths", () => {
    const src = "media://note-media/u/1-img.png";
    const out = rewriteMediaLinks(`![x](${src})`, {
      [src]: "../media/1-img.png",
    });
    assert.equal(out, "![x](../media/1-img.png)");
  });

  it("stubs missing image and link nodes", () => {
    const src = "media://note-media/u/1-gone.png";
    const out = rewriteMediaLinks(
      `![gone](${src})\n\n[file](${src})`,
      {},
      [src],
    );
    assert.match(out, /<!-- missing media: 1-gone\.png -->/);
    assert.equal(out.includes(src), false);
  });
});

describe("uniqueMediaFileName", () => {
  it("uses sanitized basename and disambiguates collisions", () => {
    const used = new Set<string>();
    assert.equal(
      uniqueMediaFileName("user/123-my photo.png", used),
      "123-my-photo.png",
    );
    assert.equal(
      uniqueMediaFileName("user/other/123-my photo.png", used),
      "123-my-photo-2.png",
    );
  });
});

describe("captureFilename", () => {
  it("uses created date and short id", () => {
    assert.equal(
      captureFilename(sampleCapture()),
      "2026-08-10-a1b2c3d4.md",
    );
  });
});

describe("captureToMarkdownFile", () => {
  it("emits YAML frontmatter and rewritten body", () => {
    const src = "media://note-media/u/abc-shot.jpg";
    const { filename, markdown } = captureToMarkdownFile(
      sampleCapture({ content: `Note with ![shot](${src})` }),
      { [src]: "media/abc-shot.jpg" },
    );
    assert.equal(filename, "2026-08-10-a1b2c3d4.md");
    assert.match(markdown, /^---\n/);
    assert.match(markdown, /id: a1b2c3d4-e5f6-7890-abcd-ef1234567890/);
    assert.match(markdown, /visibility: private/);
    assert.match(markdown, /tags: \[life, work\]/);
    assert.match(markdown, /priority: high/);
    assert.match(markdown, /!\[shot\]\(media\/abc-shot\.jpg\)/);
  });

  it("uses null priority when unset", () => {
    const { markdown } = captureToMarkdownFile(
      sampleCapture({ priority: null, tags: [], content: "plain" }),
      {},
    );
    assert.match(markdown, /priority: null/);
    assert.match(markdown, /tags: \[\]/);
  });
});
