"use client";

import type { ReactNode } from "react";

export function NoteWindow({
  title,
  meta,
  actions,
  children,
  onBodyClick,
  bodyClassName = "",
  as: Tag = "div",
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  onBodyClick?: () => void;
  bodyClassName?: string;
  as?: "div" | "li" | "article";
}) {
  const clickable = Boolean(onBodyClick);

  return (
    <Tag className="note-window panel-card overflow-hidden">
      <div className="note-window-titlebar panel-title-bar flex items-center gap-2 px-2 py-1">
        <div className="panel-title-stripes" aria-hidden />
        <div className="panel-title-label relative z-[1] w-fit max-w-full shrink-0 truncate text-sm font-semibold tracking-tight">
          {title}
        </div>
        {actions ? (
          <div className="note-window-actions shrink-0">{actions}</div>
        ) : null}
      </div>

      <div className="note-window-meta">
        <div className="note-window-meta-title">{title}</div>
        <div className="note-window-meta-aside">
          {meta}
          {actions}
        </div>
      </div>

      <div
        className={`note-window-body notes-hand markdown-body ${
          clickable ? "is-clickable" : ""
        } ${bodyClassName}`.trim()}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        title={clickable ? "Edit note" : undefined}
        onClick={
          clickable
            ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest("button, a, video, audio, input, textarea, label")) {
                  return;
                }
                onBodyClick?.();
              }
            : undefined
        }
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onBodyClick?.();
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    </Tag>
  );
}
