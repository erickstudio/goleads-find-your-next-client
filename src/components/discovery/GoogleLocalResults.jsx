import GoogleSheetsExportPanel from "@/components/GoogleSheetsExportPanel";
import { safePublicUrl } from "@/lib/public-url";

export default function GoogleLocalResults({ d }) {
  if (d.showExamples || !d.localSearchStatus || d.localSearchStatus === "not_requested") {
    return null;
  }
  const es = d.lang === "es";
  const showStandaloneExport =
    d.localPlaces?.length > 0 &&
    (d.activeSearch?.search_mode === "local" ||
      (!d.activeLiveOpps?.length && !d.dismissedLiveOpps?.length));

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {es ? "Negocios locales (Google Places)" : "Local businesses (Google Places)"}
          </h2>
          <p className="text-xs leading-6 text-muted-foreground">
            {es
              ? "Fichas consultadas en vivo e integradas con los resultados de IA del mismo local y su información pública de contacto disponible para exportar."
              : "Live business listings integrated with matching AI venue results and publicly available contact details for export."}
          </p>
        </div>
        <span className="inline-block px-[10px] pt-[10px] pb-[5px]">
          <img
            src="/google-maps-light.svg"
            alt="Google Maps"
            className="h-[18px] w-auto dark:hidden"
          />
          <img
            src="/google-maps-dark.svg"
            alt="Google Maps"
            className="hidden h-[18px] w-auto dark:block"
          />
        </span>
      </div>

      {showStandaloneExport && (
        <GoogleSheetsExportPanel
          source="discover"
          records={[]}
          localPlaces={d.localPlaces}
        />
      )}

      {d.localSearchStatus === "unavailable" ? (
        <p role="status" className="text-sm">
          {es
            ? "La búsqueda local no está disponible ahora. Puedes continuar con los resultados web."
            : "Local search is unavailable right now. You can continue with web results."}
        </p>
      ) : d.localPlaces.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {d.localPlaces.map((p) => (
            <li
              key={p.placeId}
              className="rounded-xl border border-border p-4 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  {p.matched_opportunity_name && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary border border-primary/30">
                      {es ? "Vinculado con resultado IA" : "Linked with AI result"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{p.address}</p>

                {p.businessStatus === "CLOSED_PERMANENTLY" && (
                  <p className="text-xs text-destructive">
                    {es ? "Cerrado permanentemente" : "Permanently closed"}
                  </p>
                )}

                {(p.website_url || p.public_email || p.public_phone) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                    {p.website_url && (
                      <a
                        href={safePublicUrl(p.website_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        {es ? "Sitio web" : "Website"}
                      </a>
                    )}
                    {p.public_email && (
                      <a
                        href={`mailto:${p.public_email}`}
                        className="text-primary hover:underline font-medium break-all"
                      >
                        {p.public_email}
                      </a>
                    )}
                    {p.public_phone && (
                      <a
                        href={`tel:${p.public_phone}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {p.public_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-xs font-medium text-primary hover:underline"
                >
                  {es ? "Ver en Google Maps ↗" : "View on Google Maps ↗"}
                </a>
                {p.attributions?.map((a, i) => (
                  <span key={i} className="text-[11px] text-muted-foreground">
                    {a.uri ? (
                      <a href={a.uri} target="_blank" rel="noopener noreferrer">
                        {a.provider}
                      </a>
                    ) : (
                      a.provider
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {es
            ? "No encontramos fichas locales para estos filtros. Prueba otro sector o ciudad."
            : "No local listings matched these filters. Try another category or city."}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        <a
          href="https://maps.google.com/help/terms_maps/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Google Maps Terms
        </a>{" "}
        ·{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Google Privacy
        </a>
      </p>
    </section>
  );
}