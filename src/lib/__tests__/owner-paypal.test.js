import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

async function load(file, { secrets = {}, fetch = () => { throw new Error("Unexpected provider call"); }, mocks = {} } = {}) {
  const context = vm.createContext({ URL, URLSearchParams, Response, Request, Headers, AbortSignal, setTimeout, clearTimeout, console, fetch, crypto:globalThis.crypto });
  const cache = new Map();
  async function get(spec, parent = process.cwd() + "/root.js") {
    let key = spec.startsWith("@/") ? path.resolve("src",spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(parent),spec) : spec;
    if (path.isAbsolute(key) && !key.endsWith(".js") && !key.endsWith(".jsx")) key += ".js";
    if (cache.has(key)) return cache.get(key);
    let values = mocks[spec];
    if (!values && spec === "@tanstack/react-start") values = { createServerFn: () => { const b={middleware:()=>b,validator:()=>b,handler:(fn)=>fn};return b;} };
    if (!values && key.endsWith("/auth-middleware.js")) values = { requireUser:{} };
    if (!values && spec === "base44:runtime") values = { secrets:{get:(name)=>secrets[name]} };
    if (!values && (spec === "zod" || spec.startsWith("node:"))) values = await import(spec);
    const mod = values ? new vm.SyntheticModule(Object.keys(values),function(){for(const [name,value] of Object.entries(values))this.setExport(name,value);},{context}) : new vm.SourceTextModule(await readFile(key,"utf8"),{identifier:key,context});
    cache.set(key,mod);await mod.link((child)=>get(child,key));return mod;
  }
  const mod=await get(path.resolve(file));await mod.evaluate();return mod.namespace;
}
const settings={GOLEADS_OWNER_USER_ID:"owner-1",PAYPAL_ID_TEST:"sandbox-id",PAYPAL_SECRET_TEST:"sandbox-secret",PAYPAL_PLAN_ID_TEST:"P-TEST",PAYPAL_WEBHOOK_ID_TEST:"WH-TEST",PAYPAL_PLAN_SEARCH_ALLOWANCE:"500"};
const emptyContext=(user)=>({user,getBase44:()=>({entities:{PayPalSubscription:{filter:async()=>({items:[]})}}})});
test("Owner access requires the pinned immutable authenticated ID, never an email, role or profile flag",async()=>{
  const a=await load("src/lib/owner-access.server.js",{secrets:settings});
  assert.equal(a.isOwnerAccount({id:"owner-1"}),true);
  assert.equal(a.isOwnerAccount({id:"other",email:"erick.jx@gmail.com",role:"admin",isOwner:true}),false);
  assert.equal(a.isOwnerAccount(null),false);
  const unset=await load("src/lib/owner-access.server.js");assert.equal(unset.isOwnerAccount({id:"owner-1",role:"admin"}),false);
});
test("Owner receives Pro without a subscription; every other account still needs verified payment",async()=>{
  const a=await load("src/lib/plan-access.server.js",{secrets:settings});
  const owner=await a.loadPlanAccess(emptyContext({id:"owner-1"}));
  assert.equal(owner.isPro,true);assert.equal(owner.isOwner,true);assert.equal(owner.unlimitedSearches,true);assert.equal(owner.maxResultsPerSearch,20);assert.equal(owner.canWorkspace,true);assert.equal(owner.canMcp,true);
  const other=await a.loadPlanAccess(emptyContext({id:"other",role:"admin",isOwner:true}));
  assert.equal(other.isPro,false);assert.equal(other.canMcp,false);await assert.rejects(a.requireProContext(emptyContext({id:"other"})),{status:403});
});
test("Owner quota survives exhausted daily usage without inventing paid credits",async()=>{
  const a=await load("src/lib/server-fns.js",{secrets:settings,mocks:{"@/lib/discovery.server":{queryBuiltInWebSearchWithRetry:()=>{},verifyAndStructureCandidates:()=>{}}}});
  const now=Date.now();const searches=Array.from({length:4},(_,i)=>({status:"completed",executed_at:new Date(now-i*1000).toISOString(),counts_toward_quota:true}));
  const normal=a.computeQuotaUsage(searches,now,[],[],false);assert.equal(normal.remainingToday,0);assert.equal(normal.isPro,false);
  const owner=a.computeQuotaUsage(searches,now,[],[],true);assert.equal(owner.unlimitedSearches,true);assert.equal(owner.isPro,true);assert.equal(owner.maxResultsPerSearch,20);assert.equal(owner.subscriptionGrantedTotal,0);assert.equal(owner.subscriptionRemaining,0);assert.ok(owner.remainingToday>0);
});
test("Owner billing response does not pretend that an unpaid subscription exists",async()=>{
  const p=await load("src/lib/plan-policy.js");const summary=p.customerBillingSummary({config:{},quota:{},isOwner:true});
  assert.equal(summary.access.entitlementSource,"owner");assert.equal(summary.subscription,null);assert.equal(summary.offer.checkout.ready,false);
});
test("User-provided Live plan alias never leaks into Sandbox",async()=>{
  const p=await load("src/lib/paypal-billing.server.js",{secrets:{...settings,PAYPAL_PLAN_ID_TEST:undefined,PAYPAL_SUSCRIPTION_ID:"P-LIVE-EXAMPLE"}});
  assert.equal(p.getPayPalServerConfig({env:"sandbox"}).planId,"");assert.equal(p.getPayPalServerConfig({env:"live"}).planId,"P-LIVE-EXAMPLE");
});
test("Preparing a test plan cannot call Live APIs and reuses a matching active plan",async()=>{
  const calls=[];
  const p=await load("src/lib/sandbox-plan.server.js",{secrets:{...settings,PAYPAL_ENV:"live"},fetch:async(url,options)=>{
    calls.push([url,options.method||"GET"]);assert.ok(url.startsWith("https://api-m.sandbox.paypal.com/"));
    if(url.endsWith("/v1/oauth2/token"))return Response.json({access_token:"fake"});
    if(url.includes("/v1/billing/plans?"))return Response.json({plans:[{id:"P-EXISTING",name:"GoLeads Pro Sandbox 9.99 monthly",status:"ACTIVE"}]});
    if(url.endsWith("/v1/billing/plans/P-EXISTING"))return Response.json({id:"P-EXISTING",status:"ACTIVE",billing_cycles:[{tenure_type:"REGULAR",frequency:{interval_unit:"MONTH",interval_count:1},pricing_scheme:{fixed_price:{value:"9.99",currency_code:"USD"}}}]});
    throw new Error("Unexpected request");
  }});
  const plan=await p.ensureSandboxProPlan();assert.equal(plan.created,false);assert.equal(plan.amount,"9.99");assert.equal(plan.environment,"sandbox");assert.equal(calls.filter(([url,method])=>method==="POST"&&!url.endsWith("/token")).length,0);
});
test("Ordinary users cannot run the administrative test-plan setup",async()=>{
  let calls=0;const p=await load("src/lib/payment-admin-fns.js",{secrets:settings,fetch:async()=>{calls++;throw new Error("Forbidden outbound call");}});
  await assert.rejects(p.prepareSandboxProPlan({context:{user:{id:"other",role:"user"}}}),{status:403});assert.equal(calls,0);
});

