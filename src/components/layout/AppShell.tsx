"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { useDashboardActions } from "@/components/dashboard/DashboardActionsContext";
import { AddPanelMenu } from "@/components/dashboard/AddPanelMenu";
import { MobileFinderNav } from "@/components/layout/MobileFinderNav";
import { playUiSound } from "@/lib/sounds/play";

const STORAGE_KEY = "pd-sidebar-collapsed";

export function AppShell({
  email,
  retroEnabled = false,
  children,
}: {
  email: string | undefined;
  retroEnabled?: boolean;
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
      if (!inMenu && !inSidebar) setAddOpen(false);
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
  const soundsActive = pathname.startsWith("/sounds");
  const showAddPanel = canAddPanel && todayActive;

  return (
    <div className="flex min-h-screen flex-col">
      <nav
        className="app-menubar hidden h-[22px] shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-bold tracking-tight text-[var(--ink)]"
        aria-label="Main"
      >
        <Link
          href="/dashboard"
          onClick={() => playUiSound("nav_click")}
          className="app-menubar-brand px-2 py-0.5 font-bold hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
        >
          Ghost Writer
        </Link>
        <MenuBarLink href="/dashboard" active={todayActive}>
          Today
        </MenuBarLink>
        <MenuBarLink href="/blog" active={blogActive}>
          Blog
        </MenuBarLink>
        <MenuBarLink href="/settings" active={settingsActive}>
          Settings
        </MenuBarLink>
        <MenuBarLink href="/sounds" active={soundsActive}>
          Sounds
        </MenuBarLink>
        {showAddPanel ? (
          <div className="relative" ref={menuAddRef}>
            <button
              type="button"
              onClick={() => {
                playUiSound("button_click");
                setAddOpen((v) => !v);
              }}
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
        <div className="ml-auto flex min-w-0 items-center gap-1">
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
            <NavLink
              href="/sounds"
              label="Sounds"
              collapsed={collapsed}
              active={soundsActive}
              icon="sounds"
            />
          </nav>

          <div
            className={`app-sidebar-footer space-y-3 ${collapsed ? "flex flex-col items-center" : "px-2"}`}
          >
            {showAddPanel ? (
              <div className="relative" ref={sidebarAddRef}>
                <button
                  type="button"
                  onClick={() => {
                    playUiSound("button_click");
                    setAddOpen((v) => !v);
                  }}
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
                <p
                  className="truncate text-xs text-[var(--muted)]"
                  title={email}
                >
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
              onClick={() => {
                playUiSound("panel_open");
                setMobileOpen(true);
              }}
              className="rounded-xl p-2 text-[var(--ink)] hover:bg-[var(--surface-soft)]"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <HamburgerIcon />
            </button>
          </header>

          {mobileOpen ? (
            retroEnabled ? (
              <div className="fixed inset-0 z-40 flex items-center justify-center p-4 md:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/35"
                  aria-label="Close menu"
                  onClick={() => {
                    playUiSound("panel_close");
                    setMobileOpen(false);
                    setAddOpen(false);
                  }}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Navigation"
                  className="panel-card mobile-finder-window relative z-10 flex max-h-[min(80vh,28rem)] w-full max-w-sm flex-col overflow-hidden"
                >
                  <div className="panel-title-bar flex items-center gap-2 px-2 py-1">
                    <div className="panel-title-stripes" aria-hidden />
                    <button
                      type="button"
                      className="panel-close-box panel-chrome-btn shrink-0"
                      aria-label="Close menu"
                      onClick={() => {
                        playUiSound("panel_close");
                        setMobileOpen(false);
                        setAddOpen(false);
                      }}
                    >
                      <span className="panel-close-box-label">Close</span>
                    </button>
                    <h2 className="panel-title-label relative z-[1] text-sm font-semibold tracking-tight">
                      Ghost Writer
                    </h2>
                  </div>
                  <div className="panel-body flex min-h-0 flex-1 flex-col overflow-auto bg-[var(--surface)]">
                    <MobileFinderNav
                      todayActive={todayActive}
                      blogActive={blogActive}
                      settingsActive={settingsActive}
                      soundsActive={soundsActive}
                      showAddPanel={showAddPanel}
                      addOpen={addOpen}
                      onToggleAdd={() => {
                        playUiSound("button_click");
                        setAddOpen((v) => !v);
                      }}
                      onAddPanel={(type) => {
                        playUiSound("button_click");
                        addPanel(type);
                        setAddOpen(false);
                        setMobileOpen(false);
                      }}
                      onCloseAdd={() => setAddOpen(false)}
                      onNavigate={() => setMobileOpen(false)}
                      email={email}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="fixed inset-0 z-40 md:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-[var(--ink)]/30"
                  aria-label="Close menu"
                  onClick={() => {
                    playUiSound("panel_close");
                    setMobileOpen(false);
                  }}
                />
                <div className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                    <p className="font-[family-name:var(--font-display)] text-lg">
                      Menu
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        playUiSound("panel_close");
                        setMobileOpen(false);
                      }}
                      className="rounded-xl px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Close
                    </button>
                  </div>
                  <nav className="flex flex-1 flex-col gap-1 p-3">
                    <MobileNavLink
                      href="/dashboard"
                      label="Today"
                      active={todayActive}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <MobileNavLink
                      href="/blog"
                      label="Blog"
                      active={blogActive}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <MobileNavLink
                      href="/settings"
                      label="Settings"
                      active={settingsActive}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <MobileNavLink
                      href="/sounds"
                      label="Sounds"
                      active={soundsActive}
                      onNavigate={() => setMobileOpen(false)}
                    />
                    {showAddPanel ? (
                      <div className="mt-4 border-t border-[var(--border)] pt-4">
                        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                          Dashboard
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            playUiSound("button_click");
                            setAddOpen((v) => !v);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                        >
                          Add panel
                          <span className="text-xs">{addOpen ? "−" : "+"}</span>
                        </button>
                        {addOpen ? (
                          <div className="mt-2 px-1">
                            <AddPanelMenu
                              onSelect={(type) => {
                                addPanel(type);
                                setAddOpen(false);
                                setMobileOpen(false);
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </nav>
                  <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
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
            )
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
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => playUiSound("nav_click")}
      className={`app-menubar-item px-2 py-0.5 font-normal ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "hover:bg-[var(--ink)] hover:text-[var(--canvas)]"
      }`}
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
  icon: "today" | "blog" | "settings" | "sounds";
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      onClick={() => playUiSound("nav_click")}
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

function MobileNavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        playUiSound("nav_click");
        onNavigate();
      }}
      className={`rounded-xl px-3 py-2.5 text-sm font-medium ${
        active
          ? "bg-[var(--surface-soft)] text-[var(--ink)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </Link>
  );
}

function NavIcon({ name }: { name: "today" | "blog" | "settings" | "sounds" }) {
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

  if (name === "sounds") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10v4h3l4 3V7L7 10H4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7.5a6 6 0 0 1 0 9"
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
