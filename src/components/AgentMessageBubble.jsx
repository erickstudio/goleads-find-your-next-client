import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function FunctionDisplay({ toolCall }) {
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
    ? projection?.active_label || `Running ${toolCall?.name || "tool"}…`
    : isFailed
    ? projection?.error_label || `Failed ${toolCall?.name || "tool"}`
    : projection?.label || `Checked ${toolCall?.name || "data"}`;

  let parsedArgs = toolCall?.arguments_string;
  if (typeof parsedArgs === "string") {
    try {
      parsedArgs = JSON.parse(parsedArgs);
    } catch {
      // keep raw
    }
  }

  return (
    <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700">
      <button
        type="button"
        onClick={() => !hideDetails && setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left font-medium"
      >
        <span className="inline-flex items-center gap-1.5">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          ) : isFailed ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          <span>{statusLabel}</span>
        </span>
        {!hideDetails && (
          <span className="text-slate-400">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>

      {!hideDetails && expanded && (
        <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-1.5 font-mono text-[10px] text-slate-600">
          {parsedArgs !== undefined && (
            <div>
              <div className="font-semibold text-slate-700">Parameters:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {typeof parsedArgs === "string" ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}
              </pre>
            </div>
          )}
          {parsedResults !== undefined && (
            <div>
              <div className="font-semibold text-slate-700">Result:</div>
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
            ? "bg-blue-600 text-white"
            : "bg-white border border-slate-200 text-slate-800"
        }`}
      >
        {message?.content &&
          (isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-xs max-w-none text-slate-800 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ))}

        {Array.isArray(message?.tool_calls) &&
          message.tool_calls.map((tc, idx) => <FunctionDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}