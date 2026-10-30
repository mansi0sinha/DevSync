
import { useCallback, useEffect, useRef, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Discussion from "./pages/Discussion";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import Decisions from "./pages/Decisions";
import Settings from "./pages/Settings";
import Activity from "./pages/Activity";
import Search from "./pages/Search";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { WorkspaceDialog, WorkspaceOnboarding } from "./components/workspaces/WorkspaceDialogs";
import ThemeToggle from "./components/ui/ThemeToggle";
import { connectRealtime, disconnectRealtime } from "./services/realtime";

import {
  authAPI,
  clearSession,
  getSavedUser,
  getToken,
  saveSession,
  workspaceAPI,
  projectAPI,
} from "./services/api";
import { getNotificationDestination } from "./services/notificationNavigation";

const protectedPages = [
  "dashboard",
  "board",
  "discussion",
  "decisions",
  "settings",
  "activity",
  "search",
];

const publicPages = ["home", "login", "register"];
const validPages = [...protectedPages, ...publicPages, "not-found"];

function getPageFromURL() {
  const page = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return page === "" ? "home" : validPages.includes(page) ? page : "not-found";
}

function getList(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

function getItemId(item) {
  return item?._id || item?.id || "";
}

function App() {
  const [activePage, setActivePage] = useState(getPageFromURL);
  const [user, setUser] = useState(getSavedUser);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));

  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(Boolean(getToken()));
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [dialogType, setDialogType] = useState("");
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  const [projectLoadAttempt, setProjectLoadAttempt] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavToggleRef = useRef(null);

  const closeMobileNavigation = useCallback(() => {
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => mobileNavToggleRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") closeMobileNavigation();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen, closeMobileNavigation]);

  useEffect(() => {
    if (!user || !workspaceId || !projectId || !getToken()) {
      disconnectRealtime();
      return undefined;
    }
    return connectRealtime({ workspaceId, projectId });
  }, [user, workspaceId, projectId]);

  const navigate = useCallback((page, options = {}) => {
    if (!validPages.includes(page)) return;

    const target = page === "home" ? "/" : `/${page}`;
    if (window.location.pathname !== target) {
      if (options.replace) {
        window.history.replaceState({}, "", target);
      } else {
        window.history.pushState({}, "", target);
      }
    }

    setActivePage(page);
  }, []);

  const handleLogout = useCallback(() => {
    disconnectRealtime();
    clearSession();
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setWorkspaceId("");
    setProjectId("");
    localStorage.removeItem("devsync_workspace_id");
    Object.keys(localStorage).filter((key) => key.startsWith("devsync_project_"))
      .forEach((key) => localStorage.removeItem(key));
    navigate("home", { replace: true });
  }, [navigate]);

  // Verify the saved session with the backend.
  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const token = getToken();

      if (!token) {
        setCheckingSession(false);
        setUser(null);
        return;
      }

      try {
        const result = await authAPI.me();

        if (!cancelled) {
          setUser(result.user || result.data?.user || null);
        }
      } catch {
        if (!cancelled) {
          disconnectRealtime();
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle browser back/forward and expired sessions.
  useEffect(() => {
    function handlePopState() {
      setActivePage(getPageFromURL());
      const params = new URLSearchParams(window.location.search);
      const nextWorkspace = params.get("workspace");
      const nextProject = params.get("project");
      if (nextWorkspace) setWorkspaceId(nextWorkspace);
      if (nextProject) setProjectId(nextProject);
    }

    function handleSessionExpired() {
      disconnectRealtime();
      setUser(null);
      setWorkspaces([]);
      setProjects([]);
      setWorkspaceId("");
      setProjectId("");
      localStorage.removeItem("devsync_workspace_id");
      Object.keys(localStorage).filter((key) => key.startsWith("devsync_project_"))
        .forEach((key) => localStorage.removeItem(key));
      navigate("login", { replace: true });
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("devsync:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(
        "devsync:session-expired",
        handleSessionExpired
      );
    };
  }, [navigate]);

  // Keep public and protected routes consistent with authentication state.
  useEffect(() => {
    if (checkingSession) return;

    if (!user && protectedPages.includes(activePage)) {
      // A redirect is the route guard's required state transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      navigate("login", { replace: true });
    } else if (user && publicPages.includes(activePage)) {
      navigate("dashboard", { replace: true });
    }
  }, [activePage, user, checkingSession, navigate]);

  // Load only workspaces the authenticated user can access.
  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      if (!user || !getToken()) {
        setWorkspaces([]);
        setProjects([]);
        setWorkspaceId("");
        setProjectId("");
        return;
      }

      setLoadingWorkspaces(true);
      setWorkspaceError("");

      try {
        const result = await workspaceAPI.getAll();
        const list = getList(result, "workspaces");

        if (cancelled) return;

        setWorkspaces(list);
        const savedWorkspaceId = localStorage.getItem("devsync_workspace_id");
        if (savedWorkspaceId && !list.some((item) => getItemId(item) === savedWorkspaceId)) {
          localStorage.removeItem("devsync_workspace_id");
        }

        setWorkspaceId((currentId) => {
          const urlWorkspaceId = new URLSearchParams(window.location.search).get("workspace");
          const requestedId = currentId || urlWorkspaceId || savedWorkspaceId;
          return list.some((item) => getItemId(item) === requestedId)
            ? requestedId
            : getItemId(list[0]);
        });
      } catch (error) {
        if (!cancelled) {
          setWorkspaces([]);
          setProjects([]);
          setWorkspaceId("");
          setProjectId("");
          setWorkspaceError(error.message || "Could not load workspaces.");
          localStorage.removeItem("devsync_workspace_id");
          Object.keys(localStorage).filter((key) => key.startsWith("devsync_project_"))
            .forEach((key) => localStorage.removeItem(key));
        }
      } finally {
        if (!cancelled) setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [user, user?._id, user?.id, user?.email, workspaceLoadAttempt]);

  useEffect(() => {
    if (workspaceId) localStorage.setItem("devsync_workspace_id", workspaceId);
  }, [workspaceId]);

  // Load projects whenever the selected workspace changes.
  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!workspaceId) {
        setProjects([]);
        setProjectId("");
        setProjectError("");
        return;
      }

      setLoadingProjects(true);
      setProjectError("");
      setProjects([]);
      setProjectId("");

      try {
        const result = await projectAPI.getAll(workspaceId);
        const list = getList(result, "projects");

        if (cancelled) return;

        setProjects(list);
        const urlProjectId = new URLSearchParams(window.location.search).get("project");
        const savedId = urlProjectId || localStorage.getItem(`devsync_project_${workspaceId}`);
        const validSavedId = list.some((item) => getItemId(item) === savedId);
        if (savedId && !validSavedId) localStorage.removeItem(`devsync_project_${workspaceId}`);
        setProjectId(validSavedId ? savedId : getItemId(list[0]));
      } catch (error) {
        if (!cancelled) {
          setProjects([]);
          setProjectId("");
          setProjectError(error.message || "Could not load projects.");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectLoadAttempt]);

  useEffect(() => {
    if (workspaceId && projectId) localStorage.setItem(`devsync_project_${workspaceId}`, projectId);
  }, [workspaceId, projectId]);

  useEffect(() => {
    if (!user || checkingSession || loadingWorkspaces) return;
    const params = new URLSearchParams(window.location.search);
    if (workspaceId) params.set("workspace", workspaceId); else params.delete("workspace");
    if (projectId) params.set("project", projectId); else params.delete("project");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState({}, "", nextUrl);
  }, [workspaceId, projectId, user, checkingSession, loadingWorkspaces]);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser || getSavedUser());
  }

  async function handleCreateWorkspace(data) {
    setWorkspaceError("");
    const result = await workspaceAPI.create(data);
    const created = result.workspace || result.data?.workspace || result;
    if (!getItemId(created)) throw new Error("Workspace was created, but its ID was not returned.");
    setWorkspaces((current) => [...current.filter((item) => getItemId(item) !== getItemId(created)), created]);
    setProjects([]);
    setWorkspaceId(getItemId(created));
    setProjectId("");
    setDialogType("");
    navigate("dashboard");
  }

  async function handleCreateProject(data) {
    if (!workspaceId) {
      throw new Error("Create or select a workspace first.");
    }
    setProjectError("");
    const result = await projectAPI.create(workspaceId, data);
    const created = result.project || result.data?.project || result;
    if (!getItemId(created)) throw new Error("Project was created, but its ID was not returned.");
    setProjects((current) => [...current.filter((item) => getItemId(item) !== getItemId(created)), created]);
    setProjectId(getItemId(created));
    setDialogType("");
    navigate("dashboard");
  }

  async function handleJoinWorkspace(token) {
    const joined = await workspaceAPI.acceptInvitation(token);
    const result = await workspaceAPI.getAll();
    const list = getList(result, "workspaces");
    setWorkspaces(list);
    setProjects([]);
    setProjectId("");
    const joinedId = getItemId(joined.workspace);
    setWorkspaceId(list.some((item) => getItemId(item) === joinedId) ? joinedId : getItemId(list[0]));
    setDialogType("");
    navigate("dashboard");
  }

  async function handleInviteMember(email) {
    if (!workspaceId) throw new Error("Select a workspace first.");
    return workspaceAPI.createInvitation(workspaceId, email);
  }

  async function handleMemberRoleChange(userId, role) {
    const result = await workspaceAPI.updateMemberRole(workspaceId, userId, role);
    const updated = result.workspace || result.data?.workspace;
    if (updated) setWorkspaces((current) => current.map((item) => getItemId(item) === workspaceId ? updated : item));
    else {
      const refreshed = await workspaceAPI.getById(workspaceId);
      const workspace = refreshed.workspace || refreshed.data?.workspace;
      if (workspace) setWorkspaces((current) => current.map((item) => getItemId(item) === workspaceId ? workspace : item));
    }
  }

  function openDecisionContext(decisionId) {
    if (decisionId) sessionStorage.setItem("devsync_decision_focus", decisionId);
    navigate("decisions");
  }

  function openDiscussionContext(discussionId, messageId = "") {
    if (discussionId) sessionStorage.setItem("devsync_discussion_focus", discussionId);
    if (messageId) sessionStorage.setItem("devsync_message_focus", messageId);
    navigate("discussion");
  }

  function openTaskContext(taskId) {
    if (taskId) sessionStorage.setItem("devsync_task_focus", taskId);
    navigate("board");
  }

  async function openNotification(item) {
    const destination = getNotificationDestination(item);
    if (!destination) throw new Error("This notification does not have a supported destination.");
    const targetWorkspace = workspaces.find((workspace) => getItemId(workspace) === destination.workspaceId);
    if (!targetWorkspace) throw new Error("This workspace is no longer available to your account.");
    const result = await projectAPI.getAll(destination.workspaceId);
    const targetProjects = getList(result, "projects");
    if (!targetProjects.some((project) => getItemId(project) === destination.projectId)) throw new Error("This project is no longer available to your account.");
    setWorkspaceId(destination.workspaceId);
    setProjects(targetProjects);
    setProjectId(destination.projectId);
    sessionStorage.setItem(destination.storageKey, destination.entityId);
    navigate(destination.page);
  }

  async function handleDeleteWorkspace(confirmName) {
    await workspaceAPI.delete(workspaceId, confirmName);
    let remaining = workspaces.filter((workspace) => getItemId(workspace) !== workspaceId);
    try { remaining = getList(await workspaceAPI.getAll(), "workspaces"); } catch { /* deletion succeeded; keep the local navigation usable */ }
    setWorkspaces(remaining);
    setProjects([]);
    setWorkspaceId(getItemId(remaining[0]));
    setProjectId("");
    navigate("dashboard");
  }

  async function handleDeleteProject(confirmName) {
    await projectAPI.delete(workspaceId, projectId, confirmName);
    let remaining = projects.filter((project) => getItemId(project) !== projectId);
    try { remaining = getList(await projectAPI.getAll(workspaceId), "projects"); } catch { /* deletion succeeded; keep the local navigation usable */ }
    setProjects(remaining);
    setProjectId(getItemId(remaining[0]));
    navigate("dashboard");
  }

  function renderPage() {
    if (activePage === "not-found") {
      return <main className="public-page flex min-h-screen items-center justify-center px-6 text-center"><section><p className="public-eyebrow">404 · PAGE NOT FOUND</p><h1 className="mt-4 text-3xl font-semibold">This page isn’t here.</h1><p className="mt-3 text-sm text-muted">The address may have changed, or the page may no longer exist.</p><button type="button" onClick={() => navigate("home")} className="public-button mt-6">Back to DevSync</button></section></main>;
    }
    if (activePage === "login") {
      return <Login onNavigate={navigate} onLogin={handleLogin} />;
    }

    if (activePage === "home") return <Home onNavigate={navigate} />;

    if (activePage === "register") {
      return <Register onNavigate={navigate} onLogin={handleLogin} />;
    }

    if (!workspaceId || !projectId) {
      return (
        <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-line bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold">Select a project to continue</h1>
          <p className="mt-2 text-sm text-muted">Choose a project for the selected workspace, or create one to open its dashboard and project tools.</p>
        </section>
      );
    }

    switch (activePage) {
      case "dashboard":
        return <Dashboard
          onNavigate={navigate}
          onOpenTask={openTaskContext}
          onOpenDiscussion={openDiscussionContext}
          onOpenDecision={openDecisionContext}
          workspaceId={workspaceId}
          projectId={projectId}
        />;
      case "board":
        return (
          <Board
            key={`${workspaceId}:${projectId}`}
            workspaceId={workspaceId}
            projectId={projectId}
            workspace={workspaces.find(
              (item) => getItemId(item) === workspaceId
            )}
            project={projects.find(
              (item) => getItemId(item) === projectId
            )}
            onOpenDecision={openDecisionContext}
            onOpenDiscussion={openDiscussionContext}
          />
        );
      case "discussion":
        return (
          <Discussion
            workspaceId={workspaceId}
            projectId={projectId}
            workspace={workspaces.find(
              (item) => getItemId(item) === workspaceId
            )}
            project={projects.find(
              (item) => getItemId(item) === projectId
            )}
            onOpenDecision={openDecisionContext}
            onOpenDiscussion={openDiscussionContext}
          />
        );
      case "decisions":
        return (
          <Decisions
            workspaceId={workspaceId}
            projectId={projectId}
            workspace={workspaces.find((item) => getItemId(item) === workspaceId)}
            project={projects.find((item) => getItemId(item) === projectId)}
            onOpenDiscussion={openDiscussionContext}
          />
        );
      case "settings":
      {
        const settingsWorkspace = workspaces.find((item) => getItemId(item) === workspaceId);
        const settingsRole = settingsWorkspace?.members?.find((item) => String(item.user?._id || item.user) === String(user?._id || user?.id))?.role;
        return <Settings user={user} workspace={settingsWorkspace} project={projects.find((item) => getItemId(item) === projectId)} canManageWorkspace={settingsRole === "Admin"} onMemberRoleChange={handleMemberRoleChange} onDeleteWorkspace={handleDeleteWorkspace} onDeleteProject={handleDeleteProject} onUserUpdate={(updated) => { setUser(updated); saveSession({ token: getToken(), user: updated }); }} onLogout={handleLogout} />;
      }
      case "activity":
        return <Activity key={`${workspaceId}:${projectId}`} workspaceId={workspaceId} projectId={projectId} onOpenTask={openTaskContext} onOpenDecision={openDecisionContext} onOpenDiscussion={openDiscussionContext} />;
      case "search":
        return <Search key={`${workspaceId}:${projectId}`} workspaceId={workspaceId} projectId={projectId} onOpenTask={openTaskContext} onOpenDecision={openDecisionContext} onOpenDiscussion={openDiscussionContext} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  }

  if (checkingSession) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        <ThemeToggle className="absolute right-4 top-4" />
        <span>Checking your session...</span>
      </div>
    );
  }

  if (!user || publicPages.includes(activePage) || activePage === "not-found") {
    return <div className="min-h-screen bg-bg text-text">{renderPage()}</div>;
  }

  if (loadingWorkspaces) {
    return <div className="relative flex min-h-screen items-center justify-center bg-bg text-sm text-muted"><ThemeToggle className="absolute right-4 top-4" />Loading your workspaces...</div>;
  }

  if (workspaceError && workspaces.length === 0) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <ThemeToggle className="absolute right-4 top-4" />
        <section className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold">Workspaces are unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{workspaceError}</p>
          <button type="button" onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Retry</button>
        </section>
      </main>
    );
  }

  if (workspaces.length === 0) {
    return <WorkspaceOnboarding user={user} onCreateWorkspace={handleCreateWorkspace} onJoinWorkspace={handleJoinWorkspace} onLogout={handleLogout} />;
  }

  const selectedWorkspace = workspaces.find(
    (item) => getItemId(item) === workspaceId
  );
  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-text">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        workspace={selectedWorkspace}
        workspaces={workspaces}
        workspaceId={workspaceId}
        onWorkspaceChange={(id) => { setWorkspaceId(id); setProjectId(""); setProjectError(""); navigate("dashboard"); }}
        projects={projects}
        projectId={projectId}
        onProjectChange={(id) => { setProjectId(id); navigate("dashboard"); }}
        onCreateProject={() => setDialogType("createProject")}
        onCreateWorkspace={() => setDialogType("createWorkspace")}
        user={user}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNavigation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header activePage={activePage} onNavigate={navigate} onOpenNotification={openNotification} onToggleNavigation={() => setMobileNavOpen((open) => !open)} mobileNavOpen={mobileNavOpen} mobileNavToggleRef={mobileNavToggleRef} />

        <main
          className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="workspace-select">
                Select workspace
              </label>

              <select
                id="workspace-select"
                value={workspaceId}
                onChange={(event) => { setWorkspaceId(event.target.value); setProjectId(""); setProjectError(""); navigate("dashboard"); }}
                disabled={loadingWorkspaces || workspaces.length === 0}
                className="max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-teal-600"
              >
                <option value="">
                  {loadingWorkspaces ? "Loading workspaces..." : "Select workspace"}
                </option>
                {workspaces.map((workspace) => (
                  <option key={getItemId(workspace)} value={getItemId(workspace)}>
                    {workspace.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setDialogType("createWorkspace")}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-hover"
              >
                + Workspace
              </button>
              <button type="button" onClick={() => setDialogType("join")} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-hover">Join</button>

              <label className="sr-only" htmlFor="project-select">
                Select project
              </label>

              <select
                id="project-select"
                value={projectId}
                onChange={(event) => { setProjectId(event.target.value); navigate("dashboard"); }}
                disabled={!workspaceId || loadingProjects || projects.length === 0}
                className="max-w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-teal-600"
              >
                <option value="">
                  {!workspaceId
                    ? "Select a workspace first"
                    : loadingProjects
                      ? "Loading projects..."
                      : "Select project"}
                </option>
                {projects.map((project) => (
                  <option key={getItemId(project)} value={getItemId(project)}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setDialogType("createProject")}
                disabled={!workspaceId}
                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Project
              </button>
              {selectedWorkspace?.members?.some((member) => String(member.user?._id || member.user) === String(user._id || user.id) && member.role === "Admin") && (
                <button type="button" onClick={() => setDialogType("invite")} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-hover">Invite Members</button>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="max-w-full truncate text-sm text-muted">
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-hover"
              >
                Log out
              </button>
            </div>
          </div>

          {(workspaceError || projectError) && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {workspaceError || projectError}
              {projectError && (
                <button type="button" onClick={() => setProjectLoadAttempt((attempt) => attempt + 1)} className="ml-3 font-semibold underline">Retry project load</button>
              )}
            </div>
          )}

          {workspaceId && !loadingProjects && projects.length === 0 && (
            <div className="mb-4 rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold text-text">
                {selectedWorkspace?.name || "Workspace"} has no projects yet
              </h2>
              <p className="mt-1 text-sm text-muted">
                Create a project before adding tasks or discussions.
              </p>
              <button
                type="button"
                onClick={() => setDialogType("createProject")}
                className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Create project
              </button>
            </div>
          )}

          {renderPage()}
        </main>
      </div>
      {dialogType && <WorkspaceDialog type={dialogType} workspace={selectedWorkspace} onClose={() => setDialogType("")} onCreateWorkspace={handleCreateWorkspace} onCreateProject={handleCreateProject} onJoinWorkspace={handleJoinWorkspace} onInviteMember={handleInviteMember} />}
    </div>
  );
}

export default App;
