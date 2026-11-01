import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, MapPin, Clock3, FileText, Bookmark, CheckCircle2, ArrowRight } from "lucide-react";
import { usePublicLocale } from "@/lib/PublicLocaleContext";

const DEMO_SCENARIOS = {
  en: [
    {
      id: "opening",
      tabLabel: "1. Opening example",
      categoryValue: "Cafés & restaurants",
      locationValue: "Example city",
      windowValue: "90 days",
      review: "Verified source (Fictional example)",
      signal: "New opening",
      business: "Horizon Café",
      place: "Central district · Specialty café",
      sourceName: "Local Press (Fictional example)",
      excerpt:
        "“Horizon Café will open its second neighbourhood location this quarter, adding a bakery counter and seating for 45 guests.”",
      dates: [
        "Published: 2026-10-14",
        "Event date: Date not confirmed",
        "Last checked: Fictional demo",
      ],
      fitText:
        "1. What the business announced: Horizon Café is opening a second location with a bakery counter and 45 seats. 2. Related service (Product photography): Preparing a new café launch often requires menu and interior photos for social channels. 3. What to confirm: Verify who leads the launch and whether photography is already covered.",
      draftPreview:
        "Hi Horizon Café team,\n\nI saw an announcement about your new opening in Central district and wanted to introduce my work.\n\nI offer Product photography. Would a brief conversation be useful as you prepare for this stage?",
    },
    {
      id: "expansion",
      tabLabel: "2. Expansion example",
      categoryValue: "Outpatient clinics",
      locationValue: "Austin, TX",
      windowValue: "90 days",
      review: "Verified source (Fictional example)",
      signal: "Expansion",
      business: "Harborview Physical Therapy",
      place: "North Shoal Creek · Healthcare",
      sourceName: "Commercial Real Estate Report (Fictional example)",
      excerpt:
        "“Harborview Physical Therapy LLC has leased 4,200 square feet at 7800 Burnet Road, marking the practice's second Austin-area clinic.”",
      dates: [
        "Published: 2026-09-18",
        "Event date: 2026-11-15 (Planned)",
        "Last checked: Fictional demo",
      ],
      fitText:
        "1. What the business announced: Signed a 4,200 sq. ft. lease to open a second outpatient clinic. 2. Related service (Bookkeeping): Opening a second branch involves setting up expense tracking and vendor billing for the new site. 3. What to confirm: Confirm their timeline and whether accounting is handled in-house.",
      draftPreview:
        "Hi Harborview Physical Therapy team,\n\nI saw an announcement about your expansion in Austin, TX and wanted to introduce my work.\n\nI offer Bookkeeping. Would a brief conversation be useful as you prepare for this stage?",
    },
    {
      id: "relocation",
      tabLabel: "3. Relocation example",
      categoryValue: "Creative & print studios",
      locationValue: "Miami, FL",
      windowValue: "90 days",
      review: "Needs review (Fictional example)",
      signal: "Relocation",
      business: "Atelier Nueve Print Studio",
      place: "Wynwood · Commercial print & design",
      sourceName: "Regional Business Notices (Fictional example)",
      excerpt:
        "“Design and print studio Atelier Nueve is relocating this quarter to a larger 3,500 sq. ft. production space and client showroom in Wynwood.”",
      dates: [
        "Published: 2026-10-12",
        "Event date: Date not confirmed",
        "Last checked: Fictional demo",
      ],
      fitText:
        "1. What the business announced: Relocating to a 3,500 sq. ft. production studio and showroom in Wynwood. 2. Related service (Web design & local SEO): Moving to a new address often requires updating location pages and local search profiles. 3. What to confirm: Check the exact moving date and who coordinates their web updates.",
      draftPreview:
        "Hi Atelier Nueve Print Studio team,\n\nI saw an announcement about your relocation in Miami, FL and wanted to introduce my work.\n\nI offer Web design & local SEO. Would a brief conversation be useful as you prepare for this stage?",
    },
  ],
  es: [
    {
      id: "opening",
      tabLabel: "1. Ejemplo de apertura",
      categoryValue: "Cafés y restaurantes",
      locationValue: "Ciudad de ejemplo",
      windowValue: "90 días",
      review: "Fuente verificada (Ejemplo ficticio)",
      signal: "Nueva apertura",
      business: "Café Horizonte",
      place: "Distrito Centro · Cafetería de especialidad",
      sourceName: "Prensa local (Ejemplo ficticio)",
      excerpt:
        "«Café Horizonte abrirá este trimestre su segundo local en el barrio, con mostrador de panadería y espacio para 45 personas.»",
      dates: [
        "Publicado: 2026-10-14",
        "Fecha de evento/apertura: Fecha no confirmada",
        "Última comprobación: Demostración ficticia",
      ],
      fitText:
        "1. Qué anunció el negocio: Café Horizonte abrirá un segundo local con panadería y 45 plazas. 2. Servicio relacionado (Fotografía de producto): Preparar un nuevo local suele requerir fotos de la carta y del espacio para redes. 3. Qué confirmar: Verifica quién coordina la apertura y si ya tienen cubierto ese servicio.",
      draftPreview:
        "Hola equipo de Café Horizonte,\n\nVi una publicación sobre su nueva apertura en Distrito Centro y quería presentarles mi trabajo.\n\nMe dedico a Fotografía de producto. ¿Les vendría bien conversar brevemente por esta vía por si les resulta útil en esta etapa?",
    },
    {
      id: "expansion",
      tabLabel: "2. Ejemplo de expansión",
      categoryValue: "Clínicas y salud",
      locationValue: "Austin, TX",
      windowValue: "90 días",
      review: "Fuente verificada (Ejemplo ficticio)",
      signal: "Expansión",
      business: "Harborview Physical Therapy",
      place: "North Shoal Creek · Rehabilitación",
      sourceName: "Reporte Inmobiliario Comercial (Ejemplo ficticio)",
      excerpt:
        "«Harborview Physical Therapy LLC firmó un contrato de 4.200 pies cuadrados en Burnet Road para abrir su segunda clínica en Austin.»",
      dates: [
        "Publicado: 2026-09-18",
        "Fecha de evento/apertura: 2026-11-15 (Previsto)",
        "Última comprobación: Demostración ficticia",
      ],
      fitText:
        "1. Qué anunció el negocio: Firmó un arrendamiento de 4.200 pies cuadrados para abrir su segunda clínica. 2. Servicio relacionado (Contabilidad): Abrir una sede adicional implica organizar el control de costos y proveedores de la nueva operación. 3. Qué confirmar: Confirma en qué fase están y si lo gestionan internamente.",
      draftPreview:
        "Hola equipo de Harborview Physical Therapy,\n\nVi una publicación sobre su expansión en Austin, TX y quería presentarles mi trabajo.\n\nMe dedico a Contabilidad. ¿Les vendría bien conversar brevemente por esta vía por si les resulta útil en esta etapa?",
    },
    {
      id: "relocation",
      tabLabel: "3. Ejemplo de traslado",
      categoryValue: "Diseño e impresión",
      locationValue: "Miami, FL",
      windowValue: "90 días",
      review: "Pendiente de revisión (Ejemplo ficticio)",
      signal: "Traslado",
      business: "Atelier Nueve Print Studio",
      place: "Wynwood · Estudio de diseño e impresión",
      sourceName: "Boletín Empresarial Regional (Ejemplo ficticio)",
      excerpt:
        "«El estudio de diseño e impresión Atelier Nueve se traslada este trimestre a un nuevo espacio de 3.500 pies cuadrados en Wynwood.»",
      dates: [
        "Publicado: 2026-10-12",
        "Fecha de evento/apertura: Fecha no confirmada",
        "Última comprobación: Demostración ficticia",
      ],
      fitText:
        "1. Qué anunció el negocio: Se traslada a un local y showroom de 3.500 pies cuadrados en Wynwood. 2. Servicio relacionado (Diseño web y SEO local): Cambiar de dirección suele requerir actualizar páginas de ubicación y perfiles de búsqueda local. 3. Qué confirmar: Confirma la fecha exacta del traslado y quién lleva su web.",
      draftPreview:
        "Hola equipo de Atelier Nueve Print Studio,\n\nVi una publicación sobre su traslado en Miami, FL y quería presentarles mi trabajo.\n\nMe dedico a Diseño web y SEO local. ¿Les vendría bien conversar brevemente por esta vía por si les resulta útil en esta etapa?",
    },
  ],
};

export default function ProductPreview() {
  const { copy, lang } = usePublicLocale();
  const isEs = lang === "es";
  const p = copy.preview;
  const scenarios = DEMO_SCENARIOS[isEs ? "es" : "en"];
  const [activeIdx, setActiveIdx] = useState(0);
  const current = scenarios[activeIdx] || scenarios[0];

  const accountDeliverables = isEs
    ? [
        "Define tus propios servicios (diseño, fotografía, contabilidad, marketing o cualquier servicio B2B).",
        "Busca negocios con anuncios de apertura, expansión o traslado y revisa las fuentes originales.",
        "Guarda leads, califica cuáles te interesan y prepara borradores de contacto en español o inglés.",
      ]
    : [
        "Add your own services (design, photography, bookkeeping, marketing, or any B2B service).",
        "Search for businesses with opening, expansion, or relocation announcements and inspect original sources.",
        "Save leads, rate which ones fit your work, and prepare outreach drafts in English or Spanish.",
      ];

  return (
    <section id="product-preview" className="mx-auto max-w-6xl scroll-mt-8 px-5 pb-20 sm:px-8">
      <figure className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-2xl shadow-brand/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-4">
          <span className="text-[10px] font-semibold tracking-widest text-primary sm:text-xs">
            {p.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            GoLeads / {isEs ? "Demostración interactiva" : "Interactive demo"}
          </span>
        </div>

        <div className="p-5 sm:p-9">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.subtitle}</p>
            </div>

            {/* Scenario selector: Opening, Expansion, Relocation */}
            <div
              role="tablist"
              aria-label={isEs ? "Escenarios de demostración" : "Demonstration scenarios"}
              className="inline-flex flex-wrap rounded-lg border border-border bg-secondary p-1 gap-1"
            >
              {scenarios.map((sc, idx) => (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={activeIdx === idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeIdx === idx
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sc.tabLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="my-6 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
            {[
              [Search, p.category, current.categoryValue],
              [MapPin, p.location, current.locationValue],
              [Clock3, p.window, current.windowValue],
            ].map(([Icon, label, value]) => (
              <div key={label} className="rounded-lg bg-background/60 p-3">
                <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{p.results}</span>
            <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {isEs ? "Datos de ejemplo (No reales)" : "Example data (Fictional)"}
            </span>
          </div>

          <article className="rounded-xl border border-border bg-background/40 p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-md border border-border bg-secondary px-2 py-1 text-muted-foreground">
                    {current.review}
                  </span>
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
                    {current.signal}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">{current.business}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{current.place}</p>
              </div>
              <Bookmark className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 rounded-lg border border-border bg-secondary/40 p-4">
                <p className="flex items-center gap-2 text-xs font-medium">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  {p.source}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{current.sourceName}</p>
                <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs sm:text-sm italic leading-relaxed">
                  {current.excerpt}
                </blockquote>
                <div className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
                  {current.dates.map((date) => (
                    <span key={date}>{date}</span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-3">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary">{p.fit}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {current.fitText}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card/80 p-3.5">
                  <p className="text-xs font-semibold text-foreground">
                    {isEs
                      ? "Borrador de mensaje preparado para este ejemplo:"
                      : "Outreach message draft prepared for this example:"}
                  </p>
                  <pre className="mt-1.5 whitespace-pre-wrap font-body text-[11px] leading-relaxed text-muted-foreground">
                    {current.draftPreview}
                  </pre>
                </div>
              </div>
            </div>
          </article>

          {/* What you get when creating an account */}
          <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <h3 className="text-sm font-semibold text-foreground">
                {isEs
                  ? "¿Qué obtienes al crear tu cuenta en GoLeads?"
                  : "What do you get when you create a GoLeads account?"}
              </h3>
              <ul className="space-y-1.5">
                {accountDeliverables.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/register"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90"
              >
                {isEs ? "Crear cuenta y buscar clientes" : "Create account & find clients"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                {copy.signIn}
              </Link>
            </div>
          </div>
        </div>

        <figcaption className="border-t border-border px-5 py-4 text-center text-xs leading-relaxed text-muted-foreground sm:px-9">
          {p.note}
        </figcaption>
      </figure>
      <p className="mt-8 text-center text-sm text-muted-foreground">{copy.principle}</p>
    </section>
  );
}