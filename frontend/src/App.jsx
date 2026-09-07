import { useState } from "react"
import Apply from "./pages/Apply"
import Tracker from "./pages/Tracker"
import Profile from "./pages/Profile"

const TABS = [
  { key: "apply", label: "New Application" },
  { key: "tracker", label: "Job Tracker" },
  { key: "profile", label: "Profil" },
]

function App() {
  const [view, setView] = useState("apply")

  return (
    <div style={styles.root}>

      <nav style={styles.nav}>
        <div style={styles.navInner}>

          <span style={styles.brand}>
            JobPilot AI
          </span>

          <div style={styles.tabs}>

            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setView(tab.key)
                }
                style={{
                  ...styles.tab,
                  ...(view === tab.key
                    ? styles.tabActive
                    : {}),
                }}
              >
                {tab.label}
              </button>
            ))}

          </div>

        </div>
      </nav>

      {view === "apply" ? (
        <Apply />
      ) : view === "tracker" ? (
        <Tracker />
      ) : (
        <Profile />
      )}

    </div>
  )
}


// ============================================================
// STYLES
// ============================================================

const styles = {
  root: {
    background: "#f5f7fb",
    minHeight: "100vh",
    fontFamily: "Inter, Arial, sans-serif",
  },

  nav: {
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  navInner: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    boxSizing: "border-box",
  },

  brand: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#111827",
  },

  tabs: {
    display: "flex",
    gap: "6px",
  },

  tab: {
    border: "none",
    background: "transparent",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    color: "#6b7280",
  },

  tabActive: {
    background: "#111827",
    color: "#ffffff",
  },
}

export default App