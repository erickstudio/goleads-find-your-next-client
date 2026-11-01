import { createFileRoute } from "@tanstack/react-router";
import PublicInfoPage from "@/components/launch/PublicInfoPage";
import { publicHead } from "@/lib/public-head";

export const Route = createFileRoute("/_site/terms")({ head: ({ match }) => publicHead(match?.search?.lang, "termsPage"), component: TermsPage });
function TermsPage() { return <PublicInfoPage page="termsPage" />; }