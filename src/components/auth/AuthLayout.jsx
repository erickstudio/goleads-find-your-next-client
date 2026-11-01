import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import BrandWordmark from "@/components/BrandWordmark";
import PreferenceControls from "@/components/PreferenceControls";
import { usePreferences } from "@/lib/PreferencesContext";

// Full-screen layout shared by auth pages; includes product overview so visitors arriving directly
// at /login or /register understand what GoLeads does, who it is for, and what they get with an account.
export function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { lang } = usePreferences();
  const isEs = lang === "es";

  const accountBenefits = isEs
    ? [
        "Busca con IA negocios que anuncian una apertura, expansión o traslado por sector y ciudad.",
        "Revisa el anuncio original, sus fechas y cómo se relaciona con el servicio que ofreces.",
        "Guarda leads en tu espacio privado y prepara borradores de contacto en español o inglés.",
      ]
    : [
        "Use AI to find businesses announcing an opening, expansion, or relocation by sector and city.",
        "Review the original announcement, its dates, and how it relates to the service you offer.",
        "Save leads in your private workspace and prepare outreach drafts in English or Spanish.",
      ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground goleads-grid-bg">
      <header className="w-full border-b border-border bg-card/90 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="GoLeads">
              <BrandWordmark size="md" />
            </Link>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {isEs ? "Ver qué hace GoLeads y ejemplo" : "See what GoLeads does & example"}
            </Link>
          </div>
          <PreferenceControls compact />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Product Context Column — explains GoLeads before registering */}
          <aside className="lg:col-span-5 rounded-xl border border-primary/25 bg-card/80 p-5 sm:p-6 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {isEs ? "BUSCA LEADS CON IA" : "FIND LEADS WITH AI"}
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {isEs
                ? "Encuentra clientes para tus servicios."
                : "Find clients for your services."}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isEs
                ? "Para freelancers, agencias y proveedores de servicios B2B (diseño web, fotografía, contabilidad, marketing, mantenimiento y más)."
                : "For freelancers, agencies, and B2B service providers (web design, photography, bookkeeping, marketing, maintenance, and more)."}
            </p>

            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-semibold text-foreground">
                {isEs ? "Qué obtienes al crear tu cuenta:" : "What you get with your account:"}
              </p>
              <ul className="space-y-2">
                {accountBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <Link
                to="/"
                hash="product-preview"
                className="font-semibold text-primary hover:underline"
              >
                {isEs ? "Ver ejemplo del producto →" : "See product example →"}
              </Link>
              <Link
                to="/"
                className="text-muted-foreground hover:text-foreground underline"
              >
                {isEs ? "Página principal" : "Home page"}
              </Link>
            </div>
          </aside>

          {/* Auth Form Column */}
          <div className="lg:col-span-7 w-full max-w-md mx-auto">
            <div className="mb-6 text-center">
              {Icon && (
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 border border-primary/30">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-card-foreground shadow-xs">
              {children}
            </div>
            {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}