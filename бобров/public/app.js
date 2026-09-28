const TAGS = ["признания", "слухи", "вопросы", "знакомства"];
const EM = ["❤️", "🔥", "😂", "😱"];
let posts = [], tag = "all", q = "";
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let voted = {};
try { voted = JSON.parse(localStorage.getItem("v") || "{}"); } catch (e) {}

function ago(t) {
  const m = Math.floor((Date.now() - t) / 6e4);
  if (m < 1) return "только что";
  if (m < 60) return m + " мин назад";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " ч назад";
  return new Date(t).toLocaleDateString("ru");
}

function renderTags() {
  $("#tags").innerHTML = ["all", ...TAGS]
    .map((t) => `<button data-t="${t}" class="${t === tag ? "on" : ""}">${t === "all" ? "Все" : "#" + t}</button>`)
    .join("");
}

function render() {
  const list = posts.filter((p) => (tag === "all" || p.tag === tag) && (!q || p.text.toLowerCase().includes(q)));
  $("#feed").innerHTML = list.length
    ? list.map((p) => `
    <article class="post glass">
      <div class="top"><div class="ava">🕶️</div>
        <div><span class="num">Пост №${p.n}</span><small>${ago(p.ts)}${p.tag ? " • #" + p.tag : ""}</small></div></div>
      <div class="text">${esc(p.text).replace(/#([\p{L}\d_]+)/gu, "<span>#$1</span>")}</div>
      ${p.photo ? `<img loading="lazy" alt="" src="/api/posts?photo=${p.n}">` : ""}
      <div class="react">${EM.map((e) => `<button data-n="${p.n}" data-e="${e}" class="${voted[p.n + e] ? "on" : ""}">${e} ${(p.r && p.r[e]) || 0}</button>`).join("")}</div>
    </article>`).join("")
    : `<div class="empty">Пока пусто 🤷 Напиши боту первым!</div>`;
}

async function load() {
  try {
    posts = await (await fetch("/api/posts")).json();
    render();
  } catch (e) {}
}

$("#tags").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  tag = b.dataset.t; renderTags(); render();
};
$("#search").oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
$("#feed").onclick = async (e) => {
  const b = e.target.closest(".react button");
  if (!b) return;
  const n = +b.dataset.n, emoji = b.dataset.e, k = n + emoji;
  if (voted[k]) return;
  voted[k] = 1;
  try { localStorage.setItem("v", JSON.stringify(voted)); } catch (e) {}
  const p = posts.find((x) => x.n === n);
  p.r = p.r || {}; p.r[emoji] = (p.r[emoji] || 0) + 1; render();
  fetch("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n, emoji }) });
};

renderTags(); load(); setInterval(load, 30000);
