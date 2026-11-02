import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

async function load(file, { secrets = {} } = {}) {
  const ctx = vm.createContext({
    URL,
    URLSearchParams,
    Response,
    Request,
    Headers,
    AbortSignal,
    setTimeout,
    clearTimeout,
    console,
    crypto: globalThis.crypto,
  });
  const cache = new Map();
  async function get(spec, parent = path.resolve("root.js")) {
    let key = spec.startsWith("@/")
      ? path.resolve("src", spec.slice(2))
      : spec.startsWith(".")
      ? path.resolve(path.dirname(parent), spec)
      : spec;
    if (path.isAbsolute(key) && !key.endsWith(".js") && !key.endsWith(".jsx")) {
      key += ".js";
    }
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      let exports;
      if (spec === "base44:runtime") {
        exports = { secrets: { get: (name) => secrets[name] } };
      } else if (spec === "zod" || spec.startsWith("node:")) {
        exports = await import(spec);
      }
      const mod = exports
        ? new vm.SyntheticModule(
            Object.keys(exports),
            function () {
              for (const [name, value] of Object.entries(exports)) {
                this.setExport(name, value);
              }
            },
            { context: ctx }
          )
        : new vm.SourceTextModule(await readFile(key, "utf8"), {
            identifier: key,
            context: ctx,
          });
      await mod.link((child) => get(child, key));
      return mod;
    })();
    cache.set(key, p);
    return p;
  }
  const mod = await get(path.resolve(file));
  await mod.evaluate();
  return mod.namespace;
}

test("Resolves Spanish (*Es) templates when profile ui_language is 'es' and English templates when 'en'", async () => {
  const emailMod = await load("src/lib/email-communications.server.js");
  for (const [key, enTpl, esTpl] of [
    ["welcome", "Welcome", "WelcomeEs"],
    ["newsletter", "Newsletter", "NewsletterEs"],
    ["promotion", "Promotion", "PromotionEs"],
    ["product_update", "ProductUpdate", "ProductUpdateEs"],
    ["enquiry_reply", "EnquiryReply", "EnquiryReplyEs"],
  ]) {
    const esResult = emailMod.resolveTemplateForLanguage(key, {
      ui_language: "es",
    });
    assert.equal(esResult.language, "es");
    assert.equal(esResult.templateName, esTpl);

    const enResult = emailMod.resolveTemplateForLanguage(key, {
      ui_language: "en",
    });
    assert.equal(enResult.language, "en");
    assert.equal(enResult.templateName, enTpl);

    const fallbackResult = emailMod.resolveTemplateForLanguage(key, {});
    assert.equal(fallbackResult.language, "en");
    assert.equal(fallbackResult.templateName, enTpl);
  }
});

test("Sends communication email in the language stored in UserProfile.ui_language with custom bilingual content", async () => {
  const emailMod = await load("src/lib/email-communications.server.js");
  const sentCalls = [];
  const customCampaign = emailMod.mergeCampaignContentWithDefaults(
    "product_update",
    {
      subject_es: "Nuevo motor híbrido en GoLeads",
      subject_en: "New hybrid engine in GoLeads",
      headline_es: "Descubre clientes más rápido",
      headline_en: "Discover clients faster",
    }
  );

  const fakeServiceRole = {
    entities: {
      UserProfile: {
        filter: async ({ created_by_id }) => ({
          items: [
            {
              id: "prof-1",
              created_by_id,
              owner_id: created_by_id,
              ui_language: created_by_id === "user-es" ? "es" : "en",
              agency_or_freelancer_name: "Estudio Norte",
            },
          ],
        }),
      },
    },
    integrations: {
      Core: {
        SendEmail: async (payload) => {
          sentCalls.push(payload);
          return { success: true };
        },
      },
    },
  };

  const resEs = await emailMod.sendCommunicationEmailByProfileLanguage({
    serviceRoleBase44: fakeServiceRole,
    recipientEmail: "cliente-es@example.com",
    recipientUserId: "user-es",
    emailKey: "product_update",
    campaignContent: customCampaign,
  });
  assert.equal(resEs.ok, true);
  assert.equal(resEs.language, "es");
  assert.equal(resEs.templateName, "ProductUpdateEs");
  assert.equal(sentCalls[0].template_name, "ProductUpdateEs");
  assert.equal(sentCalls[0].subject, "Nuevo motor híbrido en GoLeads");
  assert.equal(sentCalls[0].variables.headline, "Descubre clientes más rápido");

  const resEn = await emailMod.sendCommunicationEmailByProfileLanguage({
    serviceRoleBase44: fakeServiceRole,
    recipientEmail: "client-en@example.com",
    recipientUserId: "user-en",
    emailKey: "product_update",
    campaignContent: customCampaign,
  });
  assert.equal(resEn.ok, true);
  assert.equal(resEn.language, "en");
  assert.equal(resEn.templateName, "ProductUpdate");
  assert.equal(sentCalls[1].template_name, "ProductUpdate");
  assert.equal(sentCalls[1].subject, "New hybrid engine in GoLeads");
  assert.equal(sentCalls[1].variables.headline, "Discover clients faster");
});

test("Complimentary Pro grants and invite passwords work independently of PayPal subscriptions", async () => {
  const subAccess = await load("src/lib/subscription-access.js");
  const superAdmin = await load("src/lib/superadmin.server.js", {
    secrets: { GOLEADS_OWNER_USER_ID: "owner-1" },
  });
  const planPolicy = await load("src/lib/plan-policy.js");

  const nowMs = Date.parse("2026-11-02T12:00:00Z");
  const codeHash = superAdmin.hashAccessCode("BETA-FEEDBACK-2026");
  assert.equal(
    superAdmin.verifyAccessCodeHash("BETA-FEEDBACK-2026", codeHash),
    true
  );
  assert.equal(superAdmin.verifyAccessCodeHash("WRONG-PASS", codeHash), false);

  const storedGrants = [
    {
      id: "code-1",
      grant_type: "access_code",
      access_code_hash: codeHash,
      access_code_label: "BET***26",
      reason: "beta_feedback",
      status: "active",
      granted_search_allowance: 150,
      used_searches: 0,
      max_redemptions: 2,
      redemption_count: 0,
      expires_at_iso: "2026-12-02T12:00:00Z",
    },
  ];

  assert.equal(subAccess.isProAccessGrantActive(storedGrants[0], nowMs), false);

  const fakeServiceRole = {
    entities: {
      ProAccessGrant: {
        filter: async () => ({ items: storedGrants }),
        update: async (id, patch) => {
          const idx = storedGrants.findIndex((g) => g.id === id);
          storedGrants[idx] = { ...storedGrants[idx], ...patch };
          return storedGrants[idx];
        },
        create: async (payload) => {
          const created = { id: `grant-${storedGrants.length + 1}`, ...payload };
          storedGrants.push(created);
          return created;
        },
      },
    },
  };

  const redeemed = await superAdmin.redeemComplimentaryProCode({
    serviceRoleBase44: fakeServiceRole,
    user: { id: "tester-1", email: "tester@example.com" },
    rawCode: "BETA-FEEDBACK-2026",
    nowMs,
  });

  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.grant.target_user_id, "tester-1");
  assert.equal(redeemed.grant.granted_search_allowance, 150);
  assert.equal(subAccess.isProAccessGrantActive(redeemed.grant, nowMs), true);
  assert.equal(
    subAccess.isPayPalSubscriptionAllowanceActive(redeemed.grant, nowMs),
    false
  );

  // Verify planAccessForSubscriptions grants Pro when complimentaryGrants is active without touching PayPal
  const access = planPolicy.planAccessForSubscriptions([], nowMs, {
    complimentaryGrants: [redeemed.grant],
  });
  assert.equal(access.isPro, true);
  assert.equal(access.entitlementSource, "complimentary");
  assert.equal(access.maxResultsPerSearch, 20);
});