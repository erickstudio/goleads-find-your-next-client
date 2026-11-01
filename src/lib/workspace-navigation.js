import { Search, Bookmark, Send, Library, History, MessageSquare, ChartNoAxesCombined, Gauge, CreditCard, BriefcaseBusiness, Bot, Plug, Settings } from "lucide-react";

export const workspaceGroups = [
  { key: "prospecting", items: [
    { to: "/app", key: "discover", icon: Search },
    { to: "/saved", key: "saved", icon: Bookmark },
    { to: "/outreach-planner", key: "outreach", icon: Send },
  ] },
  { key: "research", items: [
    { to: "/evidence-library", key: "evidence", icon: Library },
    { to: "/search-history", key: "history", icon: History },
    { to: "/feedback-summary", key: "feedback", icon: MessageSquare },
    { to: "/market-insights", key: "insights", icon: ChartNoAxesCombined },
  ] },
  { key: "account", items: [
    { to: "/dashboard", key: "dashboard", icon: Gauge },
    { to: "/subscription", key: "subscription", icon: Gauge },
    { to: "/plans", key: "plans", icon: CreditCard },
    { to: "/onboarding", key: "services", icon: BriefcaseBusiness },
    { to: "/agent-settings", key: "agents", icon: Bot },
    { to: "/connect", key: "connect", icon: Plug },
    { to: "/settings", key: "settings", icon: Settings },
  ] },
];