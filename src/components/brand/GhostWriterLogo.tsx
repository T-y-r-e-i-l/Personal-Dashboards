type LogoProps = {
  className?: string;
  /** Icon-only (e.g. collapsed sidebar). */
  markOnly?: boolean;
  /** Mark height in pixels; width follows the asset aspect ratio. */
  markSize?: number;
  /** Visually hide the wordmark but keep it for screen readers when markOnly. */
  label?: string;
};

const MARK_ASPECT = 134 / 181;

export function GhostWriterMark({
  className = "",
  size = 28,
  title,
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  const width = Math.round(size * MARK_ASPECT);
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 bg-[var(--ink)] ${className}`}
      style={{
        width,
        height: size,
        WebkitMaskImage: "url(/ghost-writer-mark-mask.png)",
        maskImage: "url(/ghost-writer-mark-mask.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

export function GhostWriterLogo({
  className = "",
  markOnly = false,
  markSize = 28,
  label = "Ghost Writer",
}: LogoProps) {
  if (markOnly) {
    return (
      <GhostWriterMark
        size={markSize}
        title={label}
        className={className}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 text-[var(--ink)] ${className}`}
    >
      <GhostWriterMark size={markSize} />
      <span className="font-[family-name:var(--font-display)] tracking-tight">
        {label}
      </span>
    </span>
  );
}
