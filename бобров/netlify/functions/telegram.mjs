import { getStore } from "@netlify/blobs";

const TOKEN = process.env.BOT_TOKEN;
const ADMIN = String(process.env.ADMIN_ID);
const SECRET = process.env.WEBHOOK_SECRET;
const TAGS = ["признания", "слухи", "вопросы", "знакомства"];

const tg = (method, body) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export default async (req) => {
  if (req.method !== "POST") return new Response("Webhook OK");
  if (SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== SECRET)
    return new Response("forbidden", { status: 403 });
  const u = await req.json().catch(() => ({}));
  try {
    if (u.callback_query) await onCallback(u.callback_query);
    else if (u.message) await onMessage(u.message);
  } catch (e) {
    console.error(e);
  }
  return new Response("ok");
};

async function onMessage(m) {
  if (m.chat.type !== "private") return;
  const chat = m.chat.id;
  const text = (m.text || m.caption || "").trim();
  if (text === "/start")
    return tg("sendMessage", {
      chat_id: chat,
      text: "👋 Привет! Пришли текст или фото — после проверки модератором оно появится анонимно на сайте Anonim Manas.\n\nТеги: #признания #слухи #вопросы #знакомства",
    });
  const photo = m.photo ? m.photo[m.photo.length - 1].file_id : null;
  if (!text && !photo)
    return tg("sendMessage", { chat_id: chat, text: "Отправь текст или фото 🙂" });
  if (text.length > 2000)
    return tg("sendMessage", { chat_id: chat, text: "Слишком длинно (максимум 2000 символов)." });

  const id = `${chat}-${m.message_id}`;
  const tag =
    (text.match(/#([\p{L}\d_]+)/gu) || [])
      .map((t) => t.slice(1).toLowerCase())
      .find((t) => TAGS.includes(t)) || "";
  await getStore("pending").setJSON(id, { text, photo, tag, chat });

  const kb = {
    inline_keyboard: [[
      { text: "✅ Опубликовать", callback_data: "ok:" + id },
      { text: "❌ Отклонить", callback_data: "no:" + id },
    ]],
  };
  const head = `📨 Новое сообщение${tag ? " #" + tag : ""}\n\n`;
  if (photo)
    await tg("sendPhoto", { chat_id: ADMIN, photo, caption: (head + text).slice(0, 1024), reply_markup: kb });
  else await tg("sendMessage", { chat_id: ADMIN, text: head + text, reply_markup: kb });
  await tg("sendMessage", { chat_id: chat, text: "✅ Отправлено на модерацию. Мы не храним, кто ты." });
}

async function onCallback(c) {
  const answer = (text) => tg("answerCallbackQuery", { callback_query_id: c.id, text });
  if (String(c.from.id) !== ADMIN) return answer("Нет доступа");
  if (c.data === "noop") return answer("");
  const i = c.data.indexOf(":");
  const act = c.data.slice(0, i);
  const id = c.data.slice(i + 1);

  const pend = getStore("pending");
  const p = await pend.get(id, { type: "json" });
  if (!p) return answer("Уже обработано");

  let label;
  if (act === "ok") {
    const meta = getStore("meta");
    const n = ((await meta.get("n", { type: "json" })) || 0) + 1;
    await meta.setJSON("n", n);
    await getStore("posts").setJSON("p-" + String(n).padStart(7, "0"), {
      n, text: p.text, photo: p.photo, tag: p.tag, ts: Date.now(), r: {},
    });
    label = `✅ Опубликовано №${n}`;
    await tg("sendMessage", { chat_id: p.chat, text: `🎉 Твоё сообщение опубликовано (№${n}).` });
  } else {
    label = "❌ Отклонено";
    await tg("sendMessage", { chat_id: p.chat, text: "Модератор не пропустил это сообщение." });
  }
  await pend.delete(id); // связь с автором удаляется сразу
  await answer(label);
  await tg("editMessageReplyMarkup", {
    chat_id: c.message.chat.id,
    message_id: c.message.message_id,
    reply_markup: { inline_keyboard: [[{ text: label, callback_data: "noop" }]] },
  });
}

export const config = { path: "/api/telegram" };
