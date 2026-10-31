import { createFileRoute } from "@tanstack/react-router";
import PublicInfoPage from "@/components/launch/PublicInfoPage";
import { publicHead } from "@/lib/public-head";

export const Route = createFileRoute("/_site/privacy")({ head: ({ match }) => publicHead(match.search.lang, "privacyPage"), component: PrivacyPage });
function PrivacyPage() { return <PublicInfoPage page="privacyPage" />; }