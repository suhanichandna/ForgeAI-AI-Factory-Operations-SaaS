"use client";

import { useState, useRef, useEffect } from "react";
import { apiPost } from "@/lib/client";
import { Card, PageHeader, Button, ErrorBanner } from "@/components/ui";

type ToolCall = { tool: string; args: Record<string, unknown>; result: unknown };
type Message = { role: "user" | "assistant"; text: string; toolTrace?: ToolCall[] };
type AssistantContext = { lastMaterialId?: string | null; lastMaterialName?: string | null };

const SUGGESTIONS = [
  "Give me a risk summary",
  "Check whether we need to buy Circuit Board",
  "Check machine health",
  "Create the purchase request",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "I'm the ForgeAI operations assistant. I answer through controlled tools — inventory, forecast, supplier and risk lookups — the same engine as the rest of the app. High-impact actions like approving a purchase still need a human on the Approvals page. Try one of the suggestions below, or ask about a specific material.",
    },
  ]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState<AssistantContext>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<{ reply: string; toolTrace: ToolCall[]; context: AssistantContext }>("/api/ai/assistant", { message: text, context });
      setMessages((m) => [...m, { role: "assistant", text: result.reply, toolTrace: result.toolTrace }]);
      setContext(result.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant failed to respond");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader title="AI Assistant" description="Natural-language operational queries via controlled tools (§13)." />
      {error && <ErrorBanner message={error} />}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                <p>{m.text}</p>
                {m.toolTrace && m.toolTrace.length > 0 && (
                  <details className="mt-2 text-xs opacity-70">
                    <summary className="cursor-pointer">Tool calls ({m.toolTrace.length})</summary>
                    <ul className="mt-1 space-y-1 font-mono">
                      {m.toolTrace.map((t, j) => (
                        <li key={j}>→ {t.tool}({Object.values(t.args).join(", ")})</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-slate-400">Thinking…</div>}
          <div ref={bottomRef} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory, forecasts, suppliers, machines…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <Button type="submit" disabled={loading}>
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
}
