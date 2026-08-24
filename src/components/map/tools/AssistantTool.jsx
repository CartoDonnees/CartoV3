"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useMapStore } from "@/stores/map-store";

const SUGGESTIONS = [
  "District le moins couvert",
  "Couverture 4G du Zanzan",
  "Population totale",
  "Meilleure couverture Orange",
];

export function AssistantTool() {
  const { map, setActiveTool, periodDate, operators, technologies } = useMapStore();
  const [messages, setMessages] = useState([
    { role: "bot", text: "Bonjour 👋 Posez une question sur la couverture réseau : districts, opérateurs, technologies, population…" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, operators, technologies, date: periodDate }),
      }).then((r) => r.json());
      const data = res?.data ?? { text: "Désolé, je n'ai pas compris." };
      setMessages((m) => [...m, { role: "bot", text: data.text }]);
      if (data.action && map) map.flyTo({ center: data.action.center, zoom: data.action.zoom, duration: 1400 });
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Service indisponible, réessayez." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  };

  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
      className="pointer-events-auto absolute right-3 top-[76px] z-30 flex h-[min(520px,70vh)] w-[340px] flex-col"
    >
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg brand-gradient text-white"><Sparkles size={15} /></span>
          <span className="text-sm font-bold">Assistant CARTODONNEES</span>
          <button onClick={() => setActiveTool(null)} className="ml-auto grid h-7 w-7 place-items-center rounded-lg hover:bg-surface-2"><X size={14} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-md brand-gradient px-3.5 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-bl-md bg-surface/70 px-3.5 py-2 text-sm"
                }
                dangerouslySetInnerHTML={{ __html: mdBold(m.text) }}
              />
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Analyse…</div>
          )}
        </div>

        <div className="border-t border-border/60 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Votre question…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <button onClick={() => ask()} disabled={loading} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg brand-gradient text-white disabled:opacity-50">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Convertit **gras** en <strong> (échappe le reste). */
function mdBold(text) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-artci-green-700">$1</strong>');
}
