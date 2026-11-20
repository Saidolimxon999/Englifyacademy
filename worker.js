// Englify AI proxy — Cloudflare Worker
// ANTHROPIC_API_KEY ni faqat shu yerda (Secret sifatida) saqlang. Uni index.html ga YOZMANG.
//
// Workers -> Settings -> Variables and Secrets:
//   ANTHROPIC_API_KEY  (Secret)  = sk-ant-...
//   ALLOW_ORIGIN       (Text)    = https://saidolimxon999.github.io   (sayt manzilingiz, oxirida / siz)
//   MODEL              (Text, ixtiyoriy) = claude-haiku-5-5

const J = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return J({ ok: true }, 200, cors);
    if (env.ALLOW_ORIGIN && req.headers.get("Origin") !== env.ALLOW_ORIGIN) return J({ error: "forbidden" }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return J({ error: "key not set" }, 500, cors);

    let b;
    try { b = await req.json(); } catch { return J({ error: "bad json" }, 400, cors); }

    let msgs = (Array.isArray(b.messages) ? b.messages : [])
      .slice(-16)
      .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 1200) }))
      .filter(m => m.content);
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    const out = [];
    for (const m of msgs) {
      const l = out[out.length - 1];
      if (l && l.role === m.role) l.content += "\n" + m.content; else out.push({ ...m });
    }
    if (!out.length) return J({ error: "no messages" }, 400, cors);

    const topic = String(b.topic || "free talk").replace(/["\n]/g, " ").slice(0, 80);
    const level = String(b.level || "A2").replace(/[^A-C0-9]/g, "").slice(0, 2) || "A2";
    const SYS = b.mode === "talk"
      ? `You are a friendly English conversation partner for an Uzbek-speaking learner. Topic: "${topic}". Learner level: ${level}. Use natural, simple spoken English that fits the level. Reply in 1-3 short sentences and always end with one follow-up question. If the learner's last message has a clear grammar or word mistake, add a new line starting with "Tip:" giving the corrected sentence and a one-line explanation in Uzbek (Latin script). No markdown, no emojis.`
      : `You are a patient English teacher for Uzbek speakers. Explain in simple Uzbek (Latin script) with short English examples. Maximum 120 words. No markdown.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.MODEL || "claude-haiku-5-5", max_tokens: 350, system: SYS, messages: out }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return J({ error: (d.error && d.error.message) || "api error" }, 502, cors);
    return J({ reply: (d.content || []).map(c => c.text || "").join("").trim() }, 200, cors);
  },
};
