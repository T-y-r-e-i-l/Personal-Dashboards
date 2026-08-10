export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[100px] flex-col items-start justify-center gap-3 text-[var(--muted)]">
      <p className="text-sm leading-relaxed">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] transition hover:opacity-90"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
