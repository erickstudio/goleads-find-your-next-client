import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";
export const Route = createFileRoute("/login")({
  ssr: false,
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ title: "Sign in — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LoginPage,
});