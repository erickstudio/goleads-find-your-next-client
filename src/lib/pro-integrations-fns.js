import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { loadPlanAccess, requireProContext } from "@/lib/plan-access.server";

const SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";
const selection = z.object({ opportunity_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(100) });

export const getCurrentPlanAccess = createServerFn({ method: "GET" }).middleware([requireUser])
  .handler(({ context }) => loadPlanAccess(context));

export const getGoogleIntegrationWorkspace = createServerFn({ method: "GET" }).middleware([requireUser])
  .handler(async ({ context }) => {
    const access = await loadPlanAccess(context);
    const connection = await context.getBase44().asServiceRole.connectors.getCurrentAppUserConnection(SHEETS_CONNECTOR_ID).catch((e) => {
      if (e?.status === 404) return null;
      throw e;
    });
    return { access, connected: Boolean(connection?.accessToken), connectorId: SHEETS_CONNECTOR_ID };
  });

export async function selectedOwnedLeads(context, ids) {
  const wanted = new Set(ids.filter((id) => !id.startsWith("demo-")));
  const db = context.getBase44();
  const [opps, saved] = await Promise.all([
    db.entities.Opportunity.filter({ created_by_id: context.user.id }, { limit: 100, sort: "-created_date" }),
    db.entities.SavedOpportunity.filter({ created_by_id: context.user.id }, { limit: 100, sort: "-created_date" }),
  ]);
  const byId = new Map();
  for (const row of [...(opps?.items || []), ...(saved?.items || [])]) {
    const id = row.opportunity_id || row.id;
    if (wanted.has(id) && row.created_by_id === context.user.id && (!row.owner_id || row.owner_id === context.user.id)) byId.set(id, { ...byId.get(id), ...row, opportunity_id: id });
  }
  return [...byId.values()];
}

export function encodeCsv(rows) {
  const cell = (value) => {
    let text = String(value ?? "").replace(/[\r\n]+/g, " ");
    if (/^\s*[=+\-@\t]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export const exportLeadsToCsv = createServerFn({ method: "POST" }).middleware([requireUser]).validator(selection)
  .handler(async ({ context, data }) => {
    await requireProContext(context);
    const leads = await selectedOwnedLeads(context, data.opportunity_ids);
    return { csv: encodeCsv([["Business", "Location", "Website", "Source", "Stage", "Email draft"], ...leads.map((r) => [r.business_name, r.location, r.website_url, r.source_url, r.review_stage || "saved", r.outreach_draft])]), count: leads.length };
  });

export const exportLeadsToWorkspaceDocument = createServerFn({ method: "POST" }).middleware([requireUser]).validator(selection)
  .handler(async ({ context, data }) => {
    await requireProContext(context);
    const leads = await selectedOwnedLeads(context, data.opportunity_ids);
    if (!leads.length) throw new Error("No hay leads seleccionados en tu cuenta.");
    const connection = await context.getBase44().asServiceRole.connectors.getCurrentAppUserConnection(SHEETS_CONNECTOR_ID);
    if (!connection?.accessToken) throw new Error("Conecta tu cuenta de Google para crear el documento.");
    const name = `GoLeads — ${leads.length} leads — ${new Date().toISOString().slice(0, 10)}`;
    const content = name + "\n\n" + leads.map((r) => [r.business_name, r.location, r.website_url, r.source_url, r.service_fit_inference, r.outreach_draft].filter(Boolean).join("\n")).join("\n\n---\n\n");
    const boundary = "goleads_" + crypto.randomUUID();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: "application/vnd.google-apps.document" })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    const result = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${connection.accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
    });
    if (!result.ok) throw new Error("No se pudo crear el documento en tu cuenta de Google. Comprueba los permisos de la conexión.");
    const file = await result.json();
    return { url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`, name: file.name, count: leads.length };
  });

