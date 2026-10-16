
import { useState } from "react";

import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header activePage={activePage} />

        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {activePage === "dashboard"
              ? "Overview"
              : activePage.charAt(0).toUpperCase() +
                activePage.slice(1)}
          </h1>

          <p className="mt-2 text-sm text-muted">
            Your DevSync workspace is taking shape.
          </p>
        </main>
      </div>
    </div>
  );
}

export default App;
