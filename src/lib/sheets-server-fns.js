import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { buildStructuredExportTable } from "@/lib/export-builder";

const GOOGLE_SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";

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

function deduplicateByOpportunityId(records = []) {
  const seen = new Set();
  const unique = [];
  for (const rec of records) {
    const key = rec?.opportunity_id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(rec);
  }
  return unique;
}

function escapeCsvCell(val) {
  let s = String(val ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const getGoogleSheetsConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const connection = await base44.asServiceRole.connectors
      .getCurrentAppUserConnection(GOOGLE_SHEETS_CONNECTOR_ID)
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      });

    if (!connection || !connection.accessToken) {
      return {
        connected: false,
        connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
      };
    }

    return {
      connected: true,
      connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
    };
  });

export const exportLeadsToGoogleSheets = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      source: z.enum(["saved", "discover"]).default("saved"),
      opportunity_ids: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
      local_places: z.array(LocalPlaceExportSchema).max(50).optional(),
      stage_filter: z.string().max(40).optional(),
      spreadsheet_title: z.string().trim().max(120).optional(),
      language: z.enum(["en", "es"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const userId = context.user.id;

    const connection = await base44.asServiceRole.connectors
      .getCurrentAppUserConnection(GOOGLE_SHEETS_CONNECTOR_ID)
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      });

    if (!connection || !connection.accessToken) {
      return {
        connected: false,
        connectorId: GOOGLE_SHEETS_CONNECTOR_ID,
      };
    }

    const [savedPage, oppsPage, feedbackPage] = await Promise.all([
      base44.entities.SavedOpportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.Opportunity.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
      base44.entities.OpportunityFeedback.filter(
        { created_by_id: userId },
        { sort: "-created_date", limit: 100 }
      ),
    ]);

    const ownedSaved = deduplicateByOpportunityId(
      (savedPage?.items || []).filter(
        (s) => s.created_by_id === userId && (!s.owner_id || s.owner_id === userId)
      )
    );
    const ownedOpps = (oppsPage?.items || []).filter(
      (o) => o.created_by_id === userId && (!o.owner_id || o.owner_id === userId)
    );
    const ownedFeedback = deduplicateByOpportunityId(
      (feedbackPage?.items || []).filter(
        (f) => f.created_by_id === userId && (!f.owner_id || f.owner_id === userId)
      )
    );

    const savedByOppId = new Map(ownedSaved.map((s) => [s.opportunity_id, s]));
    const feedbackByOppId = new Map(ownedFeedback.map((f) => [f.opportunity_id, f]));

    let targetRecords = [];
    const requestedIds = Array.isArray(data.opportunity_ids)
      ? new Set(data.opportunity_ids.filter((id) => !id.startsWith("demo-")))
      : null;

    if (data.source === "saved") {
      targetRecords = ownedSaved.filter((item) => {
        if (requestedIds && requestedIds.size > 0 && !requestedIds.has(item.opportunity_id)) {
          return false;
        }
        if (data.stage_filter && data.stage_filter !== "all") {
          return (item.review_stage || "saved") === data.stage_filter;
        }
        return true;
      });
    } else if (!requestedIds || requestedIds.size > 0) {
      targetRecords = ownedOpps.filter((opp) => {
        if (requestedIds && requestedIds.size > 0) {
          return requestedIds.has(opp.id);
        }
        return false;
      });
    }

    const { headers, rows } = buildStructuredExportTable({
      records: targetRecords,
      localPlaces: data.local_places || [],
      savedByOppId,
      feedbackByOppId,
      lang: data.language || "es",
    });

    if (rows.length === 0) {
      throw new Error("No leads matched the current selection to export.");
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const title =
      data.spreadsheet_title ||
      `GoLeads Export (${todayStr}) — ${rows.length} leads (IA + Google Places)`;

    const allValues = [headers, ...rows];

    const sheetsBody = {
      properties: { title },
      sheets: [
        {
          properties: {
            title: "Leads (IA + Places)",
            gridProperties: { frozenRowCount: 1 },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: allValues.map((row, rowIndex) => ({
                values: row.map((cell) => ({
                  userEnteredValue: { stringValue: String(cell ?? "") },
                  userEnteredFormat:
                    rowIndex === 0
                      ? {
                          backgroundColor: { red: 0.19, green: 0.14, blue: 0.48 },
                          textFormat: {
                            bold: true,
                            foregroundColor: { red: 1, green: 1, blue: 1 },
                          },
                        }
                      : undefined,
                })),
              })),
            },
          ],
        },
      ],
    };

    const sheetsRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sheetsBody),
    });

    if (sheetsRes.ok) {
      const created = await sheetsRes.json();
      return {
        connected: true,
        exportedCount: rows.length,
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: title,
        spreadsheetUrl:
          created.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
      };
    }

    const csvContent = allValues
      .map((r) => r.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\r\n");

    const boundary = "goleads_sheets_boundary_" + Date.now();
    const metadata = {
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
    };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/csv; charset=UTF-8\r\n\r\n` +
      `${csvContent}\r\n` +
      `--${boundary}--`;

    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text().catch(() => "");
      throw new Error(
        `Google Sheets export failed (${driveRes.status}): ${errText.slice(0, 180)}`
      );
    }

    const driveFile = await driveRes.json();
    return {
      connected: true,
      exportedCount: rows.length,
      spreadsheetId: driveFile.id,
      spreadsheetTitle: driveFile.name || title,
      spreadsheetUrl:
        driveFile.webViewLink ||
        `https://docs.google.com/spreadsheets/d/${driveFile.id}/edit`,
    };
  });