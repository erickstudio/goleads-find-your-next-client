import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import PreferenceControls from "@/components/PreferenceControls";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";
import { workspaceGroups } from "@/lib/workspace-navigation";
import { usePreferences } from "@/lib/PreferencesContext";

export default function WorkspaceHeader({ user }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { t, lang } = usePreferences();
  const current = workspaceGroups.flatMap((g) => g.items).find((item) => item.to === pathname);
  return (
    <header className="sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><button type="button" className="rounded-lg border border-border p-2 lg:hidden" aria-label={t("workspace.menu")}><Menu className="h-5 w-5" /></button></SheetTrigger>
          <SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">{t("workspace.menu")}</SheetTitle><SheetDescription className="sr-only">{t("workspace.private")}</SheetDescription><WorkspaceSidebar user={user} onNavigate={() => setOpen(false)} /></SheetContent>
        </Sheet>
        <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">GoLeads / {t("workspace.workspace")}</p><p className="mt-1 text-sm font-semibold">{t(`workspace.${current?.key || "detail"}`)}</p></div>
      </div>
      <div className="flex items-center gap-3"><Link to="/support" search={{ lang }} className="hidden text-xs text-muted-foreground hover:text-foreground sm:block">{t("workspace.support")}</Link><PreferenceControls compact /></div>
    </header>
  );
}