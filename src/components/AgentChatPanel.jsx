import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Send, RotateCcw, Loader2 } from "lucide-react";
import AgentMessageBubble from "@/components/AgentMessageBubble";
import { usePreferences } from "@/lib/PreferencesContext";

export default function AgentChatPanel({
  agentName,
  title,
  subtitle,
  badgeLabel,
  conversationTitle,
  starterPrompts = [],
  contextPreamble = "",
  placeholder,
  defaultOpen = false,
}) {
  const { t } = usePreferences();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      if (Array.isArray(data?.messages)) {
        setMessages(data.messages);
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg && lastMsg.role !== "user" && lastMsg.content) {
          setIsSending(false);
        }
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length, isSending]);

  const ensureConversation = async () => {
    if (conversation) return conversation;
    setIsInitializing(true);
    setErrorText("");
    try {
      const created = await base44.agents.createConversation({
        agent_name: agentName,
        metadata: {
          name: conversationTitle || title,
          description: subtitle || title,
        },
      });
      setConversation(created);
      setMessages(created?.messages || []);
      return created;
    } catch (err) {
      setErrorText(err?.message || "Could not start agent conversation.");
      return null;
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendPrompt = async (promptText) => {
    const trimmed = String(promptText || "").trim();
    if (!trimmed || isSending || isInitializing) return;

    setIsOpen(true);
    setErrorText("");
    setIsSending(true);
    setInput("");

    try {
      const activeConv = await ensureConversation();
      if (!activeConv) {
        setIsSending(false);
        return;
      }

      const isFirstMessage = messages.length === 0;
      const contentToSend =
        isFirstMessage && contextPreamble
          ? `${contextPreamble}\n\nUser request: ${trimmed}`
          : trimmed;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

      await base44.agents.addMessage(activeConv, {
        role: "user",
        content: contentToSend,
      });
    } catch (err) {
      setErrorText(err?.message || "Failed to send message to agent.");
    } finally {
      setIsSending(false);
    }
  };

  const handleResetConversation = async () => {
    setConversation(null);
    setMessages([]);
    setErrorText("");
    setIsSending(false);
  };

  return (
    <section className="bg-card text-card-foreground rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-secondary/50 border-b border-border">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="h-3 w-3" />
              {badgeLabel || t("agent.defaultBadge")}
            </span>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetConversation}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <RotateCcw className="h-3 w-3" />
              {t("agent.newChat")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {isOpen ? t("agent.hideAssistant") : t("agent.openAssistant")}
          </button>
        </div>
      </div>

      {!isOpen && starterPrompts.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 bg-card">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("agent.quickActions")}
          </span>
          {starterPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSendPrompt(item.prompt)}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="p-4 space-y-3 bg-background/50">
          {starterPrompts.length > 0 && messages.length === 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                {t("agent.suggestedPrompts")}
              </div>
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isSending || isInitializing}
                    onClick={() => handleSendPrompt(item.prompt)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-card text-primary border border-primary/30 hover:bg-primary/10 transition-colors text-left disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorText && (
            <div className="p-2.5 rounded-md bg-destructive/15 border border-destructive/30 text-xs text-destructive">
              {errorText}
            </div>
          )}

          {messages.length > 0 && (
            <div
              ref={scrollContainerRef}
              className="max-h-80 overflow-y-auto space-y-2.5 pr-1"
            >
              {messages.map((msg, i) => (
                <AgentMessageBubble key={msg.id || i} message={msg} />
              ))}
              {isSending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{t("agent.analyzing")}</span>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt(input);
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={input}
              disabled={isSending || isInitializing}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-9 px-3 rounded-md border border-input bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending || isInitializing}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Send className="h-3.5 w-3.5" />
              {t("agent.send")}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}