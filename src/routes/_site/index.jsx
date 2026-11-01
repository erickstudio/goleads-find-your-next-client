import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateDiscoverySearch } from "@/lib/discovery-search";
import { publicHead } from "@/lib/public-head";
import PublicMetadata from "@/components/launch/PublicMetadata";
import LaunchHero from "@/components/launch/LaunchHero";
import ProductPreview from "@/components/launch/ProductPreview";
import HowItWorks from "@/components/launch/HowItWorks";
import EvidenceBenefits from "@/components/launch/EvidenceBenefits";
import IntegrationStatus from "@/components/launch/IntegrationStatus";
import LaunchFAQ from "@/components/launch/LaunchFAQ";

export const Route = createFileRoute("/_site/")({
  validateSearch: validateDiscoverySearch,
  beforeLoad: ({ search }) => {
    const legacy = validateDiscoverySearch(search);
    if (Object.keys(legacy).length > 0) throw redirect({ to: "/app", search: legacy, replace: true });
  },
  head: ({ match }) => publicHead(match?.search?.lang),
  component: LaunchPage,
});
function LaunchPage() {
  return <><PublicMetadata /><LaunchHero /><ProductPreview /><HowItWorks /><EvidenceBenefits /><IntegrationStatus /><LaunchFAQ /></>;
}