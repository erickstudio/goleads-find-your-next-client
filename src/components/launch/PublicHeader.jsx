import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

export default function PublicHeader() {
  const { lang, copy } = usePublicLocale();
  const [open, setOpen] = useState(false);
  const hashes = ["how-it-works", "evidence-first", "faq"];
  return (
    <header className="relative z-20 border-b border-border/60 bg-background/90">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground">{copy.skip}</a>
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link to="/" search={{ lang }} aria-label="GoLeads"><BrandWordmark size="lg" /></Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex" aria-label={copy.menu}>{copy.nav.map((label, i) => <Link key={label} to="/" search={{ lang }} hash={hashes[i]} className="hover:text-foreground">{label}</Link>)}</nav>
        <div className="hidden items-center gap-5 lg:flex"><PreferenceControls compact /><Link to="/app" className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary">{copy.signIn}<ArrowUpRight className="h-4 w-4" /></Link></div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><button type="button" className="rounded-lg border border-border p-2.5 lg:hidden" aria-label={copy.menu}><Menu className="h-5 w-5" /></button></SheetTrigger>
          <SheetContent className="flex w-80 max-w-full flex-col gap-8"><SheetTitle><BrandWordmark /></SheetTitle><SheetDescription className="sr-only">{copy.menu}</SheetDescription><PreferenceControls compact /><nav className="flex flex-col gap-6" aria-label={copy.menu}>{copy.nav.map((label, i) => <Link key={label} to="/" search={{ lang }} hash={hashes[i]} onClick={() => setOpen(false)}>{label}</Link>)}</nav><Link to="/app" onClick={() => setOpen(false)} className="rounded-lg border border-primary/50 px-4 py-3 text-center text-primary">{copy.signIn}</Link></SheetContent>
        </Sheet>
      </div>
    </header>
  );
}