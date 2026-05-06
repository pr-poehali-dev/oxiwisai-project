import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

type Page = "home" | "chat" | "docs" | "about" | "admin";

// ─── ТИПЫ ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens: number;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ─── УТИЛИТЫ ───────────────────────────────────────────────────────────────

const LOGO_URL = "https://cdn.poehali.dev/projects/8a4d2a14-ee20-46d1-b541-1aa2658b7e31/bucket/6e6ff456-2077-493f-8813-224ed69f6d4a.jpg";
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

const CODE_KEYWORDS = [
  "напиши код", "покажи код", "пример кода", "функцию", "скрипт",
  "написать функцию", "код на", "реализуй", "создай функцию",
  "write code", "code example", "пример на",
];

function detectCode(text: string) {
  return CODE_KEYWORDS.some(k => text.toLowerCase().includes(k));
}

function detectLang(text: string) {
  if (/python/i.test(text)) return "python";
  if (/typescript|\.ts/i.test(text)) return "typescript";
  if (/javascript|\.js/i.test(text)) return "javascript";
  if (/sql/i.test(text)) return "sql";
  if (/bash|shell/i.test(text)) return "bash";
  return "python";
}

const CODE_EXAMPLES: Record<string, string> = {
  python: `def process_data(items: list[dict]) -> dict:
    """Обработка и агрегация данных."""
    result: dict[str, int] = {}
    for item in items:
        key = item.get("type", "unknown")
        result[key] = result.get(key, 0) + item.get("value", 0)
    return result

# Использование
data = [{"type": "alpha", "value": 42}, {"type": "beta", "value": 17}]
print(process_data(data))  # {'alpha': 42, 'beta': 17}`,

  typescript: `interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function apiCall<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  return res.json();
}`,

  javascript: `async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}`,

  sql: `SELECT
  user_id,
  SUM(tokens_used) OVER (
    PARTITION BY user_id
    ORDER BY created_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_tokens,
  AVG(tokens_used) OVER (
    PARTITION BY user_id
    ORDER BY created_at
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7d
FROM api_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY user_id, created_at;`,

  bash: `#!/bin/bash
SERVICE="oxiwis-api"
MAX=3; count=0

check() {
  systemctl is-active --quiet "$SERVICE" && return 0
  echo "[$(date)] Restarting $SERVICE..." >> /var/log/oxiwis.log
  systemctl restart "$SERVICE"
  ((count++))
}

while true; do
  check
  [ $count -ge $MAX ] && { echo "Max restarts hit"; break; }
  sleep 30
done`,
};

function generateReply(userMsg: string): { content: string } {
  if (detectCode(userMsg)) {
    const lang = detectLang(userMsg);
    const code = CODE_EXAMPLES[lang] ?? CODE_EXAMPLES.python;
    return {
      content: `Конечно, вот пример на **${lang}**:\n\`\`\`${lang}\n${code}\n\`\`\`\nЕсли нужны пояснения или доработка — скажи.`,
    };
  }
  const replies = [
    "OxiwisAI обработал запрос. Модель использует архитектуру MoE с триллионом параметров и контекстным окном 200k токенов.",
    "Запрос принят. OxiwisAI работает на кластере Oxiwis с пиковой производительностью 10 экзафлопс.",
    "Ответ сформирован. Точность модели на этой задаче — 96.2%. Хотите детализировать?",
    "Задача выполнена. OxiwisAI оптимизирован для сложных рассуждений, кода и многоязычных задач.",
  ];
  return { content: replies[Math.floor(Math.random() * replies.length)] };
}

// ─── КОМПОНЕНТ: БЛОК КОДА ─────────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block mt-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.07] bg-black/30">
        <span className="font-mono text-xs text-white/35">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all
            bg-white/[0.05] border border-white/[0.09] text-white/50
            hover:bg-white/[0.09] hover:text-white/80 hover:border-white/[0.18]"
        >
          <Icon name={copied ? "Check" : "Copy"} size={11} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-white/75 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseContent(text: string) {
  const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", content: m[2], lang: m[1] ?? "code" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const parts = parseContent(msg.content);

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
        ${isUser
          ? "bg-white/10 border border-white/15"
          : "bg-white/[0.06] border border-white/10"
        }`}>
        {isUser
          ? <Icon name="User" size={13} className="text-white/60" />
          : <img src={LOGO_URL} alt="OxiwisAI" className="w-5 h-5 object-contain rounded-sm" />
        }
      </div>
      <div className={`max-w-[74%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-white/[0.07] border border-white/[0.09] text-white/80"
            : "glass text-white/80"
          }`}>
          {parts.map((p, i) =>
            p.type === "code"
              ? <CodeBlock key={i} code={p.content} lang={p.lang ?? "code"} />
              : <span key={i} className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: p.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/95">$1</strong>')
                      .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded text-white/60">$1</code>')
                  }}
                />
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-white/20 font-mono">{msg.tokens} tok</span>
          <span className="text-xs text-white/20">
            {msg.timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── СТРАНИЦА: ГЛАВНАЯ ──────────────────────────────────────────────────────

function HomePage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const stats = [
    { label: "Параметров", value: "1T+", icon: "Cpu" },
    { label: "Контекст", value: "200K", icon: "Layers" },
    { label: "Языков", value: "120+", icon: "Globe" },
    { label: "Точность", value: "96.2%", icon: "Target" },
  ];

  const features = [
    { icon: "Code2",        title: "Генерация кода",        desc: "Python, TypeScript, SQL, Bash и 40+ языков. Каждый блок с кнопкой копирования." },
    { icon: "MessageSquare",title: "История диалогов",      desc: "Контекст сохраняется на протяжении всей беседы. Переключайся между сессиями." },
    { icon: "BarChart3",    title: "256 запросов в сутки",  desc: "Лимит обновляется каждую ночь в 00:00 по московскому времени." },
    { icon: "Shield",       title: "Управление доступом",   desc: "API-ключи, роли пользователей, аудит-лог и лимиты на уровне аккаунта." },
    { icon: "Zap",          title: "10 ExaFLOPS",           desc: "Кластер Oxiwis обеспечивает низкую задержку при пиковой нагрузке." },
    { icon: "Plug",         title: "REST API",              desc: "OpenAPI 3.0 спецификация, SDK для Python и JavaScript." },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center grid-bg overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]
            rounded-full bg-white/[0.015] blur-3xl animate-float" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="flex justify-center mb-10 animate-fade-in">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden animate-pulse-ring">
              <img src={LOGO_URL} alt="OxiwisAI" className="logo-glow w-full h-full object-contain" />
            </div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-4 animate-fade-up font-golos"
            style={{ animationDelay: "0.05s" }}>
            <span className="text-gradient">OxiwisAI</span>
          </h1>

          <p className="text-base font-mono text-white/30 tracking-widest uppercase mb-3 animate-fade-up"
            style={{ animationDelay: "0.1s" }}>
            by Oxiwis · 1 Trillion+ Parameters
          </p>

          <p className="text-lg text-white/45 max-w-xl mx-auto mb-10 animate-fade-up"
            style={{ animationDelay: "0.15s" }}>
            Языковая модель нового поколения. Контекст 200k токенов,
            многошаговое рассуждение, генерация кода с копированием.
          </p>

          <div className="flex gap-3 justify-center flex-wrap animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <button className="btn-primary" onClick={() => onNavigate("chat")}>
              Открыть чат
            </button>
            <button className="btn-ghost" onClick={() => onNavigate("docs")}>
              Документация
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <Icon name="ChevronDown" size={18} className="text-white/20" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 px-6 border-y border-white/[0.06]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                <Icon name={s.icon} size={18} className="text-white/50" />
              </div>
              <div className="text-3xl font-black font-mono text-white/90 mb-1">{s.value}</div>
              <div className="text-sm text-white/35">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 font-golos text-white/80">Возможности</h2>
          <p className="text-white/35 text-center text-sm mb-12">Всё для работы с AI на одной платформе</p>
          <div className="grid md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title}
                className="glass glass-hover rounded-xl p-5 animate-fade-up cursor-default"
                style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-4">
                  <Icon name={f.icon} size={16} className="text-white/50" />
                </div>
                <h3 className="font-semibold text-white/80 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-white/[0.06]">
        <div className="max-w-lg mx-auto">
          <img src={LOGO_URL} alt="OxiwisAI" className="w-12 h-12 object-contain mx-auto mb-6 opacity-60" />
          <h2 className="text-2xl font-bold mb-3 font-golos text-white/80">Готовы начать?</h2>
          <p className="text-white/35 text-sm mb-8">256 запросов в сутки · сброс в 00:00 МСК</p>
          <button className="btn-primary" onClick={() => onNavigate("chat")}>Начать диалог</button>
        </div>
      </section>
    </div>
  );
}

// ─── СТРАНИЦА: ЧАТ ─────────────────────────────────────────────────────────

function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: "1", title: "Новый диалог", messages: [], createdAt: new Date() }
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [requestsLeft, setRequestsLeft] = useState(256);
  const [countdown, setCountdown] = useState(getMsUntilMidnightMsk());
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = sessions.find(s => s.id === activeId)!;
  const totalTokens = sessions.reduce((a, s) => a + s.messages.reduce((b, m) => b + m.tokens, 0), 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, typing]);

  useEffect(() => {
    const t = setInterval(() => {
      const ms = getMsUntilMidnightMsk();
      setCountdown(ms);
      if (ms < 1000) setRequestsLeft(DAILY_LIMIT);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const send = () => {
    if (!input.trim() || typing || requestsLeft <= 0) return;
    const tok = Math.ceil(input.length / 4);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim(), tokens: tok, timestamp: new Date() };
    setSessions(prev => prev.map(s =>
      s.id === activeId
        ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? input.slice(0, 38) : s.title }
        : s
    ));
    setRequestsLeft(r => r - 1);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const { content } = generateReply(userMsg.content);
      const aiTok = Math.ceil(content.length / 4);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content, tokens: aiTok, timestamp: new Date() };
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...s.messages, aiMsg] } : s));
      setTyping(false);
    }, 1000 + Math.random() * 900);
  };

  const newSession = () => {
    const id = Date.now().toString();
    setSessions(prev => [...prev, { id, title: "Новый диалог", messages: [], createdAt: new Date() }]);
    setActiveId(id);
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <div className="w-60 border-r border-white/[0.06] flex flex-col bg-black/10 flex-shrink-0">
        <div className="p-3 border-b border-white/[0.06]">
          <button onClick={newSession}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50
              bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:text-white/70 transition-colors">
            <Icon name="Plus" size={13} />
            Новый диалог
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.map(s => (
            <button key={s.id} onClick={() => setActiveId(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors
                ${s.id === activeId
                  ? "bg-white/[0.07] border border-white/[0.1] text-white/80"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white/65"
                }`}>
              <div className="flex items-center gap-2">
                <Icon name="MessageSquare" size={11} />
                <span className="truncate text-xs">{s.title}</span>
              </div>
              <div className="text-white/25 text-xs mt-0.5 font-mono pl-[19px]">{s.messages.length} сообщ.</div>
            </button>
          ))}
        </div>

        {/* Requests counter */}
        <div className="p-3 border-t border-white/[0.06] space-y-3">
          <div>
            <div className="flex justify-between text-xs text-white/30 mb-1.5 font-mono">
              <span>Запросы</span>
              <span>{requestsLeft} / {DAILY_LIMIT}</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="token-bar h-full" style={{ width: `${(requestsLeft / DAILY_LIMIT) * 100}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/20 font-mono">Сброс в 00:00 МСК</span>
            <span className="text-xs font-mono text-white/35">{formatCountdown(countdown)}</span>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-11 border-b border-white/[0.06] flex items-center px-5 gap-3">
          <img src={LOGO_URL} alt="OxiwisAI" className="w-5 h-5 object-contain opacity-60" />
          <span className="text-sm font-mono text-white/40">OxiwisAI</span>
          <span className="badge-mono ml-auto">{totalTokens.toLocaleString()} токенов</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {active.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <img src={LOGO_URL} alt="OxiwisAI" className="w-16 h-16 object-contain mb-5 opacity-30 animate-float" />
              <p className="text-white/30 text-sm font-mono mb-1">OxiwisAI готов</p>
              <p className="text-white/20 text-xs max-w-xs">
                Задайте любой вопрос. Для кода напишите «напиши функцию на Python» — получите блок с кнопкой копирования.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["Напиши функцию на Python", "Покажи пример на TypeScript", "Что такое нейросеть?"].map(h => (
                  <button key={h} onClick={() => setInput(h)}
                    className="px-3 py-1.5 text-xs rounded-lg glass text-white/35 hover:text-white/60 transition-colors">
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {active.messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

          {typing && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                <img src={LOGO_URL} alt="OxiwisAI" className="w-5 h-5 object-contain" />
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 0.18, 0.36].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.06]">
          {requestsLeft === 0 && (
            <div className="mb-3 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-center">
              <span className="text-xs text-white/35 font-mono">
                Лимит исчерпан. Сброс в 00:00 МСК · {formatCountdown(countdown)}
              </span>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={requestsLeft === 0 ? "Лимит запросов исчерпан..." : "Введите запрос… (Shift+Enter — перенос)"}
              disabled={requestsLeft === 0}
              rows={1}
              className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm resize-none
                text-white/75 placeholder:text-white/20
                focus:outline-none focus:border-white/[0.16]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors font-golos"
              style={{ minHeight: "46px", maxHeight: "140px" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 140) + "px";
              }}
            />
            <button onClick={send} disabled={!input.trim() || typing || requestsLeft === 0}
              className="w-11 h-11 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center
                hover:bg-white/[0.13] hover:border-white/[0.18] disabled:opacity-30 disabled:cursor-not-allowed
                transition-all flex-shrink-0">
              <Icon name="Send" size={15} className="text-white/70" />
            </button>
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-xs text-white/20 font-mono">~{Math.ceil(input.length / 4)} токенов</span>
            <span className="text-xs text-white/20 font-mono">OxiwisAI · Oxiwis</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── СТРАНИЦА: ДОКУМЕНТАЦИЯ ─────────────────────────────────────────────────

function DocsPage() {
  const [active, setActive] = useState("quickstart");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
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
      { title: "Установка SDK", lang: "bash", code: `pip install oxiwis-sdk\n# или\nnpm install @oxiwis/sdk` },
      { title: "Первый запрос", lang: "python", code: `from oxiwis import OxiwisClient\n\nclient = OxiwisClient(api_key="your-api-key")\n\nresponse = client.chat.complete(\n    model="oxiwis-1t",\n    messages=[{"role": "user", "content": "Привет!"}]\n)\n\nprint(response.content)\nprint(f"Токенов: {response.usage.total_tokens}")` },
    ],
    auth: [
      { title: "API ключ в заголовке", lang: "bash", code: `curl https://api.oxiwis.ai/v1/chat/complete \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"oxiwis-1t","messages":[{"role":"user","content":"Hello"}]}'` },
    ],
    chat: [
      { title: "Стриминговый ответ", lang: "python", code: `stream = client.chat.stream(\n    model="oxiwis-1t",\n    messages=[{"role": "user", "content": "Расскажи о квантовых компьютерах"}],\n    max_tokens=1000,\n)\n\nfor chunk in stream:\n    print(chunk.delta, end="", flush=True)` },
      { title: "JavaScript", lang: "javascript", code: `const res = await fetch('https://api.oxiwis.ai/v1/chat/complete', {\n  method: 'POST',\n  headers: { 'Authorization': \`Bearer \${key}\`, 'Content-Type': 'application/json' },\n  body: JSON.stringify({ model: 'oxiwis-1t', messages: [{role:'user', content:'Hello'}] }),\n});\nconst data = await res.json();\nconsole.log(data.choices[0].message.content);` },
    ],
    models: [
      { title: "Список моделей", lang: "python", code: `models = client.models.list()\nfor m in models:\n    print(f"{m.id}: {m.context_length} tokens, {m.params}")\n\n# oxiwis-1t       200,000 tokens  · 1T params\n# oxiwis-1t-fast   64,000 tokens  · 1T params (speed-optimized)\n# oxiwis-70b       32,000 tokens  · 70B params` },
    ],
    limits: [
      { title: "Лимиты и сброс", lang: "python", code: `# 256 запросов в сутки на пользователя\n# Сброс в 00:00 по московскому времени (UTC+3)\n\ninfo = client.account.limits()\nprint(f"Осталось запросов: {info.requests_left}/{info.requests_limit}")\nprint(f"Сброс: {info.reset_at_msk}")  # 2026-05-07T00:00:00+03:00` },
    ],
    errors: [
      { title: "Обработка ошибок", lang: "python", code: `from oxiwis.exceptions import RateLimitError, DailyLimitError, AuthError\n\ntry:\n    response = client.chat.complete(model="oxiwis-1t", messages=[...])\nexcept DailyLimitError as e:\n    print(f"Суточный лимит исчерпан. Сброс в 00:00 МСК")\nexcept RateLimitError as e:\n    print(f"Слишком частые запросы. Ждите {e.retry_after}s")\nexcept AuthError:\n    print("Неверный API-ключ")` },
    ],
  };

  const current = snippets[active] ?? [];

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <div className="w-52 border-r border-white/[0.06] bg-black/10 p-3 flex-shrink-0">
        <p className="text-xs font-mono text-white/20 uppercase tracking-widest mb-3 px-1">Разделы</p>
        <nav className="space-y-0.5">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors
                ${active === s.id
                  ? "bg-white/[0.07] border border-white/[0.1] text-white/80"
                  : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}>
              <Icon name={s.icon} size={12} />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <Icon name={sections.find(s => s.id === active)?.icon ?? "Book"} size={16} className="text-white/45" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-golos text-white/80">{sections.find(s => s.id === active)?.label}</h1>
              <p className="text-xs text-white/25 font-mono">OxiwisAI API · v1.0</p>
            </div>
          </div>

          <div className="space-y-7">
            {current.map((sn, i) => (
              <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <h3 className="text-sm font-semibold mb-3 text-white/60 flex items-center gap-2">
                  <Icon name="ChevronRight" size={13} className="text-white/25" />
                  {sn.title}
                </h3>
                <div className="code-block overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-black/30">
                    <span className="font-mono text-xs text-white/30">{sn.lang}</span>
                    <button onClick={() => copy(sn.code, `${active}-${i}`)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all
                        bg-white/[0.04] border border-white/[0.08] text-white/40
                        hover:bg-white/[0.08] hover:text-white/70 hover:border-white/[0.15]">
                      <Icon name={copiedId === `${active}-${i}` ? "Check" : "Copy"} size={10} />
                      {copiedId === `${active}-${i}` ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                  <pre className="p-4 text-sm font-mono text-white/65 overflow-x-auto leading-relaxed">
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

// ─── СТРАНИЦА: О МОДЕЛИ ─────────────────────────────────────────────────────

function AboutPage() {
  const specs = [
    ["Компания",           "Oxiwis"],
    ["Модель",             "OxiwisAI 1T"],
    ["Архитектура",        "MoE Transformer (Decoder-only)"],
    ["Параметры",          "1 000 000 000 000+"],
    ["Контекстное окно",   "200 000 токенов"],
    ["Обучающие данные",   "8T токенов"],
    ["Поддерживаемые языки","120+"],
    ["Лимит запросов",     "256 в сутки на пользователя"],
    ["Сброс лимита",       "00:00 по московскому времени"],
    ["Точность (MMLU)",    "96.2%"],
    ["Задержка (p50)",     "0.9 сек"],
    ["Дата релиза",        "2026"],
  ];

  const comparisons = [
    { model: "OxiwisAI 1T",      ctx: "200K", params: "1T+",  q: 96, s: 88, current: true },
    { model: "OxiwisAI 1T-Fast", ctx: "64K",  params: "1T+",  q: 91, s: 100, current: false },
    { model: "OxiwisAI 70B",     ctx: "32K",  params: "70B",  q: 83, s: 100, current: false },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center gap-4 mb-10 animate-fade-in">
        <img src={LOGO_URL} alt="OxiwisAI" className="w-14 h-14 object-contain logo-glow opacity-80" />
        <div>
          <h1 className="text-3xl font-black font-golos text-gradient">OxiwisAI</h1>
          <p className="text-xs font-mono text-white/30 mt-0.5">by Oxiwis · 1 Trillion+ Parameters</p>
        </div>
      </div>

      {/* Specs */}
      <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <h2 className="text-sm font-semibold text-white/55 mb-5 flex items-center gap-2">
          <Icon name="Settings" size={14} className="text-white/30" />
          Технические характеристики
        </h2>
        <div className="space-y-0">
          {specs.map(([label, value], i) => (
            <div key={label} className={`flex justify-between items-center py-2.5 ${i < specs.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
              <span className="text-xs text-white/35">{label}</span>
              <span className="text-xs font-mono text-white/65">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-sm font-semibold text-white/55 mb-5 flex items-center gap-2">
          <Icon name="BarChart3" size={14} className="text-white/30" />
          Сравнение моделей Oxiwis
        </h2>
        <div className="space-y-4">
          {comparisons.map(c => (
            <div key={c.model} className={`p-4 rounded-xl border ${c.current ? "border-white/[0.12] bg-white/[0.03]" : "border-white/[0.06]"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-white/70">{c.model}</span>
                  {c.current && <span className="badge-mono">текущая</span>}
                </div>
                <div className="flex gap-4 text-xs font-mono text-white/30">
                  <span>{c.ctx}</span><span>{c.params}</span>
                </div>
              </div>
              <div className="space-y-2">
                {[{ label: "Качество", val: c.q }, { label: "Скорость", val: c.s }].map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs text-white/25 mb-1">
                      <span>{b.label}</span><span>{b.val}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full">
                      <div className="h-full rounded-full token-bar" style={{ width: `${b.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── СТРАНИЦА: АДМИН ────────────────────────────────────────────────────────

function AdminPage() {
  const [tab, setTab] = useState<"overview" | "users" | "models" | "limits">("overview");

  const kpis = [
    { label: "Активных пользователей", value: "3 241",   change: "+14%", icon: "Users",      up: true },
    { label: "Запросов сегодня",       value: "187 442", change: "+9%",  icon: "Zap",        up: true },
    { label: "Токенов обработано",     value: "62.1M",   change: "+31%", icon: "BarChart3",  up: true },
    { label: "Ошибок",                 value: "0.01%",   change: "-8%",  icon: "AlertTriangle", up: false },
  ];

  const users = [
    { id: "usr_001", email: "admin@oxiwis.ai",    role: "Администратор", req: 0,   status: "active" },
    { id: "usr_002", email: "dev@company.ru",      role: "Разработчик",  req: 84,  status: "active" },
    { id: "usr_003", email: "analyst@corp.com",    role: "Аналитик",     req: 201, status: "active" },
    { id: "usr_004", email: "banned@example.com",  role: "Пользователь", req: 256, status: "suspended" },
  ];

  const tabs = [
    { id: "overview", label: "Обзор",         icon: "LayoutDashboard" },
    { id: "users",    label: "Пользователи",   icon: "Users" },
    { id: "models",   label: "Модели",         icon: "Cpu" },
    { id: "limits",   label: "Лимиты",         icon: "BarChart3" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold font-golos text-white/80">Панель администратора</h1>
          <p className="text-xs text-white/25 font-mono mt-0.5">OxiwisAI Management Console</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
          <span className="text-xs font-mono text-white/35">Все системы в норме</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-7 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === t.id ? "bg-white/[0.08] text-white/80 border border-white/[0.1]" : "text-white/30 hover:text-white/55"}`}>
            <Icon name={t.icon} size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(k => (
              <div key={k.label} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Icon name={k.icon} size={15} className="text-white/35" />
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    k.up ? "text-white/50 bg-white/[0.05]" : "text-white/35 bg-white/[0.03]"
                  }`}>{k.change}</span>
                </div>
                <div className="text-xl font-black font-mono text-white/85 mb-1">{k.value}</div>
                <div className="text-xs text-white/30">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white/55 mb-4 flex items-center gap-2">
              <Icon name="Activity" size={13} className="text-white/30" />
              Активность за 24 часа
            </h3>
            {[
              { time: "14:32", text: "Новый пользователь зарегистрирован", dot: "bg-white/40" },
              { time: "13:58", text: "Суточный лимит исчерпан — usr_089",  dot: "bg-white/25" },
              { time: "12:21", text: "Обновлена модель OxiwisAI 1T → patch 1.0.4", dot: "bg-white/55" },
              { time: "09:44", text: "API-ключ отозван — usr_042",          dot: "bg-white/25" },
            ].map((a, i) => (
              <div key={i} className={`flex items-center gap-3 py-2.5 ${i < 3 ? "border-b border-white/[0.05]" : ""}`}>
                <span className="font-mono text-xs text-white/20 w-11">{a.time}</span>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.dot}`} />
                <span className="text-xs text-white/40">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="glass rounded-xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/60">Пользователи ({users.length})</h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] border border-white/[0.09] text-white/45 hover:text-white/70 transition-colors">
              <Icon name="Plus" size={11} />Добавить
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["ID", "Email", "Роль", "Запросов сегодня", "Статус"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono text-white/20 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-white/25">{u.id}</td>
                  <td className="px-4 py-3 text-xs text-white/60">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-white/35">{u.role}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{u.req} / 256</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                      u.status === "active"
                        ? "bg-white/[0.05] border-white/[0.1] text-white/50"
                        : "bg-white/[0.03] border-white/[0.06] text-white/25"
                    }`}>{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "models" && (
        <div className="space-y-3 animate-fade-in">
          {[
            { id: "oxiwis-1t",      status: "active",     req: "141 291", latency: "0.9s", params: "1T+" },
            { id: "oxiwis-1t-fast", status: "active",     req: "43 821",  latency: "0.3s", params: "1T+" },
            { id: "oxiwis-70b",     status: "deprecated", req: "2 330",   latency: "0.5s", params: "70B" },
          ].map(m => (
            <div key={m.id} className={`glass rounded-xl p-5 border ${m.status === "active" ? "border-white/[0.1]" : "border-white/[0.05]"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-white/70">{m.id}</span>
                  <span className={`badge-mono ${m.status === "deprecated" ? "opacity-50" : ""}`}>{m.status}</span>
                  <span className="badge-mono">{m.params}</span>
                </div>
                <div className="flex gap-5 text-xs font-mono text-white/30">
                  <span>Запросов: <span className="text-white/55">{m.req}</span></span>
                  <span>Задержка: <span className="text-white/55">{m.latency}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "limits" && (
        <div className="space-y-5 animate-fade-in">
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white/55 mb-5 flex items-center gap-2">
              <Icon name="BarChart3" size={14} className="text-white/30" />
              Использование запросов — 7 дней
            </h3>
            <div className="flex items-end gap-2 h-36">
              {[58, 72, 41, 89, 81, 69, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-sm bg-white/[0.08] transition-all" style={{ height: `${h}%` }} />
                  <span className="text-xs font-mono text-white/20">
                    {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white/55 mb-4">Настройки лимитов</h3>
            <div className="flex justify-between items-center py-3 border-b border-white/[0.05]">
              <div>
                <p className="text-xs text-white/60">Запросов в сутки</p>
                <p className="text-xs text-white/25 mt-0.5">Сброс в 00:00 МСК</p>
              </div>
              <span className="font-mono text-white/70 text-sm">256</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <div>
                <p className="text-xs text-white/60">Временная зона сброса</p>
                <p className="text-xs text-white/25 mt-0.5">Europe/Moscow (UTC+3)</p>
              </div>
              <span className="font-mono text-white/70 text-sm">00:00 МСК</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LAYOUT ─────────────────────────────────────────────────────────────────

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "home",  label: "Главная",       icon: "Home" },
  { id: "chat",  label: "Чат",           icon: "MessageSquare" },
  { id: "docs",  label: "Документация",  icon: "Book" },
  { id: "about", label: "О модели",      icon: "Cpu" },
  { id: "admin", label: "Админ",         icon: "Settings" },
];

export default function Index() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/[0.06] bg-black/60 backdrop-blur-2xl">
        <div className="flex items-center h-full px-5 max-w-screen-2xl mx-auto gap-6">
          <button onClick={() => setPage("home")} className="flex items-center gap-2.5 flex-shrink-0 group">
            <img src={LOGO_URL} alt="OxiwisAI"
              className="w-7 h-7 object-contain logo-glow opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="font-black font-mono text-sm tracking-tight text-white/80 group-hover:text-white/95 transition-colors">
              Oxiwis<span className="text-white/40">AI</span>
            </span>
          </button>

          <nav className="flex items-center gap-0.5 flex-1">
            {NAV.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${page === item.id
                    ? "text-white/85 bg-white/[0.07] border border-white/[0.1]"
                    : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
                  }`}>
                <Icon name={item.icon} size={12} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.07]">
              <div className="w-1.5 h-1.5 rounded-full bg-white/45 animate-pulse" />
              <span className="text-xs font-mono text-white/30">online</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
              <Icon name="User" size={13} className="text-white/40" />
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
