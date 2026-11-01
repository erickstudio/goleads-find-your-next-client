import { createFileRoute } from "@tanstack/react-router";
import Connect from "@/pages/Connect";

export const Route = createFileRoute("/connect")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connect AI Assistant (MCP) — GoLeads" },
      {
        name: "description",
        content:
          "Instructions to connect Claude, ChatGPT, Cursor, or any MCP client to your GoLeads workspace.",
      },
    ],
  }),
  component: Connect,
});