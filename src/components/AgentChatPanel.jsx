import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Send, RotateCcw, Loader2 } from "lucide-react";
import AgentMessageBubble from "@/components/AgentMessageBubble";

export default function AgentChatPanel({
  agentName,
  title,
  subtitle,
  badgeLabel = "AI Agent",
  conversationTitle,
  starterPrompts = [],
  contextPreamble = "",
  placeholder = "Ask the agent…",
  defaultOpen = false,
}) {
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
    <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 border-b border-slate-200">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="h-3 w-3" />
              {badgeLabel}
            </span>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetConversation}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isOpen ? "Hide assistant" : "Open assistant"}
          </button>
        </div>
      </div>

      {!isOpen && starterPrompts.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 bg-white">
          <span className="text-[11px] font-medium text-slate-500">Quick actions:</span>
          {starterPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSendPrompt(item.prompt)}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50/70 text-blue-800 border border-blue-200 hover:bg-blue-100/80 transition-colors text-left"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="p-4 space-y-3 bg-slate-50/40">
          {starterPrompts.length > 0 && messages.length === 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">
                Suggested prompts:
              </div>
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isSending || isInitializing}
                    onClick={() => handleSendPrompt(item.prompt)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorText && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-900">
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
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>Agent is analyzing…</span>
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
              className="flex-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending || isInitializing}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </form>
        </div>
      )}
    </section>
  );
}