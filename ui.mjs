// ui.mjs - local demo page for SignalForge v2. It runs agent_v2.mjs; it is NOT a second agent.
import http from "node:http";
import { execFile } from "node:child_process";

const PORT = 4020;

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>SignalForge</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#0f1720;color:#e6edf3}
input{width:70%;padding:10px;font-size:16px}
button{padding:10px 16px;font-size:16px;cursor:pointer}
.samples{margin:12px 0}
.samples button{padding:6px 12px;font-size:14px;margin-right:8px}
.card{margin-top:24px;padding:16px;border-radius:8px;background:#1b2633;border-left:6px solid #30363d}
.card.good{border-left-color:#3fb950}
.card.bad{border-left-color:#f85149}
.card.warn{border-left-color:#d29922}
.verdict{font-size:28px;font-weight:bold}
.small{color:#9fb0c0;font-size:14px}
</style></head><body>
<h1>SignalForge v2</h1>
<p class="small">Paste a business website. The agent checks that it can really see the site before it judges anything.</p>
<p class="small">Pages at 127.0.0.1 are simulated test pages, not real businesses.</p>
<input id="url" placeholder="https://example.com"> <button id="go">Check</button>
<div class="samples">
<span class="small">Samples (fill the box, then press Check):</span><br>
<button class="sample" data-url="http://127.0.0.1:4010/always-502">502 page (no model call)</button>
<button class="sample" data-url="https://umadesign.io">Unreachable real site (no model call)</button>
<button class="sample" data-url="http://127.0.0.1:4010/case3/">Modern site, simulated (1 model request)</button>
</div>
<div id="out"></div>
<script>
const out = document.getElementById("out");
function line(parent, text, cls) {
  const p = document.createElement("p");
  if (cls) p.className = cls;
  p.textContent = text;
  parent.appendChild(p);
}
document.querySelectorAll(".sample").forEach((b) => {
  b.onclick = () => { document.getElementById("url").value = b.dataset.url; };
});
document.getElementById("go").onclick = async () => {
  const url = document.getElementById("url").value.trim();
  out.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  out.appendChild(card);
  line(card, "Working... visiting the page, re-checking if it fails, then deciding. This can take up to a minute.", "small");
  try {
    const res = await fetch("/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await res.json();
    card.innerHTML = "";
    if (data.error) { line(card, "Error: " + data.error); return; }
    const colors = { QUALIFY: "good", REJECT: "bad" };
    card.className = "card " + (colors[data.verdict] || "warn");
    line(card, data.verdict + (data.reason_code ? " / " + data.reason_code : ""), "verdict");
    line(card, "Opportunity score: " + (data.opportunity_score === null ? "none" : data.opportunity_score));
    line(card, "Confidence: " + data.confidence);
    line(card, data.reason);
    for (const s of data.sources || []) {
      line(card, s.label + " " + s.url + " : " + s.state + " (" + s.attempts + " attempts) " + (s.why || ""), "small");
    }
  } catch (e) {
    card.innerHTML = "";
    line(card, "Request failed: " + e.message);
  }
};
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }
  if (req.method === "POST" && req.url === "/check") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 10000) req.destroy();
    });
    req.on("end", () => {
      const send = (obj) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      let url = "";
      try { url = String(JSON.parse(body).url || ""); } catch {}
      if (!/^https?:\/\/\S+$/.test(url)) {
        send({ error: "Enter a full address starting with http:// or https://" });
        return;
      }
      execFile(
        process.execPath,
        ["--env-file=.env", "agent_v2.mjs", url],
        { timeout: 150000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout) => {
          const start = stdout.indexOf("{");
          const end = stdout.lastIndexOf("}");
          try {
            send(JSON.parse(stdout.slice(start, end + 1)));
          } catch {
            send({ error: "The agent gave no readable result." + (err ? " (" + err.message.slice(0, 200) + ")" : "") });
          }
        }
      );
    });
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => console.log("SignalForge page at http://127.0.0.1:" + PORT + "/"));