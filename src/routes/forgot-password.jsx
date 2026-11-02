import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ title: "Forgot password — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ForgotPasswordPage,
});