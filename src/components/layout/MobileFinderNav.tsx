"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { AddPanelMenu } from "@/components/dashboard/AddPanelMenu";
import type { PanelType } from "@/lib/panels/types";

export function MobileFinderNav({
  todayActive,
  blogActive,
  settingsActive,
  showAddPanel,
  addOpen,
  onToggleAdd,
  onAddPanel,
  onCloseAdd,
  onNavigate,
  email,
}: {
  todayActive: boolean;
  blogActive: boolean;
  settingsActive: boolean;
  showAddPanel: boolean;
  addOpen: boolean;
  onToggleAdd: () => void;
  onAddPanel: (type: PanelType) => void;
  onCloseAdd: () => void;
  onNavigate: () => void;
  email: string | undefined;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        className="mobile-finder-grid grid grid-cols-3 gap-x-2 gap-y-4 p-4"
        aria-label="Main"
      >
        <FinderIconLink
          href="/dashboard"
          label="Today"
          active={todayActive}
          kind="document"
          onNavigate={onNavigate}
        />
        <FinderIconLink
          href="/blog"
          label="Blog"
          active={blogActive}
          kind="folder"
          onNavigate={onNavigate}
        />
        <FinderIconLink
          href="/settings"
          label="Settings"
          active={settingsActive}
          kind="document"
          onNavigate={onNavigate}
        />
        {showAddPanel ? (
          <div className="relative flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onToggleAdd}
              className={`mobile-finder-icon flex flex-col items-center gap-1 ${
                addOpen ? "is-active" : ""
              }`}
              aria-expanded={addOpen}
              aria-haspopup="menu"
            >
              <MacAppIcon />
              <span className="mobile-finder-label text-center text-[11px] leading-tight">
                Add panel
              </span>
            </button>
            {addOpen ? (
              <div className="absolute left-1/2 top-full z-50 mt-1 w-56 -translate-x-1/2">
                <AddPanelMenu onSelect={onAddPanel} onClose={onCloseAdd} />
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className="mt-auto space-y-2 border-t border-black px-4 py-3">
        {email ? (
          <p className="truncate text-xs text-[var(--muted)]" title={email}>
            {email}
          </p>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}

function FinderIconLink({
  href,
  label,
  active,
  kind,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  kind: "document" | "folder";
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`mobile-finder-icon flex flex-col items-center gap-1 ${
        active ? "is-active" : ""
      }`}
      aria-current={active ? "page" : undefined}
    >
      {kind === "folder" ? <MacFolderIcon /> : <MacDocumentIcon />}
      <span className="mobile-finder-label text-center text-[11px] leading-tight">
        {label}
      </span>
    </Link>
  );
}

function MacDocumentIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden
      className="mobile-finder-glyph"
    >
      <rect x="6" y="3" width="16" height="22" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <path d="M18 3v6h6" fill="#ddd" stroke="#000" strokeWidth="1.5" />
      <path d="M18 3l6 6" fill="none" stroke="#000" strokeWidth="1.5" />
      <path
        d="M10 14h10M10 17h10M10 20h7"
        stroke="#000"
        strokeWidth="1.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function MacFolderIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden
      className="mobile-finder-glyph"
    >
      <path
        d="M4 10h8l2 2h14v14H4V10Z"
        fill="#f2d060"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h24v14H4V12Z"
        fill="#ffe28a"
        stroke="#000"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MacAppIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden
      className="mobile-finder-glyph"
    >
      <rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="0"
        fill="#ddd"
        stroke="#000"
        strokeWidth="1.5"
      />
      <path
        d="M16 10v12M10 16h12"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}
