import { getStore } from "@netlify/blobs";

const TOKEN = process.env.BOT_TOKEN;
const EM = ["❤️", "🔥", "😂", "😱"];
const J = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const key = (n) => "p-" + String(n).padStart(7, "0");

export default async (req) => {
  const store = getStore("posts");
  const url = new URL(req.url);

  // Голос за реакцию
  if (req.method === "POST") {
    const { n, emoji } = await req.json().catch(() => ({}));
    if (!EM.includes(emoji) || !Number.isInteger(n)) return J({ error: "bad request" }, 400);
    const p = await store.get(key(n), { type: "json" });
    if (!p) return J({ error: "not found" }, 404);
    p.r[emoji] = (p.r[emoji] || 0) + 1;
    await store.setJSON(key(n), p);
    return J({ r: p.r });
  }

  // Фото поста (токен бота не попадает в браузер)
  const ph = url.searchParams.get("photo");
  if (ph) {
    const p = await store.get(key(Number(ph)), { type: "json" });
    if (!p || !p.photo) return new Response("no photo", { status: 404 });
    const f = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${p.photo}`).then((r) => r.json());
    if (!f.ok) return new Response("error", { status: 502 });
    const img = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.result.file_path}`);
    return new Response(img.body, {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" },
    });
  }

  // Список постов (последние 100)
  const { blobs } = await store.list();
  const keys = blobs.map((b) => b.key).sort().slice(-100).reverse();
  const all = await Promise.all(keys.map((k) => store.get(k, { type: "json" })));
  return J(all.filter(Boolean).map((p) => ({ n: p.n, text: p.text, tag: p.tag, ts: p.ts, r: p.r, photo: !!p.photo })));
};

export const config = { path: "/api/posts" };
