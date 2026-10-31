import { Link, useLocation } from "@tanstack/react-router";
import { Compass, BookmarkCheck, SlidersHorizontal, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function AppShell({ children, user }) {
  const location = useLocation();
  const { logout } = useAuth();
  const pathname = location.pathname;

  const navItems = [
    { to: "/", label: "Discover", icon: Compass, active: pathname === "/" },
    { to: "/saved", label: "Saved Opportunities", icon: BookmarkCheck, active: pathname.startsWith("/saved") },
    { to: "/onboarding", label: "Services Offered", icon: SlidersHorizontal, active: pathname.startsWith("/onboarding") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white flex items-center justify-center font-semibold text-sm tracking-tight shadow-sm group-hover:bg-blue-600 transition-colors">
                L
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tracking-tight text-slate-900 text-base">Leads AI</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Evidence-First
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block leading-none mt-0.5">
                  Find growing businesses. Discover your next client.
                </p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      item.active
                        ? "bg-blue-50/90 text-blue-700 border border-blue-200/70"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[180px]">{user?.email || "Authenticated Session"}</span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-1.5 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  item.active
                    ? "bg-blue-50 text-blue-700 border border-blue-200/70"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Epistemic Honesty Footer */}
      <footer className="border-t border-slate-200/80 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span className="font-medium text-slate-700">Leads AI (Working Name)</span> — Verified public facts are strictly separated from commercial service-fit inferences.
          </div>
          <div className="text-slate-400">
            Discovery date ≠ opening date · Expansion ≠ guaranteed budget or purchase intent
          </div>
        </div>
      </footer>
    </div>
  );
}