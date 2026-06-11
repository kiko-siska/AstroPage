import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
      <h1 className="text-2xl font-semibold">Welcome, {user?.username}</h1>
      <p className="text-slate-400">
        Signed in to{" "}
        <code className="text-violet-400">{user?.subdomain}.edupage.org</code>
      </p>
      <button
        onClick={logout}
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
      >
        Sign out
      </button>
    </div>
  );
}

function Root() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
