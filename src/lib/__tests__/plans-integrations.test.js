import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

// Real policy/server functions with provider, auth and secret-store boundaries replaced.
async function load(file, { secrets = {}, fetch = () => { throw new Error("Unexpected provider request"); } } = {}) {
  const ctx = vm.createContext({ URL, URLSearchParams, Response, Request, Headers, AbortSignal, setTimeout, clearTimeout, console, fetch, crypto: globalThis.crypto });
  const cache = new Map();
  async function get(spec, parent = path.resolve("root.js")) {
    let key = spec.startsWith("@/") ? path.resolve("src", spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(parent), spec) : spec;
    if (path.isAbsolute(key) && !key.endsWith(".js") && !key.endsWith(".jsx")) key += ".js";
    if (cache.has(key)) return cache.get(key);
    let exports;
    if (spec === "@tanstack/react-start") exports = { createServerFn: () => { const builder = { middleware: () => builder, validator: () => builder, handler: (fn) => fn }; return builder; } };
    else if (key.endsWith("/auth-middleware.js")) exports = { requireUser: {} };
    else if (spec === "base44:runtime") exports = { secrets: { get: (name) => secrets[name] } };
    else if (spec === "zod" || spec.startsWith("node:")) exports = await import(spec);
    const mod = exports ? new vm.SyntheticModule(Object.keys(exports), function () { for (const [name,value] of Object.entries(exports)) this.setExport(name,value); }, { context: ctx }) : new vm.SourceTextModule(await readFile(key,"utf8"), { identifier:key, context:ctx });
    cache.set(key,mod); await mod.link((child) => get(child,key)); return mod;
  }
  const mod = await get(path.resolve(file)); await mod.evaluate(); return mod.namespace;
}
const now = Date.parse("2026-11-01T12:00:00Z");
const paid = { status:"active", verified_at_iso:"2026-11-01T00:00:00Z", paypal_subscription_id:"I-TEST", current_period_end_iso:"2026-12-01T00:00:00Z", granted_search_allowance:500, used_subscription_searches:499 };
test("Free has 5 results and Sheets; Pro has 20 results, Workspace and MCP even at exhausted allowance until period end", async () => {
  const p = await load("src/lib/plan-policy.js");
  assert.equal(p.planAccessForSubscriptions([],now).maxResultsPerSearch,5);
  assert.equal(p.planAccessForSubscriptions([],now).canExportSheets,true);
  assert.equal(p.planAccessForSubscriptions([],now).canWorkspace,false);
  const pro = p.planAccessForSubscriptions([{...paid,used_subscription_searches:500}],now);
  assert.equal(pro.maxResultsPerSearch,20); assert.equal(pro.canMcp,true);
  assert.equal(p.planAccessForSubscriptions([{...paid,status:"suspended"}],now).isPro,false);
  assert.equal(p.planAccessForSubscriptions([{...paid,current_period_end_iso:"2026-10-31T00:00:00Z"}],now).isPro,false);
  assert.equal(p.planAccessForSubscriptions([{...paid,verified_at_iso:""}],now).isPro,false);
});
test("Customer billing payload omits configuration, webhook, credentials and diagnostic errors", async () => {
  const p = await load("src/lib/plan-policy.js");
  const result = p.customerBillingSummary({config:{env:"sandbox",clientSecret:"SECRET",webhookId:"WH-PRIVATE",missingSecrets:["PAYPAL_WEBHOOK_ID_TEST"],canAuthenticateWithPayPal:true},verification:{ok:false,message:"PAYPAL_SECRET missing"},quota:{remainingToday:3},nowMs:now});
  const json = JSON.stringify(result);
  for (const forbidden of ["SECRET","WH-PRIVATE","PAYPAL_","sandbox","webhook","missingSecrets","verification_notes"]) assert.equal(json.includes(forbidden),false,forbidden);
  assert.equal(result.offer.checkout.ready,false); assert.equal(result.offer.extraSearches,500);
});
test("Free checkout includes the public SDK identifiers while keeping server secrets private", async () => {
  const p = await load("src/lib/plan-policy.js");
  const config = {env:"sandbox",clientId:"public-sdk-client",planId:"P-TESTPLAN",clientSecret:"PRIVATE-SECRET",webhookId:"PRIVATE-WEBHOOK",canAuthenticateWithPayPal:true,hasWebhookId:true,hasConfiguredAllowance:true};
  const result = p.customerBillingSummary({config,verification:{ok:true,plan:{status:"ACTIVE",amount:"9.99",currency:"USD",intervalUnit:"MONTH",intervalCount:1}},subscriptions:[],quota:{remainingToday:3},nowMs:now});
  assert.equal(result.access.isPro,false);
  assert.equal(result.offer.checkout.ready,true);
  assert.equal(result.offer.checkout.clientId,"public-sdk-client");
  assert.equal(result.offer.checkout.planId,"P-TESTPLAN");
  assert.equal(result.offer.checkout.testMode,true);
  assert.equal(JSON.stringify(result).includes("PRIVATE-"),false);
});
test("Only administrators pass diagnostic authorization", async () => {
  const p = await load("src/lib/plan-policy.js");
  for (const user of [null,{role:"user"},{role:"Admin"}]) assert.throws(() => p.assertAdministrator(user),{status:403});
  assert.doesNotThrow(() => p.assertAdministrator({role:"admin"}));
});
test("Free users are rejected before Workspace connector access or document creation", async () => {
  const p = await load("src/lib/pro-integrations-fns.js"); let connectorCalls=0;
  const context = {user:{id:"u1"}, getBase44:() => ({entities:{PayPalSubscription:{filter:async () => ({items:[]})}},asServiceRole:{connectors:{getCurrentAppUserConnection:async () => {connectorCalls++;}}}})};
  await assert.rejects(p.exportLeadsToWorkspaceDocument({context,data:{opportunity_ids:["1"]}}),{status:403,code:"PRO_REQUIRED"});
  await assert.rejects(p.exportLeadsToCsv({context,data:{opportunity_ids:["1"]}}),{status:403,code:"PRO_REQUIRED"});
  assert.equal(connectorCalls,0);
});
test("Exports include selected owned records only and escape spreadsheet formulas", async () => {
  const p = await load("src/lib/pro-integrations-fns.js");
  const context={user:{id:"u1"},getBase44:() => ({entities:{Opportunity:{filter:async () => ({items:[{id:"one",created_by_id:"u1",owner_id:"u1"},{id:"two",created_by_id:"u2",owner_id:"u2"},{id:"three",created_by_id:"u1",owner_id:"u2"}]})},SavedOpportunity:{filter:async () => ({items:[]})}}})};
  const leads=await p.selectedOwnedLeads(context,["one","two","three","demo-1"]);
  assert.equal(leads.length,1); assert.equal(leads[0].opportunity_id,"one");
  assert.match(p.encodeCsv([["=HYPERLINK(\"evil\")","Normal"]]),/^"'=HYPERLINK/);
});
test("Places search is one bounded provider call, deduplicated, without Enterprise fields or database writes", async () => {
  const p=await load("src/lib/google-local.server.js"); let calls=0;
  const result=await p.searchGoogleLocalBusinesses({asServiceRole:{connectors:{callApi:async (_type,request) => {
    calls++; assert.equal(request.body.pageSize,20); assert.doesNotMatch(request.query.fields,/website|rating|review|phone|photo/i);
    return {data:{places:[{id:"a",displayName:{text:"A"},formattedAddress:"Address A"},{id:"a",displayName:{text:"A duplicate"}},{id:"b",displayName:{text:"B"}}]}};
  }}}},{businessCategory:"Cafe",locationQuery:"Panama",maxResults:100});
  assert.equal(calls,1); assert.equal(result.status,"ok"); assert.equal(result.places.length,2);
});
test("Provider failure returns unavailable, never example businesses", async () => {
  const p=await load("src/lib/google-local.server.js");
  const result=await p.searchGoogleLocalBusinesses({asServiceRole:{connectors:{callApi:async () => {throw new Error("Provider failed");}}}},{businessCategory:"Cafe",locationQuery:"Panama"});
  assert.equal(result.status,"unavailable"); assert.equal(result.places.length,0);
});
test("Structured export combines AI opportunities with same-venue Google Places data and standalone Places listings", async () => {
  const eb = await load("src/lib/export-builder.js");
  const table = eb.buildStructuredExportTable({
    records: [
      {
        id: "opp-1",
        business_name: "Café Horizonte",
        business_category: "Cafés",
        location: "Panamá",
        website_url: "https://cafehorizonte.pa",
        public_email: "hola@cafehorizonte.pa",
        public_phone: "+507 6000-1111",
        signal_type: "Nueva sucursal",
        signal_summary: "Apertura en Obarrio",
        verification_status: "verified",
        source_title: "Prensa Local",
        source_url: "https://prensa.pa/cafe",
      },
    ],
    localPlaces: [
      {
        placeId: "pl-1",
        name: "Cafe Horizonte",
        address: "Calle 54 Obarrio, Panamá",
        businessStatus: "OPERATIONAL",
        url: "https://maps.google.com/?cid=1",
      },
      {
        placeId: "pl-2",
        name: "Bistro Casco",
        address: "Casco Antiguo, Panamá",
        businessStatus: "OPERATIONAL",
        url: "https://maps.google.com/?cid=2",
        public_email: "reservas@bistrocasco.pa",
        public_phone: "+507 6000-2222",
      },
    ],
    lang: "es",
  });
  assert.equal(table.rows.length, 2);
  assert.equal(table.items[0].placeAddress, "Calle 54 Obarrio, Panamá");
  assert.equal(table.items[0].publicEmail, "hola@cafehorizonte.pa");
  assert.equal(table.items[1].businessName, "Bistro Casco");
  assert.equal(table.items[1].publicEmail, "reservas@bistrocasco.pa");
});

test("MCP config locks down all entities (no writes, no billing/admin exposure) and exposes only read-only list_saved_leads", async () => {
  const raw = JSON.parse(await readFile(path.resolve("base44/mcp/config.json"), "utf8"));
  assert.equal(raw.auth, "oauth");
  assert.equal(raw.login_path, "/login");
  assert.equal(raw.consent_path, "/oauth/consent");
  const requiredBlockedEntities = [
    "SavedOpportunity",
    "Opportunity",
    "EvidenceItem",
    "LeadSearch",
    "OpportunityFeedback",
    "UserProfile",
    "EmailCampaignContent",
    "PayPalSubscription",
    "PayPalWebhookEvent",
    "PaymentWebhookEvent",
    "PilotEnrollment",
    "User",
    "AdminCollaborator",
    "ProAccessGrant",
  ];
  for (const entity of requiredBlockedEntities) {
    assert.deepEqual(raw.tools.entity_overrides[entity]?.operations, [], `${entity} must opt out of direct MCP tools`);
  }
  assert.equal(raw.tools.functions.length, 1);
  assert.equal(raw.tools.functions[0].name, "list_saved_leads");
  assert.equal(raw.tools.functions[0].handler, "/api/mcp-leads");
  assert.equal(raw.tools.functions[0].annotations.read_only_hint, true);
  assert.equal(raw.tools.functions[0].annotations.destructive_hint, false);
});

test("MCP leads supports Free basic read-only queries (max 5 leads, basic fields) and Pro full read-only queries (up to 50 leads, enriched fields) without write access", async () => {
  const p = await load("src/lib/plan-policy.js");
  const mcpRoute = p;

  const sampleLeads = Array.from({ length: 8 }, (_, idx) => ({
    id: `saved-${idx + 1}`,
    opportunity_id: `opp-${idx + 1}`,
    business_name: `Business ${idx + 1}`,
    business_category: "Restaurants",
    location: "Panamá",
    website_url: `https://example${idx + 1}.com`,
    public_email: `contact${idx + 1}@example.com`,
    public_phone: "+507 6000-0000",
    place_name: `Place ${idx + 1}`,
    place_address: "Calle 50, Panamá",
    place_business_status: "OPERATIONAL",
    place_url: "https://maps.google.com/?cid=1",
    signal_type: "New Opening",
    signal_summary: "Opening new branch",
    verification_status: "verified",
    source_title: "Local Press",
    source_url: "https://press.pa/item",
    review_stage: "saved",
    qualification_notes: "Private note",
    outreach_draft: "Hello!",
  }));

  // 1. Free account: basic MCP enabled (max 5 leads, only basic fields, no email/phone/notes/drafts)
  const freeAccess = p.planAccessForSubscriptions([], now);
  assert.equal(freeAccess.canMcpBasic, true);
  assert.equal(freeAccess.canMcpFull, false);
  assert.equal(freeAccess.maxMcpLeads, 5);
  const freeFormatted = mcpRoute.formatMcpLeadsForPlan(sampleLeads, freeAccess, 20);
  assert.equal(freeFormatted.accessTier, "basic");
  assert.equal(freeFormatted.maxAllowedLimit, 5);
  assert.equal(freeFormatted.leads.length, 5);
  assert.equal(freeFormatted.leads[0].business, "Business 1");
  assert.equal("publicEmail" in freeFormatted.leads[0], false);
  assert.equal("emailDraft" in freeFormatted.leads[0], false);

  // 2. Pro by subscription: full MCP enabled (up to 50 leads, includes contact, Maps, notes, drafts)
  const subAccess = p.planAccessForSubscriptions([paid], now);
  assert.equal(subAccess.canMcpFull, true);
  assert.equal(subAccess.maxMcpLeads, 50);
  const proFormatted = mcpRoute.formatMcpLeadsForPlan(sampleLeads, subAccess, 20);
  assert.equal(proFormatted.accessTier, "full");
  assert.equal(proFormatted.leads.length, 8);
  assert.equal(proFormatted.leads[0].publicEmail, "contact1@example.com");
  assert.equal(proFormatted.leads[0].emailDraft, "Hello!");

  // 3. Pro granted by administrator: full MCP enabled
  const adminGrant = {
    id: "grant-1",
    grant_type: "direct_user",
    target_user_id: "u-grant",
    status: "active",
    granted_search_allowance: 100,
    used_searches: 5,
    expires_at_iso: "2026-12-15T00:00:00Z",
  };
  const grantAccess = p.planAccessForSubscriptions([], now, { complimentaryGrants: [adminGrant] });
  assert.equal(grantAccess.canMcpFull, true);

  // 4. Expired Pro falls back to basic read-only MCP
  const expiredGrantAccess = p.planAccessForSubscriptions([], now, {
    complimentaryGrants: [{ ...adminGrant, expires_at_iso: "2026-10-01T00:00:00Z" }],
  });
  assert.equal(expiredGrantAccess.canMcpBasic, true);
  assert.equal(expiredGrantAccess.canMcpFull, false);
});