import { createFileRoute } from "@tanstack/react-router";
import { ConsentPage } from "@/components/auth/ConsentPage";

export const Route = createFileRoute("/oauth/consent")({
  ssr: false,
  headers: () => ({ "X-Robots-Tag": "noindex, nofollow" }),
  head: () => ({ meta: [{ title: "Authorize connection — GoLeads" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ConsentPage,
});