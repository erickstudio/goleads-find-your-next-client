import { createFileRoute } from "@tanstack/react-router";
import PublicInfoPage from "@/components/launch/PublicInfoPage";
import { publicHead } from "@/lib/public-head";

export const Route = createFileRoute("/_site/support")({ head: ({ match }) => publicHead(match.search.lang, "supportPage"), component: SupportPage });
function SupportPage() { return <PublicInfoPage page="supportPage" />; }