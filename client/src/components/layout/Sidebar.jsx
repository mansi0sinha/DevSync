
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Columns3,
  GitMerge,
  Activity,
  Settings,
  ChevronsUpDown,
  Plus,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navigation = [
  { name: "Overview", icon: LayoutDashboard, id: "dashboard" },
  { name: "Discussion", icon: MessageSquare, id: "discussion" },
  { name: "Board", icon: Columns3, id: "board" },
  { name: "Decisions", icon: GitMerge, id: "decisions" },
  { name: "Activity", icon: Activity, id: "activity" },
];

export default function Sidebar({
  activePage = "dashboard",
  onNavigate,
  workspace,
  workspaces = [],
  workspaceId,
  onWorkspaceChange,
  projects = [],
  projectId,
  onProjectChange,
  onCreateProject,
  onCreateWorkspace,
  user,
  mobileOpen = false,
  onMobileClose,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (mobileOpen) sidebarRef.current?.focus();
  }, [mobileOpen]);

  function navigateAndClose(page) {
    onNavigate?.(page);
    onMobileClose?.();
  }

  const toggleSidebar = () => setIsCollapsed((current) => !current);

  return <>
    {mobileOpen && <button type="button" aria-label="Close navigation menu" onClick={onMobileClose} className="fixed inset-0 z-40 cursor-default bg-black/40 md:hidden" />}
    <aside
      ref={sidebarRef}
      id="primary-sidebar"
      role={mobileOpen ? "dialog" : undefined}
      aria-label="Primary navigation"
      tabIndex={mobileOpen ? -1 : undefined}
      aria-modal={mobileOpen ? "true" : undefined}
      onKeyDown={(event) => {
        if (!mobileOpen || event.key !== "Tab") return;
        const focusable = sidebarRef.current?.querySelectorAll('button:not([disabled]), select:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === sidebarRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className={`fixed left-3 top-3 z-50 flex h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-side transition-[width] duration-200 md:relative md:left-auto md:top-auto md:z-auto md:m-3 md:h-[calc(100dvh-24px)] ${mobileOpen ? "" : "hidden md:flex"} ${isCollapsed ? "w-20 md:w-24" : "w-[min(16rem,calc(100vw-1.5rem))] md:w-64"}`}
    >
      {/* Brand and collapse button */}
      <div
        className={`flex h-19 shrink-0 items-center border-b border-line ${
          isCollapsed
            ? "justify-center px-2"
            : "justify-between gap-2 px-4"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/devsync-mark-light.svg"
            alt="DevSync logo"
            className="h-10 w-10 shrink-0 object-contain dark:hidden"
          />
          <img
            src="/devsync-mark-dark.svg"
            alt="DevSync logo"
            className="hidden h-10 w-10 shrink-0 object-contain dark:block"
          />

          {!isCollapsed && (
            <span className="truncate text-lg font-bold tracking-tight text-text">
              DevSync
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={
            isCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-text ${
            isCollapsed ? "mt-2" : ""
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} strokeWidth={1.8} />
          ) : (
            <PanelLeftClose size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* Workspace selector */}
      <div className={`shrink-0 ${isCollapsed ? "p-2" : "p-3"}`}>
        <select
          aria-label="Select workspace"
          value={workspaceId || ""}
          onChange={(event) => { onWorkspaceChange?.(event.target.value); onMobileClose?.(); }}
          title={isCollapsed ? workspace?.name || "Workspace" : undefined}
          className="w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-sm font-semibold text-text outline-none focus:border-acc"
        >
          <option value="" disabled>{workspace?.name || "Select workspace"}</option>
          {workspaces.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name}</option>)}
        </select>
        {!isCollapsed && <button type="button" onClick={onCreateWorkspace} className="mt-2 w-full rounded-lg px-2 py-1 text-left text-xs font-medium text-muted hover:bg-hover hover:text-text">+ Add workspace</button>}
      </div>

      {/* Scrollable navigation */}
      <div
        className={`min-h-0 flex-1 overflow-y-auto pb-4 pt-3 ${
          isCollapsed ? "px-2" : "px-3"
        }`}
      >
        {!isCollapsed && (
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Workspace
          </p>
        )}

        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateAndClose(item.id)}
                aria-current={isActive ? "page" : undefined}
                title={isCollapsed ? item.name : undefined}
                className={`group flex min-h-10 w-full items-center rounded-lg py-2 text-sm transition-colors ${
                  isCollapsed
                    ? "justify-center px-0"
                    : "gap-3 px-3 text-left"
                } ${
                  isActive
                    ? "bg-hover font-semibold text-text"
                    : "text-muted hover:bg-hover hover:text-text"
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  className={
                    isActive
                      ? "shrink-0 text-acc"
                      : "shrink-0 text-muted group-hover:text-text"
                  }
                />

                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>

                    {isActive && (
                      <ChevronRight
                        size={15}
                        strokeWidth={1.8}
                        className="text-muted"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Projects */}
        <div className="mt-8">
          {!isCollapsed ? (
            <>
              <div className="mb-3 flex items-center justify-between px-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Projects
                </p>

                <button
                  type="button"
                  aria-label="Add project"
                  title="Add project"
                  onClick={() => { onMobileClose?.(); onCreateProject?.(); }}
                  className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-text"
                >
                  <Plus size={16} strokeWidth={1.8} />
                </button>
              </div>

              {projects.length ? <nav aria-label="Projects" className="space-y-1">
                {projects.map((project) => {
                  const id = project._id || project.id;
                  const selected = String(projectId) === String(id);
                  return <button key={id} type="button" onClick={() => { onProjectChange?.(id); onMobileClose?.(); }} aria-current={selected ? "page" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-hover font-semibold text-text" : "text-muted hover:bg-hover hover:text-text"}`}><span className="h-2 w-2 shrink-0 rounded-sm bg-acc"/><span className="truncate">{project.name}</span></button>;
                })}
              </nav> : <div className="rounded-lg border border-dashed border-faint px-3 py-4">
                <p className="text-sm font-medium text-text">
                  No projects yet
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Create a project to organize your team's tasks and decisions.
                </p>
                <button type="button" onClick={() => { onMobileClose?.(); onCreateProject?.(); }} className="mt-3 text-xs font-semibold text-acc hover:underline">Create project</button>
              </div>}
            </>
          ) : (
            <button
              type="button"
              aria-label={projects.length ? "Projects" : "Create project"}
              title="Add project"
              onClick={projects.length ? () => navigateAndClose("dashboard") : () => { onMobileClose?.(); onCreateProject?.(); }}
              className="flex h-10 w-full items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-text"
            >
              <Plus size={18} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* Fixed bottom section */}
      <div
        className={`shrink-0 border-t border-line ${
          isCollapsed ? "p-2" : "p-3"
        }`}
      >
        {/* Settings */}
        <button
          type="button"
          onClick={() => navigateAndClose("settings")}
          aria-current={activePage === "settings" ? "page" : undefined}
          title={isCollapsed ? "Settings" : undefined}
          className={`flex min-h-10 w-full items-center rounded-lg py-2 text-sm transition-colors ${
            isCollapsed
              ? "justify-center px-0"
              : "gap-3 px-3 text-left"
          } ${
            activePage === "settings"
              ? "bg-hover font-semibold text-text"
              : "text-muted hover:bg-hover hover:text-text"
          }`}
        >
          <Settings
            size={18}
            strokeWidth={1.8}
            className={`shrink-0 ${
              activePage === "settings" ? "text-acc" : ""
            }`}
          />

          {!isCollapsed && <span>Settings</span>}
        </button>

        {/* Account */}
        <div
          className={`mt-2 flex items-center rounded-lg border border-line bg-surface ${
            isCollapsed
              ? "justify-center p-1.5"
              : "gap-3 p-2.5"
          }`}
          title={isCollapsed ? user?.name || user?.email || "Your account" : undefined}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-hover font-mono text-xs font-medium text-text">
            {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
          </div>

          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">
                  {user?.name || user?.email || "Your account"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {user?.email || "Member"}
                </p>
              </div>

              <ChevronsUpDown
                size={14}
                strokeWidth={1.8}
                className="shrink-0 text-muted"
              />
            </>
          )}
        </div>
      </div>
    </aside>
  </>;
}
