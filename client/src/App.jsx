
import { useCallback, useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Discussion from "./pages/Discussion";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import Decisions from "./pages/Decisions";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";

import {
  authAPI,
  clearSession,
  getSavedUser,
  getToken,
  workspaceAPI,
  projectAPI,
} from "./services/api";

const protectedPages = [
  "dashboard",
  "board",
  "discussion",
  "decisions",
  "settings",
];

const publicPages = ["login", "register"];
const validPages = [...protectedPages, ...publicPages];

function getPageFromURL() {
  const page = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return validPages.includes(page) ? page : "dashboard";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(getSavedUser);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));

  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [workspaceFormOpen, setWorkspaceFormOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  const navigate = useCallback((page, options = {}) => {
    if (!validPages.includes(page)) return;

    if (window.location.pathname !== `/${page}`) {
      if (options.replace) {
        window.history.replaceState({}, "", `/${page}`);
      } else {
        window.history.pushState({}, "", `/${page}`);
      }
    }

    setActivePage(page);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setWorkspaceId("");
    setProjectId("");
    navigate("login", { replace: true });
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
    }

    function handleSessionExpired() {
      setUser(null);
      setWorkspaces([]);
      setProjects([]);
      setWorkspaceId("");
      setProjectId("");
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

        setWorkspaceId((currentId) => {
          if (list.some((item) => getItemId(item) === currentId)) {
            return currentId;
          }
          return getItemId(list[0]);
        });
      } catch (error) {
        if (!cancelled) {
          setWorkspaces([]);
          setProjects([]);
          setWorkspaceId("");
          setProjectId("");
          setWorkspaceError(error.message || "Could not load workspaces.");
        }
      } finally {
        if (!cancelled) setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.id, user?.email]);

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
        setProjectId(getItemId(list[0]));
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
  }, [workspaceId]);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser || getSavedUser());
  }

  async function handleCreateWorkspace(event) {
    event?.preventDefault();
    const name = workspaceName.trim();
    if (name.length < 2) {
      setWorkspaceError("Workspace name must be at least 2 characters.");
      return;
    }

    setSavingWorkspace(true);
    setWorkspaceError("");

    try {
      const result = await workspaceAPI.create({ name });
      const created = result.workspace || result.data?.workspace || result;
      let newWorkspace = created;

      if (!getItemId(created)) {
        const refreshed = await workspaceAPI.getAll();
        const list = getList(refreshed, "workspaces");
        setWorkspaces(list);
        newWorkspace = list.find((item) => item.name === name);
      } else {
        setWorkspaces((current) => [
          ...current.filter((item) => getItemId(item) !== getItemId(created)),
          created,
        ]);
      }

      if (newWorkspace && getItemId(newWorkspace)) {
        setWorkspaceId(getItemId(newWorkspace));
        setWorkspaceFormOpen(false);
        setWorkspaceName("");
      } else {
        throw new Error("Workspace was created, but could not be loaded. Refresh and try again.");
      }
    } catch (error) {
      setWorkspaceError(error.message || "Could not create workspace.");
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handleCreateProject(event) {
    event?.preventDefault();
    if (!workspaceId) {
      setProjectError("Select a workspace first.");
      return;
    }

    const name = projectName.trim();
    if (name.length < 2) {
      setProjectError("Project name must be at least 2 characters.");
      return;
    }

    setSavingProject(true);
    setProjectError("");

    try {
      const result = await projectAPI.create(workspaceId, { name });
      const created = result.project || result.data?.project || result;
      let newProject = created;

      if (!getItemId(created)) {
        const refreshed = await projectAPI.getAll(workspaceId);
        const list = getList(refreshed, "projects");
        setProjects(list);
        newProject = list.find((item) => item.name === name);
      } else {
        setProjects((current) => [
          ...current.filter((item) => getItemId(item) !== getItemId(created)),
          created,
        ]);
      }

      if (newProject && getItemId(newProject)) {
        setProjectId(getItemId(newProject));
        setProjectFormOpen(false);
        setProjectName("");
      } else {
        throw new Error("Project was created, but could not be loaded. Refresh and try again.");
      }
    } catch (error) {
      setProjectError(error.message || "Could not create project.");
    } finally {
      setSavingProject(false);
    }
  }

  function renderPage() {
    if (activePage === "login") {
      return <Login onNavigate={navigate} onLogin={handleLogin} />;
    }

    if (activePage === "register") {
      return <Register onNavigate={navigate} onLogin={handleLogin} />;
    }

    switch (activePage) {
      case "dashboard":
        return <Dashboard
          onNavigate={navigate}
          workspaceId={workspaceId}
          projectId={projectId}
        />;
      case "board":
        return (
          <Board
            workspaceId={workspaceId}
            projectId={projectId}
            workspace={workspaces.find(
              (item) => getItemId(item) === workspaceId
            )}
            project={projects.find(
              (item) => getItemId(item) === projectId
            )}
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
          />
        );
      case "decisions":
        return (
          <Decisions
            workspaceId={workspaceId}
            projectId={projectId}
          />
        );
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        Checking your session...
      </div>
    );
  }

  if (!user || publicPages.includes(activePage)) {
    return <div className="min-h-screen bg-bg text-text">{renderPage()}</div>;
  }

  const selectedWorkspace = workspaces.find(
    (item) => getItemId(item) === workspaceId
  );
  const selectedProject = projects.find(
    (item) => getItemId(item) === projectId
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        onCollapseChange={setSidebarCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header activePage={activePage} />

        <main
          className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${sidebarCollapsed ? "lg:px-8" : ""
            }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="workspace-select">
                Select workspace
              </label>

              <select
                id="workspace-select"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
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
                onClick={() => { setWorkspaceError(""); setWorkspaceFormOpen(true); }}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-hover"
              >
                + Workspace
              </button>

              <label className="sr-only" htmlFor="project-select">
                Select project
              </label>

              <select
                id="project-select"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
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
                onClick={() => { setProjectError(""); setProjectFormOpen(true); }}
                disabled={!workspaceId}
                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Project
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">
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

          {(workspaceFormOpen || projectFormOpen) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                      {workspaceFormOpen ? "Workspace setup" : "Project setup"}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-text">
                      {workspaceFormOpen ? "Create a workspace" : "Create a project"}
                    </h2>
                    <p className="mt-2 text-sm leading-5 text-muted">
                      {workspaceFormOpen
                        ? "Bring your team, projects, and decisions together in one place."
                        : "Projects keep tasks and discussions organized inside the selected workspace."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceFormOpen(false);
                      setProjectFormOpen(false);
                    }}
                    className="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-text"
                    aria-label="Close form"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={workspaceFormOpen ? handleCreateWorkspace : handleCreateProject}>
                  <label htmlFor="workspace-project-name" className="mb-1.5 block text-sm font-medium text-text">
                    {workspaceFormOpen ? "Workspace name" : "Project name"}
                  </label>
                  <input
                    id="workspace-project-name"
                    autoFocus
                    required
                    minLength={2}
                    maxLength={workspaceFormOpen ? 80 : 100}
                    value={workspaceFormOpen ? workspaceName : projectName}
                    onChange={(event) => {
                      if (workspaceFormOpen) setWorkspaceName(event.target.value);
                      else setProjectName(event.target.value);
                    }}
                    placeholder={workspaceFormOpen ? "e.g. Engineering Team" : "e.g. DevSync"}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-teal-600"
                  />

                  {!workspaceFormOpen && !projectFormOpen && (workspaceError || projectError) && (
                    <p role="alert" className="mt-2 text-sm text-red-500">
                      {workspaceFormOpen ? workspaceError : projectError}
                    </p>
                  )}

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceFormOpen(false);
                        setProjectFormOpen(false);
                      }}
                      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-text hover:bg-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={workspaceFormOpen ? savingWorkspace : savingProject}
                      className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {(workspaceFormOpen ? savingWorkspace : savingProject)
                        ? "Creating..."
                        : workspaceFormOpen ? "Create workspace" : "Create project"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {(workspaceError || projectError) && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {workspaceError || projectError}
            </div>
          )}

          {!loadingWorkspaces && workspaces.length === 0 && (
            <div className="mb-4 rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold text-text">Create your first workspace</h2>
              <p className="mt-1 text-sm text-muted">
                A workspace keeps your team's projects and discussions together.
              </p>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Create workspace
              </button>
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
                onClick={handleCreateProject}
                className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Create project
              </button>
            </div>
          )}

          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
