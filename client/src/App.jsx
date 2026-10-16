import { useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Discussion from "./pages/Discussion";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import Decisions from "./pages/Decisions";
import Settings from "./pages/Settings";
function App() {
  const [activePage, setActivePage] = useState("dashboard");

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return <Dashboard onNavigate={setActivePage} />;

      case "board":
        return <Board />;


      case "discussion":
        return <Discussion />;

      case "decisions":
        return <Decisions />;
     case "settings":
  return <Settings />;
      default:
        return <Dashboard onNavigate={setActivePage} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header activePage={activePage} />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
