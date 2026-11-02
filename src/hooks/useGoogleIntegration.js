import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/AuthContext";
import { getGoogleIntegrationWorkspace } from "@/lib/pro-integrations-fns";
import { base44 } from "@/api/base44Client";

export default function useGoogleIntegration() {
  const { user } = useAuth(); const client = useQueryClient();
  const load = useServerFn(getGoogleIntegrationWorkspace);
  const key = ["google-integration", user?.id];
  const query = useQuery({ queryKey: key, queryFn: () => load(), enabled: Boolean(user?.id), staleTime: 30000, retry: false });
  async function connect() {
    const url = await base44.connectors.connectAppUser(query.data.connectorId);
    // A full navigation avoids popup blockers and polling loops. Google redirects back after consent.
    window.location.assign(url);
  }
  async function disconnect() {
    await base44.connectors.disconnectAppUser(query.data.connectorId);
    await client.invalidateQueries({ queryKey: key });
  }
  return { ...query, connect, disconnect };
}

