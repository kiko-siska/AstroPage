import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/LanguageContext";
import { useIsMobile } from "../hooks/useIsMobile";
import LanguageSwitcher from "./LanguageSwitcher";


const COPPER = "#B08D57";
const COPPER_DIM = "rgba(176,141,87,0.12)";
const MUTED = "rgba(232,220,199,0.52)";
const ACTIVE_SHADOW = "inset 2px 0 0 #B08D57";


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
  onClick,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: (color: string) => React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <NavLink to={to} end={end} style={{ textDecoration: "none", display: "block" }} onClick={onClick}>
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

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  const initials = (user?.username ?? "S").slice(0, 2).toUpperCase();

  return (
    <>
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
            {user?.username ?? t("common.student")}
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
          label={t("nav.dashboard")}
          onClick={onNavClick}
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
          label={t("nav.homework")}
          onClick={onNavClick}
          icon={(c) => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="2" y="1" width="12" height="14" rx="1.5" stroke={c} strokeWidth="1.3" />
              <path d="M5 5h6M5 8h6M5 11h4" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        />
        <NavItem
          to="/timetable"
          label={t("nav.timetable")}
          onClick={onNavClick}
          icon={(c) => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke={c} strokeWidth="1.3" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        />
        <NavItem
          to="/grades"
          label={t("nav.grades")}
          onClick={onNavClick}
          icon={(c) => (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M8 2L1 5.5l7 3.5 7-3.5L8 2z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M4 7.2v3.3c0 .8 1.8 1.8 4 1.8s4-1 4-1.8V7.2M14 6v3.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        />
        <NavItem
          to="/canteen"
          label={t("nav.canteen")}
          onClick={onNavClick}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(232,220,199,0.28)",
            }}
          >
            {t("lang.label")}
          </span>
          <LanguageSwitcher />
        </div>
        <NavItem
          to="/settings"
          label={t("nav.settings")}
          onClick={onNavClick}
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
        <LogoutButton onClick={handleLogout} label={t("nav.logout")} />
      </div>
    </>
  );
}

export default function AppLayout() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function openDrawer() { setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0a0805" }}>
        {/* Mobile top bar */}
        <header
          style={{
            height: 52,
            minHeight: 52,
            background: "#0e0c09",
            borderBottom: "1px solid rgba(176,141,87,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            zIndex: 40,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open menu"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            <span style={{ width: 18, height: 1.5, background: COPPER, display: "block" }} />
            <span style={{ width: 18, height: 1.5, background: COPPER, display: "block" }} />
            <span style={{ width: 18, height: 1.5, background: COPPER, display: "block" }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 1, height: 12, background: "rgba(176,141,87,0.45)" }} />
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 13,
                fontWeight: 400,
                color: "#E8DCC7",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              AstroPage
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(176,141,87,0.45)" }} />
          </div>

          {/* Spacer for centering */}
          <div style={{ width: 34 }} />
        </header>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "#0a0805" }}>
          <Outlet />
        </main>

        {/* Off-canvas drawer backdrop */}
        {drawerOpen && (
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 59,
            }}
          />
        )}

        {/* Off-canvas drawer */}
        <aside
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: 260,
            background: "#0e0c09",
            borderRight: "1px solid rgba(176,141,87,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 60,
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s cubic-bezier(0.2,0.7,0.15,1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "14px 14px 0",
            }}
          >
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close menu"
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid rgba(176,141,87,0.18)",
                borderRadius: 5,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="rgba(232,220,199,0.45)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <SidebarContent onNavClick={closeDrawer} />
        </aside>
      </div>
    );
  }

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
        <SidebarContent />
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "#0a0805" }}>
        <Outlet />
      </main>
    </div>
  );
}

function LogoutButton({ onClick, label }: { onClick: () => void; label: string }) {
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
        {label}
      </span>
    </button>
  );
}
