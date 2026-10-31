import { createFileRoute } from "@tanstack/react-router";
import { getWorkspaceBootstrap } from "@/lib/server-fns";
import { validateDiscoverySearch } from "@/lib/discovery-search";
import useDiscoveryWorkspace from "@/hooks/useDiscoveryWorkspace";
import DiscoverHeading from "@/components/discovery/DiscoverHeading";
import DiscoverSearchForm from "@/components/discovery/DiscoverSearchForm";
import DiscoverStrategist from "@/components/discovery/DiscoverStrategist";
import DiscoverState from "@/components/discovery/DiscoverState";
import DiscoverResults from "@/components/discovery/DiscoverResults";
import DiscoverExamples from "@/components/discovery/DiscoverExamples";

export const Route = createFileRoute("/_authed/app")({
  ssr: false,
  validateSearch: validateDiscoverySearch,
  loader: () => getWorkspaceBootstrap(),
  head: () => ({ meta: [{ title: "Discover — GoLeads" }, { name: "description", content: "Private opening and expansion research with source evidence and service-fit hypotheses." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: DiscoverPage,
});
function DiscoverPage() {
  const d = useDiscoveryWorkspace();
  return (
    <div className="space-y-6"><DiscoverHeading d={d} /><DiscoverSearchForm d={d} /><DiscoverStrategist d={d} />{d.actionBanner && <div role="status" className="flex items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 text-xs"><span>{d.actionBanner}</span><button type="button" onClick={() => d.setActionBanner("")} className="text-primary hover:underline">{d.t("common.dismiss")}</button></div>}<DiscoverState d={d} /><DiscoverResults d={d} /><DiscoverExamples d={d} /></div>
  );
}