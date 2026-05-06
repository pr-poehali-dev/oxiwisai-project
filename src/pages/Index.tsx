import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

type Page = "home" | "chat" | "docs" | "about" | "admin";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens: number;
  timestamp: Date;
  hasCode?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const CODE_KEYWORDS = ["напиши код", "покажи код", "пример кода", "функцию", "скрипт", "написать функцию", "код на", "реализуй", "создай функцию", "write code", "code example"];

function detectCodeRequest(text: string): boolean {
  return CODE_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

function extractLanguage(text: string): string {
  if (text.toLowerCase().includes("python")) return "python";
  if (text.toLowerCase().includes("javascript") || text.toLowerCase().includes("js")) return "javascript";
  if (text.toLowerCase().includes("typescript") || text.toLowerCase().includes("ts")) return "typescript";
  if (text.toLowerCase().includes("css")) return "css";
  if (text.toLowerCase().includes("html")) return "html";
  if (text.toLowerCase().includes("sql")) return "sql";
  if (text.toLowerCase().includes("bash") || text.toLowerCase().includes("shell")) return "bash";
  return "javascript";
}

function generateCodeResponse(userMsg: string): { text: string; code: string; lang: string } {
  const lang = extractLanguage(userMsg);
  const codeExamples: Record<string, string> = {
    python: `def process_data(items: list) -> dict:
    """Обработка данных с агрегацией результатов."""
    result = {}
    for item in items:
        key = item.get("type", "unknown")
        result[key] = result.get(key, 0) + item.get("value", 0)
    return result

# Пример использования
data = [
    {"type": "alpha", "value": 42},
    {"type": "beta", "value": 17},
    {"type": "alpha", "value": 8},
]
output = process_data(data)
print(output)  # {'alpha': 50, 'beta': 17}`,
    javascript: `async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return await response.json();
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// Пример использования
const data = await fetchWithRetry('https://api.example.com/data');
console.log(data);`,
    typescript: `interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<ApiResponse<T>> {
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(\`API Error: \${response.status}\`);
  }
  
  return response.json();
}`,
    sql: `-- Запрос с агрегацией и оконными функциями
SELECT
  user_id,
  session_date,
  tokens_used,
  SUM(tokens_used) OVER (
    PARTITION BY user_id
    ORDER BY session_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_tokens,
  AVG(tokens_used) OVER (
    PARTITION BY user_id
    ORDER BY session_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_avg_7d
FROM api_sessions
WHERE session_date >= NOW() - INTERVAL '30 days'
ORDER BY user_id, session_date;`,
    bash: `#!/bin/bash
# Скрипт мониторинга сервиса

SERVICE_NAME="nexus-api"
LOG_FILE="/var/log/nexus-monitor.log"
MAX_RESTARTS=3
restart_count=0

check_service() {
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "[$(date)] Service $SERVICE_NAME is down. Restarting..." >> "$LOG_FILE"
        systemctl restart "$SERVICE_NAME"
        ((restart_count++))
        return 1
    fi
    return 0
}

while true; do
    if ! check_service; then
        if [ $restart_count -ge $MAX_RESTARTS ]; then
            echo "[$(date)] Max restarts reached. Alerting admin..." >> "$LOG_FILE"
            # send_alert
            break
        fi
    fi
    sleep 30
done`,
  };

  const code = codeExamples[lang] || codeExamples.javascript;
  return {
    text: `Конечно! Вот пример на **${lang}**:`,
    code,
    lang,
  };
}

function generateAIResponse(userMsg: string): { content: string; hasCode: boolean } {
  const isCodeRequest = detectCodeRequest(userMsg);

  if (isCodeRequest) {
    const { text, code, lang } = generateCodeResponse(userMsg);
    return {
      content: `${text}\n\`\`\`${lang}\n${code}\n\`\`\`\nКод готов к использованию. Если нужны пояснения или модификации — скажи.`,
      hasCode: true,
    };
  }

  const responses = [
    "NEXUS обработал ваш запрос. Анализ завершён — модель использует трансформерную архитектуру с 175B параметров и контекстным окном 128k токенов.",
    "Запрос принят и обработан. Система работает в режиме максимальной точности. Если нужен более детальный ответ — уточните запрос.",
    "Понял задачу. NEXUS AI оптимизирован для сложных аналитических задач, генерации кода и работы с большими объёмами данных.",
    "Ответ сгенерирован с использованием контекста диалога. Точность модели на этой задаче — 94.7%. Хотите расширить ответ?",
  ];
  return {
    content: responses[Math.floor(Math.random() * responses.length)],
    hasCode: false,
  };
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="code-block mt-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/20 bg-black/40">
        <span className="font-mono text-xs text-blue-400">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all duration-200
            bg-blue-500/10 border border-blue-500/30 text-blue-300
            hover:bg-blue-500/20 hover:border-blue-400 hover:text-blue-200"
        >
          {copied ? (
            <>
              <Icon name="Check" size={11} />
              Скопировано
            </>
          ) : (
            <>
              <Icon name="Copy" size={11} />
              Копировать
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-green-300/90 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseMessageContent(content: string) {
  const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2], lang: match[1] || "code" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const parts = parseMessageContent(msg.content);

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
        ${isUser
          ? "bg-gradient-to-br from-violet-600 to-violet-800 border border-violet-500/50"
          : "bg-gradient-to-br from-blue-600 to-blue-900 border border-blue-500/50"
        }`}>
        <Icon name={isUser ? "User" : "Bot"} size={14} className="text-white" />
      </div>
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-gradient-to-br from-violet-600/30 to-blue-600/20 border border-violet-500/30 text-foreground"
            : "glass-card text-foreground"
          }`}>
          {parts.map((part, i) =>
            part.type === "code" ? (
              <CodeBlock key={i} code={part.content} lang={part.lang || "code"} />
            ) : (
              <span key={i} className="whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: part.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-300">$1</strong>')
                    .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-black/40 px-1.5 py-0.5 rounded text-green-400">$1</code>')
                }}
              />
            )
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground font-mono">
            {msg.tokens} токенов
          </span>
          <span className="text-xs text-muted-foreground">
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
    { label: "Параметров", value: "175B", icon: "Cpu" },
    { label: "Контекст", value: "128K", icon: "Layers" },
    { label: "Языков", value: "95+", icon: "Globe" },
    { label: "Точность", value: "94.7%", icon: "Target" },
  ];

  const features = [
    { icon: "Code2", title: "Генерация кода", desc: "Python, JS, TS, SQL, Bash и ещё 40+ языков с подсветкой и копированием", color: "blue" },
    { icon: "MessageSquare", title: "Диалог с памятью", desc: "История диалогов сохраняется. Модель помнит контекст всей беседы", color: "violet" },
    { icon: "Zap", title: "Токен-система", desc: "Точный учёт потребления токенов для каждого запроса и сессии", color: "cyan" },
    { icon: "Shield", title: "Управление доступом", desc: "API-ключи, роли пользователей, лимиты и аудит-лог", color: "blue" },
    { icon: "BarChart3", title: "Аналитика", desc: "Дашборд с метриками использования, топ запросов, статистика моделей", color: "violet" },
    { icon: "Plug", title: "API интеграция", desc: "REST API с документацией OpenAPI 3.0, SDK для Python и JS", color: "cyan" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center grid-bg overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-8 animate-fade-in">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-mono text-blue-300 tracking-widest uppercase">Система активна — v3.1.0</span>
          </div>

          <h1
            className="glitch text-6xl md:text-8xl font-black tracking-tight mb-6 animate-fade-in-up font-golos"
            data-text="NEXUS AI"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              NEXUS AI
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4 animate-fade-in-up font-light" style={{ animationDelay: "0.2s" }}>
            Языковая модель нового поколения
          </p>
          <p className="text-base text-muted-foreground/70 max-w-xl mx-auto mb-12 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            175B параметров · 128k контекст · генерация кода с кнопкой копирования · история диалогов
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <button
              onClick={() => onNavigate("chat")}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl font-semibold text-white
                hover:from-blue-500 hover:to-violet-500 transition-all duration-300 hover:scale-105
                shadow-lg shadow-blue-500/20 animate-pulse-neon"
            >
              Открыть чат
            </button>
            <button
              onClick={() => onNavigate("docs")}
              className="px-8 py-4 glass-card rounded-xl font-semibold text-foreground
                hover:border-blue-500/40 transition-all duration-300 hover:scale-105"
            >
              Документация
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <Icon name="ChevronDown" size={20} className="text-muted-foreground/40" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Icon name={s.icon} size={20} className="text-blue-400" />
              </div>
              <div className="text-3xl font-black font-mono neon-text-blue mb-1">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 font-golos">Возможности</h2>
          <p className="text-muted-foreground text-center mb-12">Всё что нужно для работы с AI в одном месте</p>
          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="glass-card rounded-xl p-6 hover:border-blue-500/30 transition-all duration-300 hover:translate-y-[-2px] animate-fade-in-up cursor-default"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4
                  ${f.color === "blue" ? "bg-blue-500/15 border border-blue-500/25" :
                    f.color === "violet" ? "bg-violet-500/15 border border-violet-500/25" :
                    "bg-cyan-500/15 border border-cyan-500/25"}`}>
                  <Icon name={f.icon} size={18} className={
                    f.color === "blue" ? "text-blue-400" :
                    f.color === "violet" ? "text-violet-400" :
                    "text-cyan-400"
                  } />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 font-golos">Готовы начать?</h2>
          <p className="text-muted-foreground mb-8">Запустите чат и попробуйте NEXUS AI прямо сейчас</p>
          <button
            onClick={() => onNavigate("chat")}
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl font-semibold text-white
              hover:from-blue-500 hover:to-violet-500 transition-all duration-300 hover:scale-105"
          >
            Начать диалог
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── СТРАНИЦА: ЧАТ ─────────────────────────────────────────────────────────

function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "1",
      title: "Генерация кода на Python",
      createdAt: new Date(Date.now() - 3600000),
      messages: [],
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("1");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [totalTokens, setTotalTokens] = useState(1240);
  const [tokenLimit] = useState(50000);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId)!;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isTyping]);

  const sendMessage = () => {
    if (!input.trim() || isTyping) return;

    const userTokens = Math.ceil(input.length / 4);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      tokens: userTokens,
      timestamp: new Date(),
    };

    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? input.slice(0, 40) : s.title }
        : s
    ));
    setTotalTokens(t => t + userTokens);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const { content, hasCode } = generateAIResponse(userMsg.content);
      const aiTokens = Math.ceil(content.length / 4);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content,
        tokens: aiTokens,
        timestamp: new Date(),
        hasCode,
      };
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s
      ));
      setTotalTokens(t => t + aiTokens);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  const newSession = () => {
    const id = Date.now().toString();
    setSessions(prev => [...prev, { id, title: "Новый диалог", messages: [], createdAt: new Date() }]);
    setActiveSessionId(id);
  };

  const tokenPercent = Math.min((totalTokens / tokenLimit) * 100, 100);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-black/20">
        <div className="p-4 border-b border-border">
          <button
            onClick={newSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium
              bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            <Icon name="Plus" size={14} />
            Новый диалог
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate
                ${s.id === activeSessionId
                  ? "bg-blue-500/15 border border-blue-500/25 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              <div className="flex items-center gap-2">
                <Icon name="MessageSquare" size={12} />
                <span className="truncate">{s.title}</span>
              </div>
              <div className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                {s.messages.length} сообщений
              </div>
            </button>
          ))}
        </div>

        {/* Token usage */}
        <div className="p-4 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
            <span>Токены</span>
            <span>{totalTokens.toLocaleString()} / {tokenLimit.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="token-bar h-full"
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground/60 mt-1.5 font-mono">
            {(tokenLimit - totalTokens).toLocaleString()} осталось
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeSession.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center mb-4">
                <Icon name="Bot" size={28} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">NEXUS AI готов</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Спросите что угодно. Для кода напишите «напиши функцию» или «покажи пример на Python» — получите блок с кнопкой копирования.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["Напиши функцию на Python", "Объясни как работает JWT", "Покажи код на TypeScript"].map(hint => (
                  <button
                    key={hint}
                    onClick={() => setInput(hint)}
                    className="px-3 py-1.5 text-xs rounded-lg glass-card text-muted-foreground hover:text-foreground hover:border-blue-500/30 transition-colors"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession.messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isTyping && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-900 border border-blue-500/50 flex items-center justify-center flex-shrink-0">
                <Icon name="Bot" size={14} className="text-white" />
              </div>
              <div className="glass-card rounded-xl px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Введите запрос... (Shift+Enter для переноса)"
                rows={1}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm resize-none
                  focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
                  placeholder:text-muted-foreground/50 font-golos transition-colors"
                style={{ minHeight: "48px", maxHeight: "160px" }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 160) + "px";
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center
                hover:from-blue-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200 hover:scale-105 flex-shrink-0"
            >
              <Icon name="Send" size={16} className="text-white" />
            </button>
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-xs text-muted-foreground/50 font-mono">
              ~{Math.ceil(input.length / 4)} токенов
            </span>
            <span className="text-xs text-muted-foreground/50 font-mono">NEXUS-3.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── СТРАНИЦА: ДОКУМЕНТАЦИЯ ─────────────────────────────────────────────────

function DocsPage() {
  const [activeSection, setActiveSection] = useState("quickstart");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const sections = [
    { id: "quickstart", label: "Быстрый старт", icon: "Zap" },
    { id: "auth", label: "Аутентификация", icon: "Key" },
    { id: "chat", label: "Chat API", icon: "MessageSquare" },
    { id: "models", label: "Модели", icon: "Cpu" },
    { id: "tokens", label: "Токены", icon: "BarChart3" },
    { id: "errors", label: "Ошибки", icon: "AlertTriangle" },
  ];

  const codeSnippets: Record<string, { title: string; lang: string; code: string }[]> = {
    quickstart: [
      {
        title: "Установка SDK",
        lang: "bash",
        code: `pip install nexus-ai-sdk
# или
npm install @nexus-ai/sdk`,
      },
      {
        title: "Первый запрос",
        lang: "python",
        code: `from nexus_ai import NexusClient

client = NexusClient(api_key="your-api-key")

response = client.chat.complete(
    model="nexus-3.1",
    messages=[
        {"role": "user", "content": "Привет! Напиши функцию сортировки на Python"}
    ]
)

print(response.content)
print(f"Использовано токенов: {response.usage.total_tokens}")`,
      },
    ],
    auth: [
      {
        title: "API ключ в заголовке",
        lang: "bash",
        code: `curl https://api.nexus.ai/v1/chat/complete \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "nexus-3.1", "messages": [{"role": "user", "content": "Hello"}]}'`,
      },
    ],
    chat: [
      {
        title: "Стриминговый ответ",
        lang: "python",
        code: `stream = client.chat.stream(
    model="nexus-3.1",
    messages=[{"role": "user", "content": "Расскажи про трансформеры"}],
    max_tokens=1000,
    temperature=0.7,
)

for chunk in stream:
    print(chunk.delta, end="", flush=True)`,
      },
      {
        title: "JavaScript / Fetch",
        lang: "javascript",
        code: `const response = await fetch('https://api.nexus.ai/v1/chat/complete', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'nexus-3.1',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: false,
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);`,
      },
    ],
    models: [
      {
        title: "Список моделей",
        lang: "python",
        code: `models = client.models.list()
for model in models:
    print(f"{model.id}: {model.context_length} токенов")

# nexus-3.1      128,000 токенов
# nexus-3.1-fast  32,000 токенов
# nexus-2.8       16,000 токенов`,
      },
    ],
    tokens: [
      {
        title: "Подсчёт токенов",
        lang: "python",
        code: `# Подсчёт до отправки
count = client.tokens.count(
    model="nexus-3.1",
    messages=[{"role": "user", "content": "Текст запроса"}]
)
print(f"Запрос будет стоить: {count.total} токенов")

# Статистика использования
usage = client.usage.get(period="month")
print(f"Потрачено за месяц: {usage.total_tokens:,} токенов")`,
      },
    ],
    errors: [
      {
        title: "Обработка ошибок",
        lang: "python",
        code: `from nexus_ai.exceptions import (
    RateLimitError,
    TokenLimitError,
    AuthenticationError,
)

try:
    response = client.chat.complete(
        model="nexus-3.1",
        messages=[{"role": "user", "content": "Hello"}]
    )
except RateLimitError as e:
    print(f"Лимит запросов. Повтор через {e.retry_after}s")
except TokenLimitError as e:
    print(f"Превышен лимит токенов: {e.used}/{e.limit}")
except AuthenticationError:
    print("Неверный API ключ")`,
      },
    ],
  };

  const current = codeSnippets[activeSection] || [];

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="w-56 border-r border-border bg-black/20 p-4">
        <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">Разделы</p>
        <nav className="space-y-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${activeSection === s.id
                  ? "bg-blue-500/15 border border-blue-500/25 text-blue-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <Icon name={s.icon} size={14} />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Icon name={sections.find(s => s.id === activeSection)?.icon ?? "Book"} size={18} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-golos">{sections.find(s => s.id === activeSection)?.label}</h1>
              <p className="text-sm text-muted-foreground font-mono">NEXUS AI API Docs v3.1</p>
            </div>
          </div>

          <div className="space-y-8">
            {current.map((snippet, i) => (
              <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Icon name="ChevronRight" size={14} className="text-blue-400" />
                  {snippet.title}
                </h3>
                <div className="code-block overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-blue-500/20 bg-black/40">
                    <span className="font-mono text-xs text-blue-400">{snippet.lang}</span>
                    <button
                      onClick={() => copyCode(snippet.code, `${activeSection}-${i}`)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all duration-200
                        bg-blue-500/10 border border-blue-500/30 text-blue-300
                        hover:bg-blue-500/20 hover:border-blue-400 hover:text-blue-200"
                    >
                      {copiedId === `${activeSection}-${i}` ? (
                        <><Icon name="Check" size={11} />Скопировано</>
                      ) : (
                        <><Icon name="Copy" size={11} />Копировать</>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-sm font-mono text-green-300/90 overflow-x-auto leading-relaxed">
                    <code>{snippet.code}</code>
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
    { label: "Архитектура", value: "Decoder-only Transformer" },
    { label: "Параметры", value: "175B" },
    { label: "Контекстное окно", value: "128,000 токенов" },
    { label: "Слои", value: "96 layers" },
    { label: "Attention heads", value: "96 heads" },
    { label: "Размер словаря", value: "100,256 токенов" },
    { label: "Обучающие данные", value: "3.2T токенов" },
    { label: "Дата релиза", value: "Январь 2026" },
  ];

  const comparisons = [
    { model: "NEXUS 3.1", context: "128K", params: "175B", speed: "98", quality: "97" },
    { model: "NEXUS 2.8", context: "32K", params: "70B", speed: "100", quality: "89" },
    { model: "NEXUS 2.4", context: "16K", params: "13B", speed: "100", quality: "78" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 mb-6">
          <Icon name="Cpu" size={12} className="text-violet-400" />
          <span className="text-xs font-mono text-violet-300">NEXUS-3.1 · Production</span>
        </div>
        <h1 className="text-4xl font-black mb-4 font-golos">
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">О модели</span>
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
          NEXUS AI — языковая модель на архитектуре трансформера с 175 миллиардами параметров.
          Оптимизирована для генерации кода, аналитики и многошагового рассуждения.
        </p>
      </div>

      {/* Specs */}
      <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <h2 className="font-semibold mb-5 flex items-center gap-2">
          <Icon name="Settings" size={16} className="text-blue-400" />
          Технические характеристики
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {specs.map((s, i) => (
            <div key={s.label} className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className="text-sm font-mono text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="glass-card rounded-2xl p-6 mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <h2 className="font-semibold mb-5 flex items-center gap-2">
          <Icon name="BarChart3" size={16} className="text-violet-400" />
          Сравнение моделей
        </h2>
        <div className="space-y-4">
          {comparisons.map((c, i) => (
            <div key={c.model} className={`p-4 rounded-xl border transition-colors ${i === 0 ? "border-blue-500/30 bg-blue-500/5" : "border-border"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-sm">{c.model}</span>
                  {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Текущая</span>}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                  <span>{c.context}</span>
                  <span>{c.params}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Качество</span>
                    <span>{c.quality}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${c.quality}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Скорость</span>
                    <span>{c.speed}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${c.speed}%` }} />
                  </div>
                </div>
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
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "models" | "tokens">("overview");

  const stats = [
    { label: "Активные пользователи", value: "2,847", change: "+12%", icon: "Users", color: "blue" },
    { label: "Запросов сегодня", value: "143,291", change: "+8%", icon: "Zap", color: "violet" },
    { label: "Токенов потрачено", value: "48.2M", change: "+23%", icon: "BarChart3", color: "cyan" },
    { label: "Ошибок", value: "0.02%", change: "-5%", icon: "AlertTriangle", color: "green" },
  ];

  const users = [
    { id: "usr_001", email: "admin@nexus.ai", role: "Администратор", tokens: 250000, status: "active" },
    { id: "usr_002", email: "dev@company.ru", role: "Разработчик", tokens: 50000, status: "active" },
    { id: "usr_003", email: "analyst@corp.com", role: "Аналитик", tokens: 25000, status: "active" },
    { id: "usr_004", email: "test@example.com", role: "Пользователь", tokens: 5000, status: "suspended" },
  ];

  const models = [
    { id: "nexus-3.1", status: "active", requests: "98,421", latency: "1.2s", tokens: "38.1M" },
    { id: "nexus-3.1-fast", status: "active", requests: "41,830", latency: "0.4s", tokens: "9.2M" },
    { id: "nexus-2.8", status: "deprecated", requests: "3,040", latency: "0.8s", tokens: "0.9M" },
  ];

  const tabs = [
    { id: "overview", label: "Обзор", icon: "LayoutDashboard" },
    { id: "users", label: "Пользователи", icon: "Users" },
    { id: "models", label: "Модели", icon: "Cpu" },
    { id: "tokens", label: "Токены", icon: "BarChart3" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-golos">Панель администратора</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">NEXUS AI Management Console</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-green-300">Все системы в норме</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl mb-8 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as "overview" | "users" | "models" | "tokens")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === t.id
                ? "bg-blue-600/80 text-white shadow-lg shadow-blue-500/20"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(s => (
              <div key={s.label} className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon name={s.icon} size={18} className={
                    s.color === "blue" ? "text-blue-400" :
                    s.color === "violet" ? "text-violet-400" :
                    s.color === "cyan" ? "text-cyan-400" : "text-green-400"
                  } />
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    s.change.startsWith("+") ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
                  }`}>{s.change}</span>
                </div>
                <div className="text-2xl font-black font-mono mb-1">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Icon name="Activity" size={16} className="text-blue-400" />
              Активность (последние 24ч)
            </h3>
            <div className="space-y-3">
              {[
                { time: "14:32", event: "Новый пользователь зарегистрирован", type: "info" },
                { time: "13:58", event: "Превышен лимит токенов — usr_089", type: "warn" },
                { time: "12:21", event: "Обновлена модель nexus-3.1 до патча 3.1.4", type: "success" },
                { time: "09:44", event: "API ключ отозван — usr_042", type: "warn" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="font-mono text-xs text-muted-foreground w-12">{a.time}</span>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    a.type === "success" ? "bg-green-400" : a.type === "warn" ? "bg-yellow-400" : "bg-blue-400"
                  }`} />
                  <span className="text-sm text-muted-foreground">{a.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="font-semibold">Пользователи ({users.length})</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors">
              <Icon name="Plus" size={13} />
              Добавить
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["ID", "Email", "Роль", "Лимит токенов", "Статус", ""].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-mono text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.id}</td>
                  <td className="px-5 py-3 text-sm">{u.email}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{u.role}</td>
                  <td className="px-5 py-3 font-mono text-sm">{u.tokens.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                      u.status === "active"
                        ? "bg-green-500/10 border-green-500/30 text-green-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name="MoreHorizontal" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "models" && (
        <div className="space-y-4 animate-fade-in">
          {models.map(m => (
            <div key={m.id} className={`glass-card rounded-xl p-5 border ${m.status === "active" ? "border-blue-500/20" : "border-border"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">{m.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                    m.status === "active"
                      ? "bg-green-500/10 border-green-500/30 text-green-300"
                      : "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                  }`}>{m.status}</span>
                </div>
                <div className="flex gap-6 text-sm font-mono text-muted-foreground">
                  <span>Запросов: <span className="text-foreground">{m.requests}</span></span>
                  <span>Токенов: <span className="text-foreground">{m.tokens}</span></span>
                  <span>Задержка: <span className="text-foreground">{m.latency}</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="space-y-6 animate-fade-in">
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2">
              <Icon name="BarChart3" size={16} className="text-violet-400" />
              Потребление токенов — последние 7 дней
            </h3>
            <div className="flex items-end gap-2 h-40">
              {[62, 78, 45, 91, 88, 73, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-blue-600 to-violet-500 transition-all duration-500"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Бесплатный план", used: 45, limit: 10000 },
              { label: "Pro план", used: 78, limit: 100000 },
              { label: "Enterprise", used: 23, limit: 1000000 },
            ].map(p => (
              <div key={p.label} className="glass-card rounded-xl p-5">
                <div className="text-sm font-medium mb-3">{p.label}</div>
                <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
                  <span>{p.used}%</span>
                  <span>{p.limit.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="token-bar h-full" style={{ width: `${p.used}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── НАВИГАЦИЯ + LAYOUT ─────────────────────────────────────────────────────

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Главная", icon: "Home" },
  { id: "chat", label: "Чат", icon: "MessageSquare" },
  { id: "docs", label: "Документация", icon: "Book" },
  { id: "about", label: "О модели", icon: "Cpu" },
  { id: "admin", label: "Админ", icon: "Settings" },
];

export default function Index() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[60px] border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center h-full px-6 max-w-screen-2xl mx-auto">
          <button
            onClick={() => setPage("home")}
            className="flex items-center gap-2.5 mr-10 flex-shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Icon name="Zap" size={14} className="text-white" />
            </div>
            <span className="font-black font-mono text-base tracking-tight">NEXUS<span className="neon-text-blue">AI</span></span>
          </button>

          <nav className="flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${page === item.id
                    ? "text-foreground bg-blue-500/10 border border-blue-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <Icon name={item.icon} size={13} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-mono text-green-300">online</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center border border-blue-500/30">
              <Icon name="User" size={14} className="text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="pt-[60px]">
        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "chat" && <ChatPage />}
        {page === "docs" && <DocsPage />}
        {page === "about" && <AboutPage />}
        {page === "admin" && <AdminPage />}
      </main>
    </div>
  );
}