import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const GOOGLE_SHEETS_CONNECTOR_ID = "6ae79347cd3d8383bd8d098a";

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
  const s = String(val ?? "").replace(/\r?\n/g, " ").trim();
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
      stage_filter: z.string().max(40).optional(),
      spreadsheet_title: z.string().trim().max(120).optional(),
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
    } else {
      targetRecords = ownedOpps.filter((opp) => {
        if (requestedIds && requestedIds.size > 0) {
          return requestedIds.has(opp.id);
        }
        return true;
      });
    }

    if (targetRecords.length === 0) {
      throw new Error("No leads matched the current selection to export.");
    }

    const headers = [
      "lead_id",
      "business_name",
      "business_category",
      "location",
      "website_url",
      "signal_type",
      "signal_summary",
      "source_verification_status",
      "user_commercial_stage",
      "user_relevance_verdict",
      "publication_date",
      "event_date",
      "source_title",
      "source_url",
      "supporting_excerpt",
      "service_fit_hypothesis",
      "target_services",
      "outreach_draft",
      "qualification_notes",
      "retrieved_at_utc",
    ];

    const rows = targetRecords.map((rec) => {
      const oppId = rec.opportunity_id || rec.id;
      const savedMatch = savedByOppId.get(oppId);
      const fbMatch = feedbackByOppId.get(oppId);
      const servicesArr = Array.isArray(rec.inferred_service_categories)
        ? rec.inferred_service_categories
        : Array.isArray(savedMatch?.inferred_service_categories)
        ? savedMatch.inferred_service_categories
        : [];

      return [
        String(oppId || ""),
        String(rec.business_name || ""),
        String(rec.business_category || ""),
        String(rec.location || ""),
        String(rec.website_url || savedMatch?.website_url || ""),
        String(rec.signal_type || ""),
        String(rec.signal_summary || ""),
        String(rec.verification_status || "needs_review"),
        String(savedMatch?.review_stage || rec.review_stage || "unsaved"),
        String(fbMatch?.verdict || "unrated"),
        String(rec.publication_date || ""),
        String(rec.event_date || ""),
        String(rec.source_title || ""),
        String(rec.source_url || ""),
        String(rec.supporting_excerpt || ""),
        String(rec.service_fit_inference || ""),
        servicesArr.join("; "),
        String(savedMatch?.outreach_draft || rec.outreach_draft || ""),
        String(savedMatch?.qualification_notes || rec.qualification_notes || ""),
        String(rec.retrieval_date || ""),
      ];
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const title =
      data.spreadsheet_title ||
      `GoLeads CRM & MCP Export (${todayStr}) — ${rows.length} leads`;

    const allValues = [headers, ...rows];

    const sheetsBody = {
      properties: { title },
      sheets: [
        {
          properties: {
            title: "Leads",
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
                      ? { textFormat: { bold: true } }
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