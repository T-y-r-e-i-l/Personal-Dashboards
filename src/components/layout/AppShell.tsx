"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { useDashboardActions } from "@/components/dashboard/DashboardActionsContext";
import { AddPanelMenu } from "@/components/dashboard/AddPanelMenu";

const STORAGE_KEY = "pd-sidebar-collapsed";

type NavIconName = "today" | "blog" | "settings" | "add";

export function AppShell({
  email,
  children,
}: {
  email: string | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { canAddPanel, addPanel } = useDashboardActions();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const menuAddRef = useRef<HTMLDivElement>(null);
  const sidebarAddRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setCollapsed(stored === "1");
    setReady(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAddOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!addOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const inMenu = menuAddRef.current?.contains(target);
      const inSidebar = sidebarAddRef.current?.contains(target);
      const inMobile = mobileMenuRef.current?.contains(target);
      if (!inMenu && !inSidebar && !inMobile) setAddOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [addOpen]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const todayActive = pathname.startsWith("/dashboard");
  const blogActive = pathname.startsWith("/blog");
  const settingsActive = pathname.startsWith("/settings");
  const showAddPanel = canAddPanel && todayActive;

  return (
    <div className="flex min-h-screen flex-col">
      <nav
        className="app-menubar hidden h-[22px] shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-bold tracking-tight text-[var(--ink)]"
        aria-label="Main"
      >
        <Link
          href="/dashboard"
          className="app-menubar-brand px-2 py-0.5 font-bold hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
        >
          Ghost Writer
        </Link>
        <MenuBarLink href="/dashboard" active={todayActive} className="max-md:hidden">
          Today
        </MenuBarLink>
        <MenuBarLink href="/blog" active={blogActive} className="max-md:hidden">
          Blog
        </MenuBarLink>
        <MenuBarLink
          href="/settings"
          active={settingsActive}
          className="max-md:hidden"
        >
          Settings
        </MenuBarLink>
        {showAddPanel ? (
          <div className="relative max-md:hidden" ref={menuAddRef}>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className={`app-menubar-item px-2 py-0.5 font-normal ${
                addOpen
                  ? "bg-[var(--ink)] text-[var(--canvas)]"
                  : "hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
              }`}
              aria-expanded={addOpen}
              aria-haspopup="menu"
            >
              Add panel
            </button>
            {addOpen ? (
              <div className="absolute left-0 top-full z-40 mt-0.5">
                <AddPanelMenu
                  onSelect={(type) => {
                    addPanel(type);
                    setAddOpen(false);
                  }}
                  onClose={() => setAddOpen(false)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className={`app-menubar-mobile-toggle ml-auto px-2 py-0.5 font-normal md:hidden ${
            mobileOpen
              ? "bg-[var(--ink)] text-[var(--canvas)]"
              : "hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
          }`}
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-nav-window"
          aria-haspopup="dialog"
        >
          Menu
        </button>
        <div className="ml-auto hidden min-w-0 items-center gap-1 md:flex">
          {email ? (
            <span
              className="hidden max-w-[12rem] truncate px-2 font-normal text-[var(--muted)] sm:inline"
              title={email}
            >
              {email}
            </span>
          ) : null}
          <div className="app-menubar-signout px-1">
            <SignOutButton compact />
          </div>
        </div>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1">
      <aside
        className={`app-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/70 py-6 backdrop-blur transition-[width] duration-200 ease-out md:flex ${
          collapsed ? "relative w-[72px] px-2" : "w-56 px-4"
        } ${ready ? "" : "opacity-0"}`}
      >
        <div
          className={`flex gap-2 ${
            collapsed
              ? "w-full flex-col items-center"
              : "items-start justify-between"
          }`}
        >
          {!collapsed ? (
            <Link
              href="/dashboard"
              className="min-w-0 px-2 text-lg leading-tight"
            >
              <GhostWriterLogo markSize={26} className="text-lg" />
            </Link>
          ) : (
            <Link
              href="/dashboard"
              aria-label="Ghost Writer"
              className="flex items-center justify-center"
            >
              <GhostWriterLogo markOnly markSize={28} />
            </Link>
          )}
          {!collapsed ? (
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded
              className="rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              title="Collapse"
            >
              <CollapseIcon collapsed={false} />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl p-2 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
            title="Expand"
          >
            <CollapseIcon collapsed />
          </button>
        ) : null}

        <nav
          className={`app-sidebar-nav mt-10 flex flex-1 flex-col gap-1 ${collapsed ? "items-center" : ""}`}
        >
          <NavLink
            href="/dashboard"
            label="Today"
            collapsed={collapsed}
            active={todayActive}
            icon="today"
          />
          <NavLink
            href="/blog"
            label="Blog"
            collapsed={collapsed}
            active={blogActive}
            icon="blog"
          />
          <NavLink
            href="/settings"
            label="Settings"
            collapsed={collapsed}
            active={settingsActive}
            icon="settings"
          />
        </nav>

        <div
          className={`app-sidebar-footer space-y-3 ${collapsed ? "flex flex-col items-center" : "px-2"}`}
        >
          {showAddPanel ? (
            <div className="relative" ref={sidebarAddRef}>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                title="Add panel"
                aria-label="Add panel"
                className={`text-sm text-[var(--muted)] transition hover:text-[var(--ink)] ${
                  collapsed
                    ? "flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--surface-soft)]"
                    : "w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
                }`}
              >
                {collapsed ? <PlusIcon /> : "Add panel"}
              </button>
              {addOpen ? (
                <div className="absolute bottom-full left-0 z-30 mb-2">
                  <AddPanelMenu
                    onSelect={(type) => {
                      addPanel(type);
                      setAddOpen(false);
                    }}
                    onClose={() => setAddOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {!collapsed ? (
            <>
              <p className="truncate text-xs text-[var(--muted)]" title={email}>
                {email}
              </p>
              <SignOutButton />
            </>
          ) : (
            <SignOutButton compact />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-mobile-header flex items-center justify-between border-b border-[var(--border)] px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-lg">
            <GhostWriterLogo markSize={24} className="text-lg" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-[var(--ink)] hover:bg-[var(--surface-soft)]"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="app-mobile-nav-window"
          >
            <HamburgerIcon />
          </button>
        </header>

        {mobileOpen ? (
          <div className="app-mobile-nav-overlay fixed inset-0 z-[60] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[var(--ink)]/30"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <div
              id="app-mobile-nav-window"
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Ghost Writer"
              className="app-mobile-nav-window panel-card absolute left-1/2 top-[max(1.25rem,env(safe-area-inset-top))] w-[min(20.5rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden"
            >
              <div className="panel-title-bar flex items-center justify-between gap-2 px-4 pt-4">
                <div className="panel-title-stripes" aria-hidden />
                <div className="panel-title-leading relative z-[1] flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="panel-close-box panel-chrome-btn shrink-0 rounded-full px-2 py-1 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--danger)]"
                    aria-label="Close menu"
                  >
                    <span className="panel-close-box-label">Close</span>
                  </button>
                  <h2 className="panel-title-label truncate text-sm font-semibold tracking-tight">
                    Ghost Writer
                  </h2>
                </div>
              </div>
              <div className="panel-body px-4 pb-4 pt-3">
                <nav
                  className="app-mobile-nav-icons grid grid-cols-3 gap-x-2 gap-y-3"
                  aria-label="Pages"
                >
                  <MobileNavIcon
                    href="/dashboard"
                    label="Today"
                    active={todayActive}
                    icon="today"
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <MobileNavIcon
                    href="/blog"
                    label="Blog"
                    active={blogActive}
                    icon="blog"
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <MobileNavIcon
                    href="/settings"
                    label="Settings"
                    active={settingsActive}
                    icon="settings"
                    onNavigate={() => setMobileOpen(false)}
                  />
                  {showAddPanel ? (
                    <button
                      type="button"
                      onClick={() => setAddOpen((v) => !v)}
                      className={`app-mobile-nav-icon ${addOpen ? "is-active" : ""}`}
                      aria-expanded={addOpen}
                      aria-haspopup="menu"
                    >
                      <span className="app-mobile-nav-glyph" aria-hidden>
                        <PageUiIcon name="add" />
                      </span>
                      <span className="app-mobile-nav-label">Add panel</span>
                    </button>
                  ) : null}
                </nav>
                {showAddPanel && addOpen ? (
                  <div className="mt-3">
                    <AddPanelMenu
                      onSelect={(type) => {
                        addPanel(type);
                        setAddOpen(false);
                        setMobileOpen(false);
                      }}
                      onClose={() => setAddOpen(false)}
                    />
                  </div>
                ) : null}
                <div className="app-mobile-nav-footer mt-4 space-y-3 border-t border-[var(--border)] pt-3">
                  {email ? (
                    <p
                      className="truncate text-xs text-[var(--muted)]"
                      title={email}
                    >
                      {email}
                    </p>
                  ) : null}
                  <SignOutButton />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex-1">{children}</div>
      </div>
      </div>
    </div>
  );
}

function MenuBarLink({
  href,
  active,
  children,
  className = "",
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`app-menubar-item px-2 py-0.5 font-normal ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
      } ${className}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function NavLink({
  href,
  label,
  collapsed,
  active,
  icon,
}: {
  href: string;
  label: string;
  collapsed: boolean;
  active: boolean;
  icon: Exclude<NavIconName, "add">;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`flex items-center rounded-xl text-sm font-medium transition ${
        collapsed ? "h-10 w-10 justify-center" : "gap-2 px-3 py-2"
      } ${
        active
          ? "bg-[var(--surface-soft)] text-[var(--ink)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
      }`}
    >
      <NavIcon name={icon} />
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}

function MobileNavIcon({
  href,
  label,
  active,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: Exclude<NavIconName, "add">;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`app-mobile-nav-icon ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span className="app-mobile-nav-glyph" aria-hidden>
        <PageUiIcon name={icon} />
      </span>
      <span className="app-mobile-nav-label">{label}</span>
    </Link>
  );
}

function PageUiIcon({ name }: { name: NavIconName }) {
  if (name === "today") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="4" y="5" width="24" height="22" fill="#fff" stroke="#000" strokeWidth="1.5" />
        <rect x="4" y="5" width="24" height="6" fill="#dddddd" stroke="#000" strokeWidth="1.5" />
        <path d="M10 3.5v5M22 3.5v5" stroke="#000" strokeWidth="1.5" strokeLinecap="square" />
        <rect x="8" y="15" width="5" height="4" fill="#000099" />
        <rect x="14" y="15" width="5" height="4" fill="#fff" stroke="#000" strokeWidth="1" />
        <rect x="20" y="15" width="4" height="4" fill="#fff" stroke="#000" strokeWidth="1" />
        <rect x="8" y="21" width="5" height="3" fill="#fff" stroke="#000" strokeWidth="1" />
        <rect x="14" y="21" width="5" height="3" fill="#fff" stroke="#000" strokeWidth="1" />
      </svg>
    );
  }

  if (name === "blog") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="7" y="4" width="18" height="24" fill="#fff" stroke="#000" strokeWidth="1.5" />
        <path d="M11 10h10M11 14h10M11 18h7" stroke="#000" strokeWidth="1.5" />
        <rect x="5" y="6" width="18" height="24" fill="#eeeeee" stroke="#000" strokeWidth="1.5" />
        <path d="M9 12h10M9 16h10M9 20h6" stroke="#000" strokeWidth="1.5" />
      </svg>
    );
  }

  if (name === "add") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="4" y="6" width="24" height="20" fill="#fff" stroke="#000" strokeWidth="1.5" />
        <rect x="4" y="6" width="24" height="5" fill="#dddddd" stroke="#000" strokeWidth="1.5" />
        <path d="M16 13v10M11 18h10" stroke="#000" strokeWidth="2" strokeLinecap="square" />
      </svg>
    );
  }

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="4" y="5" width="24" height="22" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <rect x="4" y="5" width="24" height="5" fill="#dddddd" stroke="#000" strokeWidth="1.5" />
      <circle cx="12" cy="18" r="3" fill="#dddddd" stroke="#000" strokeWidth="1.25" />
      <path d="M17 15h7M17 18h7M17 21h5" stroke="#000" strokeWidth="1.5" />
      <path d="M10 18h4" stroke="#000" strokeWidth="1.25" />
    </svg>
  );
}

function NavIcon({ name }: { name: Exclude<NavIconName, "add"> }) {
  if (name === "today") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M8 3v3M16 3v3M4 9.5h16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "blog") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13a7.8 7.8 0 0 0 .05-2l2.05-1.6-2-3.46-2.45 1a7.7 7.7 0 0 0-1.73-1L14.9 2h-5.8L8.68 4.94a7.7 7.7 0 0 0-1.73 1l-2.45-1-2 3.46L4.55 11a7.8 7.8 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-1a7.7 7.7 0 0 0 1.73 1L9.1 22h5.8l.42-2.94a7.7 7.7 0 0 0 1.73-1l2.45 1 2-3.46L19.4 13Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      {collapsed ? (
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M15 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
