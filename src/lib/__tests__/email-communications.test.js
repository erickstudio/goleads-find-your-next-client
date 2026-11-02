import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTemplateForLanguage,
  sendCommunicationEmailByProfileLanguage,
} from "../email-communications.server.js";

test("Resolves Spanish (*Es) templates when profile ui_language is 'es' and English templates when 'en'", () => {
  for (const [key, enTpl, esTpl] of [
    ["welcome", "Welcome", "WelcomeEs"],
    ["newsletter", "Newsletter", "NewsletterEs"],
    ["promotion", "Promotion", "PromotionEs"],
    ["product_update", "ProductUpdate", "ProductUpdateEs"],
  ]) {
    const esResult = resolveTemplateForLanguage(key, { ui_language: "es" });
    assert.equal(esResult.language, "es");
    assert.equal(esResult.templateName, esTpl);

    const enResult = resolveTemplateForLanguage(key, { ui_language: "en" });
    assert.equal(enResult.language, "en");
    assert.equal(enResult.templateName, enTpl);

    const fallbackResult = resolveTemplateForLanguage(key, {});
    assert.equal(fallbackResult.language, "en");
    assert.equal(fallbackResult.templateName, enTpl);
  }
});

test("Sends communication email in the language stored in UserProfile.ui_language", async () => {
  const sentCalls = [];
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

  const resEs = await sendCommunicationEmailByProfileLanguage({
    serviceRoleBase44: fakeServiceRole,
    recipientEmail: "cliente-es@example.com",
    recipientUserId: "user-es",
    emailKey: "welcome",
  });
  assert.equal(resEs.ok, true);
  assert.equal(resEs.language, "es");
  assert.equal(resEs.templateName, "WelcomeEs");
  assert.equal(sentCalls[0].template_name, "WelcomeEs");
  assert.equal(sentCalls[0].to, "cliente-es@example.com");

  const resEn = await sendCommunicationEmailByProfileLanguage({
    serviceRoleBase44: fakeServiceRole,
    recipientEmail: "client-en@example.com",
    recipientUserId: "user-en",
    emailKey: "newsletter",
  });
  assert.equal(resEn.ok, true);
  assert.equal(resEn.language, "en");
  assert.equal(resEn.templateName, "Newsletter");
  assert.equal(sentCalls[1].template_name, "Newsletter");
  assert.equal(sentCalls[1].to, "client-en@example.com");
});