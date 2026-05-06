import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

type Page = "home" | "chat" | "docs" | "about" | "admin";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens: number;
  timestamp: Date;
  attachments?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const LOGO_URL =
  "https://cdn.poehali.dev/projects/8a4d2a14-ee20-46d1-b541-1aa2658b7e31/bucket/6e6ff456-2077-493f-8813-224ed69f6d4a.jpg";
const DAILY_LIMIT = 256;

function getMsUntilMidnightMsk(): number {
  const now = new Date();
  const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const next = new Date(msk);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - msk.getTime();
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CODE_KW = [
  "напиши код","покажи код","пример кода","функцию","скрипт",
  "код на","реализуй","создай функцию","write code","пример на",
];
function detectCode(t: string) { return CODE_KW.some(k => t.toLowerCase().includes(k)); }
function detectLang(t: string) {
  if (/python/i.test(t)) return "python";
  if (/typescript|\.ts/i.test(t)) return "typescript";
  if (/javascript|\.js/i.test(t)) return "javascript";
  if (/sql/i.test(t)) return "sql";
  if (/bash|shell/i.test(t)) return "bash";
  return "python";
}

const EXAMPLES: Record<string, string> = {
  python: `def process(items: list[dict]) -> dict:
    result: dict[str, int] = {}
    for item in items:
        key = item.get("type", "unknown")
        result[key] = result.get(key, 0) + item.get("value", 0)
    return result`,
  typescript: `async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}`,
  javascript: `async function fetchRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await (await fetch(url)).json(); }
    catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}`,
  sql: `SELECT user_id,
  SUM(tokens) OVER (PARTITION BY user_id ORDER BY created_at) AS cumulative
FROM sessions
WHERE created_at >= NOW() - INTERVAL '30 days';`,
  bash: `#!/bin/bash
SERVICE="oxiwis-api"
while true; do
  systemctl is-active --quiet "$SERVICE" || systemctl restart "$SERVICE"
  sleep 30
done`,
};

function generateReply(msg: string): string {
  if (detectCode(msg)) {
    const lang = detectLang(msg);
    return `Вот пример на **${lang}**:\n\`\`\`${lang}\n${EXAMPLES[lang] ?? EXAMPLES.python}\n\`\`\``;
  }
  const r = [
    "Понял ваш запрос. Чем ещё могу помочь?",
    "Ответ готов. Если нужны детали — спросите.",
    "Обработано. Хотите продолжить эту тему?",
    "Готово. Могу предоставить больше информации по запросу.",
  ];
  return r[Math.floor(Math.random() * r.length)];
}

// ── Code block ────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-black/50 mt-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-xs font-mono text-white/30">{lang}</span>
        <button onClick={copy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono
            bg-white/[0.04] border border-white/[0.08] text-white/40
            hover:bg-white/[0.08] hover:text-white/70 transition-all duration-200">
          <Icon name={copied ? "Check" : "Copy"} size={10} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-white/70 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function RenderContent({ text }: { text: string }) {
  const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", content: m[2], lang: m[1] ?? "code" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.type === "code"
          ? <CodeBlock key={i} code={p.content} lang={p.lang ?? "code"} />
          : <span key={i} className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: p.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90">$1</strong>')
                  .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-black/40 px-1 py-0.5 rounded text-white/55">$1</code>')
              }} />
      )}
    </>
  );
}

// ── Bubble ────────────────────────────────────────────────────────────────
function Bubble({ msg, show }: { msg: Message; show: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex gap-3 transition-all duration-500 ${isUser ? "flex-row-reverse" : ""}
        ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      {!isUser && (
        <img src={LOGO_URL} alt="AI"
          className="w-8 h-8 rounded-xl object-contain flex-shrink-0 mt-0.5 opacity-80" />
      )}
      <div className={`max-w-[78%] sm:max-w-[70%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-white/[0.09] border border-white/[0.1] rounded-tr-sm text-white/80"
            : "bg-white/[0.04] border border-white/[0.07] rounded-tl-sm text-white/75"
          }`}>
          <RenderContent text={msg.content} />
          {msg.attachments?.map((a, i) => (
            <div key={i} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
              <Icon name="Paperclip" size={12} className="text-white/40" />
              <span className="text-xs text-white/40 truncate max-w-[160px]">{a}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-white/20 font-mono px-1">
          {msg.timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────
function Typing() {
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <img src={LOGO_URL} alt="AI" className="w-8 h-8 rounded-xl object-contain flex-shrink-0 mt-0.5 opacity-80" />
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 0.2, 0.4].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
              style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT PAGE
// ═══════════════════════════════════════════════════════════════════════════
function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: "1", title: "Новый диалог", messages: [], createdAt: new Date() },
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [requestsLeft, setRequestsLeft] = useState(256);
  const [countdown, setCountdown] = useState(getMsUntilMidnightMsk());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [visibleMsgs, setVisibleMsgs] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const active = sessions.find(s => s.id === activeId)!;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, typing]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(getMsUntilMidnightMsk());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // animate new messages
  useEffect(() => {
    if (!active) return;
    const ids = active.messages.map(m => m.id);
    const newIds = ids.filter(id => !visibleMsgs.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id, i) => {
      setTimeout(() => {
        setVisibleMsgs(prev => new Set([...prev, id]));
      }, i * 60);
    });
  }, [active?.messages.length]);

  const send = useCallback(() => {
    if (!input.trim() && attachments.length === 0) return;
    if (typing || requestsLeft <= 0) return;

    const tok = Math.ceil((input.length + attachments.join("").length) / 4);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || (attachments.length > 0 ? "📎 Прикреплённые файлы" : ""),
      tokens: tok,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setSessions(prev => prev.map(s =>
      s.id === activeId
        ? {
            ...s,
            messages: [...s.messages, userMsg],
            title: s.messages.length === 0 ? (input.slice(0, 36) || "Вложения") : s.title,
          }
        : s,
    ));
    setRequestsLeft(r => r - 1);
    setInput("");
    setAttachments([]);
    if (textRef.current) { textRef.current.style.height = "auto"; }
    setTyping(true);

    const currentSession = sessions.find(s => s.id === activeId);
    const history = [
      ...(currentSession?.messages ?? []).map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMsg.content },
    ];

    fetch("https://jpdwcpxlotztzrqcgfeg.supabase.co/functions/v1/v1-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer ypr_OBqnJxMDLkBWn3IztUOX6dcuW8hH3AfeUHrOAku7X3k",
      },
      body: JSON.stringify({ messages: history }),
    })
      .then(async res => {
        const data = await res.json();
        const content: string =
          data?.choices?.[0]?.message?.content ??
          data?.message ??
          data?.content ??
          data?.reply ??
          data?.text ??
          JSON.stringify(data);
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content,
          tokens: Math.ceil(content.length / 4),
          timestamp: new Date(),
        };
        setSessions(prev => prev.map(s =>
          s.id === activeId ? { ...s, messages: [...s.messages, aiMsg] } : s,
        ));
      })
      .catch(() => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ошибка соединения с сервером. Попробуйте ещё раз.",
          tokens: 10,
          timestamp: new Date(),
        };
        setSessions(prev => prev.map(s =>
          s.id === activeId ? { ...s, messages: [...s.messages, aiMsg] } : s,
        ));
      })
      .finally(() => {
        setTyping(false);
      });
  }, [input, attachments, typing, requestsLeft, activeId, sessions]);

  const newSession = () => {
    const id = Date.now().toString();
    setSessions(prev => [...prev, { id, title: "Новый диалог", messages: [], createdAt: new Date() }]);
    setActiveId(id);
    setSidebarOpen(false);
  };

  const switchSession = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments(prev => [...prev, ...files.map(f => f.name)]);
    e.target.value = "";
  };

  const removeAttachment = (name: string) => {
    setAttachments(prev => prev.filter(a => a !== name));
  };

  const pct = Math.round((requestsLeft / DAILY_LIMIT) * 100);

  return (
    <div className="flex h-[calc(100dvh-56px)] relative overflow-hidden">
      {/* ── Sidebar overlay (mobile) ───────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`
        absolute lg:relative z-40 h-full w-72 flex flex-col
        border-r border-white/[0.06] bg-[#0a0a0a]
        transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)]
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
          <button onClick={newSession}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm
              bg-white/[0.05] border border-white/[0.08] text-white/55
              hover:bg-white/[0.09] hover:text-white/80 transition-all duration-200">
            <Icon name="Plus" size={14} />
            Новый диалог
          </button>
          <button onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30
              hover:text-white/60 hover:bg-white/[0.05] transition-all lg:hidden">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.map(s => (
            <button key={s.id} onClick={() => switchSession(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${s.id === activeId
                  ? "bg-white/[0.08] border border-white/[0.1] text-white/80"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white/65"
                }`}>
              <div className="flex items-center gap-2 mb-0.5">
                <Icon name="MessageSquare" size={12} className="flex-shrink-0" />
                <span className="truncate text-xs font-medium">{s.title}</span>
              </div>
              <p className="text-[10px] text-white/20 pl-[18px]">
                {s.messages.length} сообщ.
              </p>
            </button>
          ))}
        </div>

        {/* quota */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex justify-between text-[10px] font-mono text-white/30 mb-1.5">
            <span>Запросы сегодня</span>
            <span>{requestsLeft} / {DAILY_LIMIT}</span>
          </div>
          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full bg-white/40 transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-white/20">
            <span>Сброс 00:00 МСК</span>
            <span>{formatCountdown(countdown)}</span>
          </div>
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080808]">
        {/* top bar */}
        <div className="h-12 border-b border-white/[0.05] flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/35
              hover:text-white/65 hover:bg-white/[0.05] transition-all lg:hidden">
            <Icon name="PanelLeft" size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img src={LOGO_URL} alt="AI" className="w-5 h-5 rounded-md object-contain opacity-70" />
            <span className="text-sm font-medium text-white/60 truncate">{active?.title ?? "Диалог"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/35 animate-pulse" />
            <span className="text-[10px] font-mono text-white/25">OxiwisAI</span>
          </div>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {active?.messages.length === 0 && !typing && (
            <div className="flex flex-col items-center justify-center h-full text-center
              animate-in fade-in slide-in-from-bottom-4 duration-500">
              <img src={LOGO_URL} alt="OxiwisAI"
                className="w-12 h-12 object-contain mb-5 opacity-25" />
              <p className="text-white/30 text-base font-medium mb-1">Чем могу помочь?</p>
              <p className="text-white/15 text-sm max-w-xs mb-8">
                Задайте любой вопрос или прикрепите файл
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {["Сгенерируй изображение заката над горами", "Реши задачу: поезд едет 120 км/ч, расстояние 360 км — сколько времени?", "Напиши код парсера RSS на JavaScript"].map(h => (
                  <button key={h} onClick={() => { setInput(h); textRef.current?.focus(); }}
                    className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.07]
                      bg-white/[0.03] text-white/40 text-sm hover:bg-white/[0.06] hover:text-white/60
                      hover:border-white/[0.12] transition-all duration-200">
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {active?.messages.map(msg => (
            <Bubble key={msg.id} msg={msg} show={visibleMsgs.has(msg.id)} />
          ))}
          {typing && <Typing />}
          <div ref={bottomRef} />
        </div>

        {/* attachments preview */}
        {attachments.length > 0 && (
          <div className="px-4 pb-1 flex gap-2 flex-wrap animate-in slide-in-from-bottom-2 duration-200">
            {attachments.map(a => (
              <div key={a}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.09]">
                <Icon name="Paperclip" size={11} className="text-white/40" />
                <span className="text-xs text-white/50 max-w-[120px] truncate">{a}</span>
                <button onClick={() => removeAttachment(a)} className="text-white/25 hover:text-white/55 transition-colors ml-0.5">
                  <Icon name="X" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* input */}
        <div className="p-3 border-t border-white/[0.05] flex-shrink-0">
          {requestsLeft === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center">
              <p className="text-xs text-white/30 font-mono">
                Лимит исчерпан · сброс через {formatCountdown(countdown)}
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.04]
              px-3 py-2 focus-within:border-white/[0.18] transition-all duration-200">
              {/* attach */}
              <button onClick={() => fileRef.current?.click()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30
                  hover:text-white/60 hover:bg-white/[0.06] transition-all duration-200 flex-shrink-0 mb-0.5">
                <Icon name="Paperclip" size={16} />
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFile} />

              {/* textarea */}
              <textarea
                ref={textRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Сообщение…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/20 resize-none
                  focus:outline-none py-1 leading-relaxed"
                style={{ minHeight: "36px", maxHeight: "160px" }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 160) + "px";
                }}
              />

              {/* send */}
              <button onClick={send}
                disabled={!input.trim() && attachments.length === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mb-0.5
                  bg-white/[0.08] border border-white/[0.1] text-white/50
                  hover:bg-white/[0.15] hover:text-white/85 hover:border-white/[0.2]
                  disabled:opacity-25 disabled:cursor-not-allowed
                  transition-all duration-200">
                <Icon name="ArrowUp" size={15} />
              </button>
            </div>
          )}
          <p className="text-[10px] text-white/15 font-mono text-center mt-2">
            {requestsLeft} запросов · сброс в 00:00 МСК
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════
function HomePage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const features = [
    { icon: "Code2",         title: "Генерация кода",    desc: "Python, TypeScript, SQL и другие языки с подсветкой и копированием" },
    { icon: "MessageSquare", title: "История диалогов",  desc: "Контекст сохраняется между сессиями" },
    { icon: "Paperclip",     title: "Вложения",          desc: "Отправляйте файлы и изображения прямо в чат" },
    { icon: "Shield",        title: "Безопасность",      desc: "Ваши данные защищены и не используются для обучения" },
    { icon: "Zap",           title: "256 запросов/день", desc: "Сброс в 00:00 по московскому времени" },
    { icon: "Globe",         title: "120+ языков",       desc: "Поддержка русского, английского и других языков" },
  ];

  return (
    <div className="min-h-screen">
      {/* hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* bg glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-3xl" />
        </div>

        {/* grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }} />

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          {/* logo */}
          <div className="flex justify-center mb-8
            animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative">
              <img src={LOGO_URL} alt="OxiwisAI"
                className="w-20 h-20 object-contain"
                style={{ filter: "drop-shadow(0 0 20px rgba(180,210,255,0.5)) drop-shadow(0 0 60px rgba(140,180,255,0.15))" }} />
            </div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-4 font-golos
            animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #c8d8f0 50%, #fff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            OxiwisAI
          </h1>

          <p className="text-sm font-mono text-white/25 tracking-widest uppercase mb-6
            animate-in fade-in duration-700 delay-150">
            by Oxiwis · 1 Trillion+ Parameters
          </p>

          <p className="text-white/40 text-lg leading-relaxed mb-10 max-w-md mx-auto
            animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
            Языковая модель нового поколения. Генерация кода, анализ данных, работа с файлами.
          </p>

          <div className="flex gap-3 justify-center flex-wrap
            animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
            <button onClick={() => onNavigate("chat")}
              className="px-7 py-3 rounded-xl font-medium text-sm bg-white/90 text-black
                hover:bg-white transition-all duration-200 hover:-translate-y-0.5
                hover:shadow-[0_8px_30px_rgba(255,255,255,0.1)]">
              Начать чат
            </button>
            <button onClick={() => onNavigate("docs")}
              className="px-7 py-3 rounded-xl font-medium text-sm text-white/55 border border-white/[0.12]
                hover:text-white/80 hover:border-white/[0.22] hover:bg-white/[0.04] transition-all duration-200">
              Документация
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2
          animate-in fade-in duration-700 delay-500">
          <Icon name="ChevronDown" size={18} className="text-white/15 animate-bounce" />
        </div>
      </section>

      {/* stats */}
      <section className="py-14 px-6 border-y border-white/[0.05]">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { v: "1T+",   l: "Параметров" },
            { v: "200K",  l: "Токенов контекст" },
            { v: "256",   l: "Запросов в день" },
            { v: "96.2%", l: "Точность MMLU" },
          ].map((s, i) => (
            <div key={s.l} className="animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white/80 mb-1">{s.v}</div>
              <div className="text-xs text-white/30">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white/60 text-center mb-10 font-golos">Возможности</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title}
                className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                  hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300
                  animate-in fade-in slide-in-from-bottom-2 duration-500 cursor-default"
                style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07]
                  flex items-center justify-center mb-3">
                  <Icon name={f.icon} size={15} className="text-white/45" />
                </div>
                <h3 className="text-sm font-semibold text-white/65 mb-1">{f.title}</h3>
                <p className="text-xs text-white/30 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="py-16 px-6 border-t border-white/[0.05] text-center">
        <img src={LOGO_URL} alt="OxiwisAI" className="w-10 h-10 object-contain mx-auto mb-5 opacity-30" />
        <h2 className="text-xl font-bold text-white/60 mb-2 font-golos">Готовы начать?</h2>
        <p className="text-white/25 text-sm mb-7">256 запросов в сутки · сброс в 00:00 МСК</p>
        <button onClick={() => onNavigate("chat")}
          className="px-8 py-3 rounded-xl font-medium text-sm bg-white/90 text-black
            hover:bg-white transition-all duration-200 hover:-translate-y-0.5">
          Открыть чат
        </button>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCS PAGE
// ═══════════════════════════════════════════════════════════════════════════
function DocsPage() {
  const [active, setActive] = useState("quickstart");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const sections = [
    { id: "quickstart", label: "Быстрый старт", icon: "Zap" },
    { id: "auth",       label: "Аутентификация", icon: "Key" },
    { id: "chat",       label: "Chat API",        icon: "MessageSquare" },
    { id: "models",     label: "Модели",          icon: "Cpu" },
    { id: "limits",     label: "Лимиты",          icon: "BarChart3" },
    { id: "errors",     label: "Ошибки",          icon: "AlertTriangle" },
  ];

  const snippets: Record<string, { title: string; lang: string; code: string }[]> = {
    quickstart: [
      { title: "Установка", lang: "bash", code: `pip install oxiwis-sdk\n# или\nnpm install @oxiwis/sdk` },
      { title: "Первый запрос", lang: "python", code: `from oxiwis import OxiwisClient\n\nclient = OxiwisClient(api_key="your-key")\nresponse = client.chat.complete(\n    model="oxiwis-1t",\n    messages=[{"role": "user", "content": "Привет!"}]\n)\nprint(response.content)` },
    ],
    auth: [
      { title: "HTTP заголовок", lang: "bash", code: `curl https://api.oxiwis.ai/v1/chat/complete \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"oxiwis-1t","messages":[{"role":"user","content":"Hello"}]}'` },
    ],
    chat: [
      { title: "Стриминг", lang: "python", code: `stream = client.chat.stream(\n    model="oxiwis-1t",\n    messages=[{"role":"user","content":"Расскажи о квантовых вычислениях"}],\n)\nfor chunk in stream:\n    print(chunk.delta, end="", flush=True)` },
      { title: "JavaScript", lang: "javascript", code: `const res = await fetch('https://api.oxiwis.ai/v1/chat/complete', {\n  method: 'POST',\n  headers: { 'Authorization': \`Bearer \${key}\`, 'Content-Type': 'application/json' },\n  body: JSON.stringify({ model: 'oxiwis-1t', messages: [{role:'user',content:'Hello'}] }),\n});\nconst { choices } = await res.json();\nconsole.log(choices[0].message.content);` },
    ],
    models: [
      { title: "Доступные модели", lang: "python", code: `# oxiwis-1t       — 1T параметров, контекст 200K\n# oxiwis-1t-fast  — 1T параметров, скоростная версия\n# oxiwis-70b      — 70B параметров, лёгкая версия\n\nmodels = client.models.list()\nfor m in models:\n    print(f"{m.id}: {m.context_length} tokens")` },
    ],
    limits: [
      { title: "Лимиты запросов", lang: "python", code: `# 256 запросов в сутки на пользователя\n# Сброс в 00:00 по московскому времени (UTC+3)\n\ninfo = client.account.limits()\nprint(f"Осталось: {info.requests_left} / {info.requests_limit}")\nprint(f"Сброс: {info.reset_at_msk}")` },
    ],
    errors: [
      { title: "Обработка ошибок", lang: "python", code: `from oxiwis.exceptions import DailyLimitError, RateLimitError, AuthError\n\ntry:\n    response = client.chat.complete(model="oxiwis-1t", messages=[...])\nexcept DailyLimitError:\n    print("Суточный лимит исчерпан. Сброс в 00:00 МСК")\nexcept RateLimitError as e:\n    print(f"Слишком часто. Подождите {e.retry_after}s")\nexcept AuthError:\n    print("Неверный API-ключ")` },
    ],
  };

  const current = snippets[active] ?? [];

  return (
    <div className="flex h-[calc(100dvh-56px)]">
      {/* sidebar */}
      <aside className="w-48 sm:w-52 border-r border-white/[0.05] bg-[#0a0a0a] p-3 flex-shrink-0 overflow-y-auto">
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-3 px-1">Разделы</p>
        <nav className="space-y-0.5">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all duration-200
                ${active === s.id
                  ? "bg-white/[0.07] border border-white/[0.1] text-white/75"
                  : "text-white/30 hover:text-white/55 hover:bg-white/[0.04]"
                }`}>
              <Icon name={s.icon} size={12} />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-white/70 font-golos mb-1">
            {sections.find(s => s.id === active)?.label}
          </h1>
          <p className="text-xs text-white/20 font-mono mb-8">OxiwisAI API · v1.0</p>

          <div className="space-y-8">
            {current.map((sn, i) => (
              <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${i * 80}ms` }}>
                <h3 className="text-xs font-medium text-white/40 mb-3 flex items-center gap-1.5">
                  <Icon name="ChevronRight" size={11} className="text-white/20" />
                  {sn.title}
                </h3>
                <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-black/40">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                    <span className="font-mono text-[10px] text-white/25">{sn.lang}</span>
                    <button onClick={() => copy(sn.code, `${active}-${i}`)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono transition-all duration-200
                        bg-white/[0.04] border border-white/[0.07] text-white/35
                        hover:bg-white/[0.08] hover:text-white/65 hover:border-white/[0.14]">
                      <Icon name={copiedId === `${active}-${i}` ? "Check" : "Copy"} size={9} />
                      {copiedId === `${active}-${i}` ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <pre className="p-4 text-xs sm:text-sm font-mono text-white/60 overflow-x-auto leading-relaxed">
                    <code>{sn.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABOUT PAGE
// ═══════════════════════════════════════════════════════════════════════════
function AboutPage() {
  const specs = [
    ["Компания",         "Oxiwis"],
    ["Модель",           "OxiwisAI 1T"],
    ["Архитектура",      "MoE Transformer"],
    ["Параметры",        "1 000 000 000 000+"],
    ["Контекст",         "200 000 токенов"],
    ["Обучающие данные", "8T токенов"],
    ["Языков",           "120+"],
    ["Лимит",            "256 запросов/сутки"],
    ["Сброс лимита",     "00:00 МСК"],
    ["Точность MMLU",    "96.2%"],
    ["Задержка p50",     "~0.9 сек"],
    ["Релиз",            "2026"],
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <img src={LOGO_URL} alt="OxiwisAI"
          className="w-12 h-12 object-contain opacity-75"
          style={{ filter: "drop-shadow(0 0 12px rgba(180,210,255,0.4))" }} />
        <div>
          <h1 className="text-2xl font-black font-golos"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#c8d8f0 50%,#fff 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>OxiwisAI</h1>
          <p className="text-xs font-mono text-white/25 mt-0.5">by Oxiwis · 1T+ Parameters</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 mb-5
        animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
        <h2 className="text-xs font-semibold text-white/40 mb-4 flex items-center gap-2">
          <Icon name="Settings" size={12} className="text-white/25" />
          Характеристики
        </h2>
        {specs.map(([l, v], i) => (
          <div key={l} className={`flex justify-between items-center py-2.5 ${i < specs.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
            <span className="text-xs text-white/30">{l}</span>
            <span className="text-xs font-mono text-white/60">{v}</span>
          </div>
        ))}
      </div>

      {/* comparison */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5
        animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <h2 className="text-xs font-semibold text-white/40 mb-4 flex items-center gap-2">
          <Icon name="BarChart3" size={12} className="text-white/25" />
          Линейка моделей
        </h2>
        {[
          { model: "OxiwisAI 1T",      ctx: "200K", q: 96, s: 87, cur: true },
          { model: "OxiwisAI 1T-Fast", ctx: "64K",  q: 90, s: 100, cur: false },
          { model: "OxiwisAI 70B",     ctx: "32K",  q: 82, s: 100, cur: false },
        ].map(c => (
          <div key={c.model} className={`p-3.5 rounded-xl border mb-2 last:mb-0 ${c.cur ? "border-white/[0.12] bg-white/[0.03]" : "border-white/[0.05]"}`}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/65">{c.model}</span>
                {c.cur && <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/[0.1] text-white/30 font-mono">current</span>}
              </div>
              <span className="text-[10px] font-mono text-white/25">{c.ctx}</span>
            </div>
            {[{ l: "Качество", v: c.q }, { l: "Скорость", v: c.s }].map(b => (
              <div key={b.l} className="mb-1.5 last:mb-0">
                <div className="flex justify-between text-[10px] text-white/20 mb-1 font-mono">
                  <span>{b.l}</span><span>{b.v}%</span>
                </div>
                <div className="h-0.5 bg-white/[0.05] rounded-full">
                  <div className="h-full rounded-full bg-white/30 transition-all duration-700"
                    style={{ width: `${b.v}%` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
function AdminPage() {
  const [tab, setTab] = useState<"overview" | "users" | "models" | "limits">("overview");

  const tabs = [
    { id: "overview", label: "Обзор",       icon: "LayoutDashboard" },
    { id: "users",    label: "Пользователи", icon: "Users" },
    { id: "models",   label: "Модели",       icon: "Cpu" },
    { id: "limits",   label: "Лимиты",       icon: "BarChart3" },
  ];

  const kpis = [
    { l: "Активных пользователей", v: "3 241",   icon: "Users" },
    { l: "Запросов сегодня",       v: "187 442", icon: "Zap" },
    { l: "Токенов обработано",     v: "62.1M",   icon: "BarChart3" },
    { l: "Uptime",                 v: "99.98%",  icon: "Shield" },
  ];

  const users = [
    { id: "usr_001", email: "admin@oxiwis.ai",   role: "Администратор", req: 0,   status: "active" },
    { id: "usr_002", email: "dev@company.ru",     role: "Разработчик",  req: 84,  status: "active" },
    { id: "usr_003", email: "user@example.com",   role: "Пользователь", req: 201, status: "active" },
    { id: "usr_004", email: "banned@example.com", role: "Пользователь", req: 256, status: "suspended" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-lg font-bold text-white/70 font-golos">Панель администратора</h1>
          <p className="text-xs text-white/20 font-mono mt-0.5">OxiwisAI Management</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02]">
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
          <span className="text-[10px] font-mono text-white/30">все системы в норме</span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-0.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${tab === t.id ? "bg-white/[0.08] border border-white/[0.1] text-white/75" : "text-white/30 hover:text-white/55"}`}>
            <Icon name={t.icon} size={11} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.l} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <Icon name={k.icon} size={14} className="text-white/25 mb-2" />
                <div className="text-lg font-black font-mono text-white/80 mb-0.5">{k.v}</div>
                <div className="text-[10px] text-white/25">{k.l}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-xs font-semibold text-white/40 mb-4 flex items-center gap-1.5">
              <Icon name="Activity" size={12} className="text-white/25" />
              Последние события
            </h3>
            {[
              { time: "14:32", text: "Новый пользователь зарегистрирован" },
              { time: "13:58", text: "Суточный лимит исчерпан — usr_089" },
              { time: "12:21", text: "Обновление модели OxiwisAI 1T → v1.0.4" },
              { time: "09:44", text: "API-ключ отозван — usr_042" },
            ].map((a, i) => (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i < 3 ? "border-b border-white/[0.04]" : ""}`}>
                <span className="font-mono text-[10px] text-white/20 w-10">{a.time}</span>
                <div className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0" />
                <span className="text-xs text-white/35">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-in fade-in duration-300">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
            <span className="text-xs font-semibold text-white/50">Пользователи ({users.length})</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium
              bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/65 transition-colors">
              <Icon name="Plus" size={10} />Добавить
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Email", "Роль", "Запросов", "Статус"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-white/20 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/55">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-white/30">{u.role}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white/45">{u.req} / 256</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                        u.status === "active"
                          ? "bg-white/[0.04] border-white/[0.09] text-white/45"
                          : "bg-white/[0.02] border-white/[0.05] text-white/20"
                      }`}>{u.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "models" && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {[
            { id: "oxiwis-1t",      status: "active",     req: "141 291", lat: "0.9s", params: "1T+" },
            { id: "oxiwis-1t-fast", status: "active",     req: "43 821",  lat: "0.3s", params: "1T+" },
            { id: "oxiwis-70b",     status: "deprecated", req: "2 330",   lat: "0.5s", params: "70B" },
          ].map(m => (
            <div key={m.id} className={`rounded-2xl border p-4 ${m.status === "active" ? "border-white/[0.1] bg-white/[0.03]" : "border-white/[0.05] bg-white/[0.01]"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white/65">{m.id}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono
                    ${m.status === "active" ? "border-white/[0.12] text-white/40" : "border-white/[0.06] text-white/20"}`}>
                    {m.status}
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] font-mono text-white/25">
                  <span>{m.req} req</span>
                  <span>{m.lat}</span>
                  <span>{m.params}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "limits" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-xs font-semibold text-white/40 mb-5 flex items-center gap-1.5">
              <Icon name="BarChart3" size={12} className="text-white/25" />
              Запросы — последние 7 дней
            </h3>
            <div className="flex items-end gap-1.5 h-28">
              {[58, 72, 41, 89, 81, 69, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-sm bg-white/[0.06] transition-all duration-700"
                    style={{ height: `${h}%` }} />
                  <span className="text-[9px] font-mono text-white/20">
                    {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {[
              { l: "Запросов в сутки", v: "256" },
              { l: "Временная зона", v: "Europe/Moscow (UTC+3)" },
              { l: "Время сброса", v: "00:00 МСК" },
            ].map((r, i) => (
              <div key={r.l} className={`flex justify-between items-center py-3 ${i < 2 ? "border-b border-white/[0.04]" : ""}`}>
                <span className="text-xs text-white/35">{r.l}</span>
                <span className="text-xs font-mono text-white/60">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════════════════
const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "home",  label: "Главная",      icon: "Home" },
  { id: "chat",  label: "Чат",          icon: "MessageSquare" },
  { id: "docs",  label: "Документация", icon: "Book" },
  { id: "about", label: "О модели",     icon: "Cpu" },
  { id: "admin", label: "Админ",        icon: "Settings" },
];

export default function Index() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="min-h-screen bg-[#080808] text-white font-golos">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/[0.06]
        bg-[#080808]/80 backdrop-blur-2xl">
        <div className="flex items-center h-full px-4 sm:px-6 max-w-screen-2xl mx-auto gap-4">
          {/* logo */}
          <button onClick={() => setPage("home")}
            className="flex items-center gap-2 flex-shrink-0 group">
            <img src={LOGO_URL} alt="OxiwisAI"
              className="w-7 h-7 object-contain opacity-75 group-hover:opacity-100 transition-opacity duration-200"
              style={{ filter: "drop-shadow(0 0 8px rgba(180,210,255,0.4))" }} />
            <span className="font-black font-mono text-sm text-white/75 group-hover:text-white/95 transition-colors duration-200">
              Oxiwis<span className="text-white/30">AI</span>
            </span>
          </button>

          {/* nav */}
          <nav className="flex items-center gap-0.5 flex-1">
            {NAV.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${page === item.id
                    ? "text-white/80 bg-white/[0.07] border border-white/[0.09]"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                  }`}>
                <Icon name={item.icon} size={12} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* status */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg
              bg-white/[0.03] border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-white/35 animate-pulse" />
              <span className="text-[10px] font-mono text-white/25">online</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.09]
              flex items-center justify-center">
              <Icon name="User" size={13} className="text-white/35" />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-14">
        {page === "home"  && <HomePage onNavigate={setPage} />}
        {page === "chat"  && <ChatPage />}
        {page === "docs"  && <DocsPage />}
        {page === "about" && <AboutPage />}
        {page === "admin" && <AdminPage />}
      </main>
    </div>
  );
}