import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";

export const getUserAppearancePreferences = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const page = await context.getBase44().entities.UserProfile.filter(
      { created_by_id: context.user.id }, { sort: "-created_date", limit: 1 }
    );
    const profile = page.items?.[0];
    if (!profile || (profile.owner_id && profile.owner_id !== context.user.id)) return null;
    return { ui_language: profile.ui_language, outreach_language: profile.outreach_language, theme_preference: profile.theme_preference };
  });