"use client";

import { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  isMediaSrc,
  mediaKindFromSrc,
  resolveMediaUrl,
} from "@/lib/media/noteMedia";

function urlTransform(url: string) {
  if (url.startsWith("media://")) return url;
  return defaultUrlTransform(url);
}

export function MarkdownContent({
  content,
  className,
  compact = false,
}: {
  content: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${className ?? ""} ${compact ? "markdown-compact" : ""}`.trim()}
    >
      <ReactMarkdown
        urlTransform={urlTransform}
        components={{
          img: ({ src, alt }) => (
            <MediaImage
              src={typeof src === "string" ? src : undefined}
              alt={alt}
              compact={compact}
            />
          ),
          a: ({ href, children }) => (
            <MediaLink
              href={typeof href === "string" ? href : undefined}
              compact={compact}
            >
              {children}
            </MediaLink>
          ),
          p: ({ children }) => <div className="md-block">{children}</div>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MediaImage({
  src,
  alt,
  compact,
}: {
  src?: string;
  alt?: string;
  compact?: boolean;
}) {
  const { url, error, loading } = useSignedUrl(src);

  if (!src) return null;

  if (loading) {
    return (
      <span className="inline-block rounded-lg bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--muted)]">
        Loading image…
      </span>
    );
  }

  if (error || !url) {
    return (
      <span className="inline-block rounded-lg bg-red-50 px-2 py-1 text-xs text-[var(--danger)]">
        {error ?? "Media unavailable"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? ""}
      className={`my-2 max-w-full rounded-xl border border-[var(--border)] object-contain ${
        compact ? "max-h-36" : "max-h-72"
      }`}
    />
  );
}

function MediaLink({
  href,
  children,
  compact,
}: {
  href?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { url, error, loading } = useSignedUrl(href);
  const kind = href ? mediaKindFromSrc(href) : "file";

  if (href && isMediaSrc(href)) {
    if (loading) {
      return (
        <span className="text-sm text-[var(--muted)]">Loading media…</span>
      );
    }

    if (error || !url) {
      return (
        <span className="text-xs text-[var(--danger)]">
          {error ?? "Media unavailable"}
        </span>
      );
    }

    if (kind === "video") {
      return (
        <video
          controls
          src={url}
          className={`my-2 w-full max-w-xl rounded-xl border border-[var(--border)] ${
            compact ? "max-h-36" : "max-h-72"
          }`}
        />
      );
    }

    if (kind === "audio") {
      return <audio controls src={url} className="my-2 w-full max-w-xl" />;
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--accent)] underline underline-offset-2"
      >
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--accent)] underline underline-offset-2"
    >
      {children}
    </a>
  );
}

function useSignedUrl(src?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (!src) {
        setUrl(null);
        setLoading(false);
        return;
      }

      if (!isMediaSrc(src)) {
        setUrl(src);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const supabase = createClient();
        const signed = await resolveMediaUrl(supabase, src);
        if (!cancelled) {
          setUrl(signed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setUrl(null);
          setLoading(false);
          setError(
            err instanceof Error
              ? err.message.includes("Bucket not found") ||
                err.message.includes("not found")
                ? "Storage not set up — run note-media migration"
                : err.message
              : "Could not load media",
          );
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return { url, error, loading };
}
