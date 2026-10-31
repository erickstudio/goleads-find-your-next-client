import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { usePreferences } from "@/lib/PreferencesContext";

function FunctionDisplay({ toolCall }) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);

  const status = toolCall?.status || "pending";
  const isRunning = ["pending", "running", "in_progress"].includes(status);

  let parsedResults = toolCall?.results;
  if (typeof parsedResults === "string") {
    try {
      parsedResults = JSON.parse(parsedResults);
    } catch {
      // keep raw string
    }
  }

  const isFailed =
    status === "failed" ||
    status === "error" ||
    (typeof toolCall?.results === "string" && /error|failed/i.test(toolCall.results)) ||
    parsedResults?.success === false;

  const projection = toolCall?.display_projection;
  const hideDetails = Boolean(projection?.hide_details && projection?.details_redacted);

  const statusLabel = isRunning
    ? projection?.active_label || t("agent.runningTool", { name: toolCall?.name || "tool" })
    : isFailed
    ? projection?.error_label || t("agent.failedTool", { name: toolCall?.name || "tool" })
    : projection?.label || t("agent.checkedTool", { name: toolCall?.name || "data" });

  let parsedArgs = toolCall?.arguments_string;
  if (typeof parsedArgs === "string") {
    try {
      parsedArgs = JSON.parse(parsedArgs);
    } catch {
      // keep raw
    }
  }

  return (
    <div className="mt-2 rounded border border-border bg-secondary/60 px-2.5 py-1.5 text-[11px] text-foreground">
      <button
        type="button"
        onClick={() => !hideDetails && setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left font-medium"
      >
        <span className="inline-flex items-center gap-1.5">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : isFailed ? (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span>{statusLabel}</span>
        </span>
        {!hideDetails && (
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>

      {!hideDetails && expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-1.5 font-mono text-[10px] text-muted-foreground">
          {parsedArgs !== undefined && (
            <div>
              <div className="font-semibold text-foreground">{t("agent.parameters")}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {typeof parsedArgs === "string" ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <div className="font-semibold text-foreground">{t("agent.result")}</div>
              <pre className="max-h-40 overflow-y-auto overflow-x-auto whitespace-pre-wrap">
                {typeof parsedResults === "string"
                  ? parsedResults
                  : JSON.stringify(parsedResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentMessageBubble({ message }) {
  const isUser = message?.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-foreground"
        }`}
      >
        {message?.content &&
          (isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-xs max-w-none text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ))}

        {Array.isArray(message?.tool_calls) &&
          message.tool_calls.map((tc, idx) => <FunctionDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}