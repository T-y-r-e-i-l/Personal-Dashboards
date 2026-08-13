"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { AddPanelMenu } from "@/components/dashboard/AddPanelMenu";
import type { PanelType } from "@/lib/panels/types";
import { playUiSound } from "@/lib/sounds/play";

export function MobileFinderNav({
  todayActive,
  blogActive,
  settingsActive,
  soundsActive,
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
  soundsActive: boolean;
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
        className="mobile-finder-grid grid grid-cols-2 gap-2 p-4"
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
          kind="gear"
          onNavigate={onNavigate}
        />
        <FinderIconLink
          href="/sounds"
          label="Sounds"
          active={soundsActive}
          kind="speaker"
          onNavigate={onNavigate}
        />
        {showAddPanel ? (
          <div className="mobile-finder-cell relative flex items-center justify-center">
            <button
              type="button"
              onClick={onToggleAdd}
              className={`mobile-finder-icon flex flex-col items-center justify-center gap-1 ${
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

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-black px-4 py-3">
        {email ? (
          <p
            className="min-w-0 flex-1 truncate text-xs text-[var(--muted)]"
            title={email}
          >
            {email}
          </p>
        ) : (
          <span />
        )}
        <div className="shrink-0 [&>button]:mt-0">
          <SignOutButton />
        </div>
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
  kind: "document" | "folder" | "gear" | "speaker";
  onNavigate: () => void;
}) {
  return (
    <div className="mobile-finder-cell flex items-center justify-center">
      <Link
        href={href}
        onClick={() => {
          playUiSound("nav_click");
          onNavigate();
        }}
        className={`mobile-finder-icon flex flex-col items-center justify-center gap-1 ${
          active ? "is-active" : ""
        }`}
        aria-current={active ? "page" : undefined}
      >
        {kind === "folder" ? (
          <MacFolderIcon />
        ) : kind === "gear" ? (
          <MacGearIcon />
        ) : kind === "speaker" ? (
          <MacSpeakerIcon />
        ) : (
          <MacDocumentIcon />
        )}
        <span className="mobile-finder-label text-center text-[11px] leading-tight">
          {label}
        </span>
      </Link>
    </div>
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
      <rect
        x="6"
        y="3"
        width="16"
        height="22"
        fill="#fff"
        stroke="#000"
        strokeWidth="1.5"
      />
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

function MacGearIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden
      className="mobile-finder-glyph"
    >
      <circle cx="16" cy="16" r="4.5" fill="#ddd" stroke="#000" strokeWidth="1.5" />
      <path
        d="M16 5.5v3.2M16 23.3v3.2M5.5 16h3.2M23.3 16h3.2M8.2 8.2l2.3 2.3M21.5 21.5l2.3 2.3M8.2 23.8l2.3-2.3M21.5 10.5l2.3-2.3"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <circle cx="16" cy="16" r="2" fill="#fff" stroke="#000" strokeWidth="1.2" />
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

function MacSpeakerIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden
      className="mobile-finder-glyph"
    >
      <path
        d="M6 12h4l6-5v18l-6-5H6V12Z"
        fill="#fff"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 12.5a4.5 4.5 0 0 1 0 7M23 10a8 8 0 0 1 0 12"
        fill="none"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
