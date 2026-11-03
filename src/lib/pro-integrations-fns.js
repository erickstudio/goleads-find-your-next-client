import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { loadPlanAccess, requireProContext } from "@/lib/plan-access.server";
import {
  buildStructuredExportTable,
  buildStructuredWorkspaceReport,
} from "@/lib/export-builder";

const SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";

const LocalPlaceExportSchema = z.object({
  placeId: z.string().trim().max(160).optional(),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).optional(),
  businessStatus: z.string().trim().max(80).optional(),
  url: z.string().trim().max(500).optional(),
  category: z.string().trim().max(160).optional(),
  location: z.string().trim().max(200).optional(),
  website_url: z.string().trim().max(500).optional(),
  public_email: z.string().trim().max(160).optional(),
  public_phone: z.string().trim().max(60).optional(),
  signal_type: z.string().trim().max(160).optional(),
  signal_summary: z.string().trim().max(600).optional(),
});

const selection = z.object({
  opportunity_ids: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  local_places: z.array(LocalPlaceExportSchema).max(50).optional(),
  language: z.enum(["en", "es"]).optional(),
});

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

export async function selectedOwnedLeads(context, ids = []) {
  const wanted = new Set((ids || []).filter((id) => !id.startsWith("demo-")));
  if (wanted.size === 0) return [];
  const db = context.getBase44();
  const [opps, saved] = await Promise.all([
    db.entities.Opportunity.filter({ created_by_id: context.user.id }, { limit: 100, sort: "-created_date" }),
    db.entities.SavedOpportunity.filter({ created_by_id: context.user.id }, { limit: 100, sort: "-created_date" }),
  ]);
  const byId = new Map();
  for (const row of [...(opps?.items || []), ...(saved?.items || [])]) {
    const id = row.opportunity_id || row.id;
    if (wanted.has(id) && row.created_by_id === context.user.id && (!row.owner_id || row.owner_id === context.user.id)) {
      byId.set(id, { ...byId.get(id), ...row, opportunity_id: id });
    }
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
    const leads = await selectedOwnedLeads(context, data.opportunity_ids || []);
    const { headers, rows } = buildStructuredExportTable({
      records: leads,
      localPlaces: data.local_places || [],
      lang: data.language || "es",
    });
    return {
      csv: encodeCsv([headers, ...rows]),
      count: rows.length,
    };
  });

export const exportLeadsToWorkspaceDocument = createServerFn({ method: "POST" }).middleware([requireUser]).validator(selection)
  .handler(async ({ context, data }) => {
    await requireProContext(context);
    const leads = await selectedOwnedLeads(context, data.opportunity_ids || []);
    const report = buildStructuredWorkspaceReport({
      records: leads,
      localPlaces: data.local_places || [],
      lang: data.language || "es",
    });
    if (!report.count) throw new Error("No hay leads seleccionados en tu cuenta.");
    const connection = await context.getBase44().asServiceRole.connectors.getCurrentAppUserConnection(SHEETS_CONNECTOR_ID);
    if (!connection?.accessToken) throw new Error("Conecta tu cuenta de Google para crear el documento.");
    const boundary = "goleads_" + crypto.randomUUID();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: report.name, mimeType: "application/vnd.google-apps.document" })}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${report.content}\r\n--${boundary}--`;
    const result = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${connection.accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
    });
    if (!result.ok) throw new Error("No se pudo crear el documento en tu cuenta de Google. Comprueba los permisos de la conexión.");
    const file = await result.json();
    return { url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`, name: file.name, count: report.count };
  });