import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/auth/RegisterPage";
export const Route = createFileRoute("/register")({
  ssr: false,
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ title: "Create account — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: RegisterPage,
});