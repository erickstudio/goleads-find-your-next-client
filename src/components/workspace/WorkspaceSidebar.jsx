import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LockKeyhole, LogOut } from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import WorkspaceNavigation from "@/components/workspace/WorkspaceNavigation";
import { usePreferences } from "@/lib/PreferencesContext";
import { useAuth } from "@/lib/AuthContext";

export default function WorkspaceSidebar({ user, onNavigate }) {
  const { t, lang } = usePreferences();
  const { logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="px-6 pb-7 pt-6"><Link to="/app" onClick={onNavigate}><BrandWordmark /></Link><p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><LockKeyhole className="h-3 w-3" />{t("workspace.private")}</p></div>
      <div className="flex-1 overflow-y-auto px-4 pb-6"><WorkspaceNavigation onNavigate={onNavigate} /></div>
      <div className="space-y-3 border-t border-border px-6 py-4">
        <Link to="/" search={{ lang }} onClick={onNavigate} className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground">{t("workspace.home")}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground" title={user?.email}>{user?.email}</span><button type="button" onClick={logout} aria-label={t("nav.signOut")} title={t("nav.signOut")} className="rounded-md p-2 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"><LogOut className="h-4 w-4" /></button></div>
      </div>
    </div>
  );
}