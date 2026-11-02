import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

// Real policy/server functions with provider, auth and secret-store boundaries replaced.
async function load(file, { secrets = {}, fetch = () => { throw new Error("Unexpected provider request"); } } = {}) {
  const ctx = vm.createContext({ URL, URLSearchParams, Response, Request, Headers, AbortSignal, setTimeout, clearTimeout, console, fetch, crypto: globalThis.crypto });
  const cache = new Map();
  async function get(spec, parent = process.cwd() + "/root.js") {
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

