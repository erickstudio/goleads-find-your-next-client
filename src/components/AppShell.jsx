import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";

export default function AppShell({ children, user }) {
  const location = useLocation();
  const { logout } = useAuth();
  const pathname = location.pathname;

  const navItems = [
    { to: "/", label: "Find leads", active: pathname === "/" },
    { to: "/saved", label: "Saved leads", active: pathname.startsWith("/saved") },
    { to: "/onboarding", label: "Your services", active: pathname.startsWith("/onboarding") },
    { to: "/pilot", label: "Pilot offer", active: pathname.startsWith("/pilot") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="font-semibold tracking-tight text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-600 rounded px-1"
            >
              Leads AI
            </Link>

            <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    item.active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden md:inline text-xs text-slate-500 truncate max-w-[200px]">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        <nav
          aria-label="Mobile navigation"
          className="sm:hidden border-t border-slate-200 bg-white px-4 py-1.5 flex items-center gap-1 overflow-x-auto"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                item.active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>Leads AI</span>
          <span>Public opening and expansion sources are separated from service-fit estimates.</span>
        </div>
      </footer>
    </div>
  );
}