import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import HomeworkPage from "./pages/Homework";
import GradesPage from "./pages/Grades";
import CanteenPage from "./pages/Canteen";
import SettingsPage from "./pages/Settings";

const GRAIN_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
  '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>' +
  '<feColorMatrix values="0 0 0 0 0.95 0 0 0 0 0.9 0 0 0 0 0.8 0 0 0 1 0"/></filter>' +
  '<rect width="100%" height="100%" filter="url(#n)"/></svg>'
);

function GrainOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: "-50%",
        zIndex: 9999,
        pointerEvents: "none",
        opacity: 0.055,
        mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")`,
        animation: "grain 1.4s steps(6) infinite",
      }}
    />
  );
}

function Root() {
  const { user } = useAuth();
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/homework" element={<HomeworkPage />} />
        <Route path="/grades" element={<GradesPage />} />
        <Route path="/canteen" element={<CanteenPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GrainOverlay />
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AuthProvider>
  );
}
