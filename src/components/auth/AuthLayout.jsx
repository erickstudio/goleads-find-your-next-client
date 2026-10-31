import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";

// Full-screen card shared by the auth pages; includes goleads.app wordmark and language/theme controls.
export function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground goleads-grid-bg">
      <header className="w-full border-b border-border bg-card/90 backdrop-blur-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <BrandWordmark size="md" />
          <PreferenceControls compact />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            {Icon && (
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
                <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-card-foreground shadow-xs">
            {children}
          </div>
          {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        </div>
      </div>
    </div>
  );
}