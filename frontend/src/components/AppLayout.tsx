import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Home, BookOpen, GraduationCap, UtensilsCrossed, UserCog, LogOut, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";


const COPPER = "#B08D57";
const COPPER_DIM = "rgba(176,141,87,0.12)";
const MUTED = "rgba(232,220,199,0.52)";
const ACTIVE_SHADOW = "inset 2px 0 0 #B08D57";


const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/homework", label: "Homework", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: GraduationCap },
  { to: "/canteen", label: "Canteen", icon: UtensilsCrossed },
];

const itemBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 6,
  cursor: "pointer",
  textDecoration: "none",
};

function NavItem({
  to,
  end,
  label,
  icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: (color: string) => React.ReactNode;
}) {
  return (
    <NavLink to={to} end={end} style={{ textDecoration: "none", display: "block" }}>
      {({ isActive }) => (
        <div
          style={{
            ...itemBase,
            background: isActive ? COPPER_DIM : "transparent",
            boxShadow: isActive ? ACTIVE_SHADOW : "none",
          }}
        >
          {icon(isActive ? COPPER : MUTED)}
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: isActive ? COPPER : MUTED,
            }}
          >
            {label}
          </span>
        </div>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  const initials = (user?.username ?? "S").slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#0a0805" }}>
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: 236,
          minWidth: 236,
          background: "#0e0c09",
          borderRight: "1px solid rgba(176,141,87,0.14)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(176,141,87,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          <div style={{ width: 1, height: 13, background: "rgba(176,141,87,0.45)" }} />
          <span
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 14,
              fontWeight: 400,
              color: "#E8DCC7",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            AstroPage
          </span>
          <div style={{ width: 1, height: 13, background: "rgba(176,141,87,0.45)" }} />
        </div>

        {/* User card */}
        <div
          style={{
            padding: "12px 16px 10px",
            borderBottom: "1px solid rgba(176,141,87,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(176,141,87,0.1)",
              border: "1px solid rgba(176,141,87,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: COPPER,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                color: "#E8DCC7",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.username ?? "Student"}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "rgba(232,220,199,0.28)",
                letterSpacing: "0.06em",
                marginTop: 2,
              }}
            >
              {user?.subdomain ?? "school"}.edupage.org
            </div>
          </div>
        </div>

        {/* Primary nav */}
        <nav style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          <NavItem
            to="/"
            end
            label="Dashboard"
            icon={(c) => (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
                <rect x="9" y="2" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
                <rect x="2" y="9" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
                <rect x="9" y="9" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
              </svg>
            )}
          />
          <NavItem
            to="/homework"
            label="Domáce úlohy"
            icon={(c) => (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <rect x="2" y="1" width="12" height="14" rx="1.5" stroke={c} strokeWidth="1.3" />
                <path d="M5 5h6M5 8h6M5 11h4" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          />
          <NavItem
            to="/canteen"
            label="Jedáleň"
            icon={(c) => (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 2v4a3 3 0 006 0V2M7 2v4M7 9v5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
                <path d="M13 2v5c0 1.1-.9 2-2 2v4" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          />
        </nav>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid rgba(176,141,87,0.1)",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <NavItem
            to="/settings"
            label="Nastavenia"
            icon={(c) => (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="2.5" stroke={c} strokeWidth="1.3" />
                <path
                  d="M8 1.5v1M8 13.5v1M14.5 8h-1M2.5 8h-1M12.6 3.4l-.7.7M4.1 11.9l-.7.7M12.6 12.6l-.7-.7M4.1 4.1l-.7-.7"
                  stroke={c}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            )}
          />
          <LogoutButton onClick={handleLogout} />
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "#0a0805" }}>
        <Outlet />
      </main>
    </div>
  );
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(122,48,48,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        transition: "background 0.15s",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10.5 11l3-3-3-3M13.5 8H6"
          stroke="rgba(200,120,120,0.55)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(200,120,120,0.45)" }}>
        Odhlásiť sa
      </span>
    </button>
  );
}
