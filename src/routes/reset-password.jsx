import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/auth/ResetPasswordPage";
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ title: "Reset password — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ResetPasswordPage,
});