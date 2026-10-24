
import { useEffect, useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

import Discussion from "./pages/Discussion";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import Decisions from "./pages/Decisions";
import Settings from "./pages/Settings";

const validPages = [
  "dashboard",
  "board",
  "discussion",
  "decisions",
  "settings",
];

function getPageFromURL() {
  const page = window.location.pathname.replace(/^\/+|\/+$/g, "");

  return validPages.includes(page) ? page : "dashboard";
}

function App() {
  const [activePage, setActivePage] = useState(getPageFromURL);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function navigate(page) {
    if (!validPages.includes(page)) return;

    window.history.pushState({}, "", `/${page}`);
    setActivePage(page);
  }

  useEffect(() => {
    function handlePopState() {
      setActivePage(getPageFromURL());
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} />;

      case "board":
        return <Board />;

      case "discussion":
        return <Discussion />;

      case "decisions":
        return <Decisions />;

      case "settings":
        return <Settings />;

      default:
        return <Dashboard onNavigate={navigate} />;
    }
  }

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
          className={`min-h-0 flex-1 overflow-y-auto p-4 transition-[padding] duration-200 sm:p-6 ${
            sidebarCollapsed ? "lg:px-8" : ""
          }`}
        >
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
