const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ quiet: true });
dotenv.config({ path: ".env.txt", override: false, quiet: true });

const {
  TELEGRAM_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  ADMIN_CHAT_ID,
  WEBHOOK_URL,
  TELEGRAM_WEBHOOK_SECRET,
  DEFAULT_DELIVERY_FEE = "3000",
  PORT = "3000",
} = process.env;

const requiredEnv = {
  TELEGRAM_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  ADMIN_CHAT_ID,
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  throw new Error(`Missing required env vars: ${missingEnv.join(", ")}`);
}

const app = express();
app.use(express.json());

const telegram = axios.create({
  baseURL: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`,
  timeout: 15000,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sessions = new Map();
const deliveryFee = Number(DEFAULT_DELIVERY_FEE) || 3000;

const TEXT = {
  start:
    "မင်္ဂလာပါရှင့် 💄\nMagic CEO Ma Phoo Cosmetics Shop မှ ကြိုဆိုပါတယ်။\nအောက်က menu ကနေ ပစ္စည်းကြည့်ပြီး မှာယူနိုင်ပါတယ်ရှင့်။",
  products: "ပစ္စည်းအမျိုးအစား ရွေးပေးပါရှင့်။",
  loading: "ခဏလေးစောင့်ပေးပါရှင့်...",
  noProducts: "လက်ရှိ product မတွေ့သေးပါဘူးရှင့်။",
  askPhone:
    "ဖုန်းနံပါတ်ပေးပေးပါရှင့်။ Telegram contact ပို့နိုင်သလို စာနဲ့လည်း ရိုက်ပေးနိုင်ပါတယ်။",
  askAddress: "ပို့ရမယ့် လိပ်စာအပြည့်အစုံ ရိုက်ပေးပါရှင့်။",
  orderSaved:
    "အော်ဒါတင်ပြီးပါပြီရှင့်။ Admin မှ ဖုန်းဆက်ပြီး အတည်ပြုပေးပါမယ်။ COD နဲ့ ပစ္စည်းရောက်မှ ငွေချေပေးရပါမယ်ရှင့်။",
  cancelled: "အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီရှင့်။",
  unknown:
    "နားလည်အောင် မဖမ်းမိသေးပါဘူးရှင့်။ ပစ္စည်းကြည့်ရန် /start ကိုနှိပ်နိုင်ပါတယ်။",
};

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🛍 ပစ္စည်းများ", callback_data: "products" }],
      [{ text: "🚚 မှာယူပုံ / COD", callback_data: "help_order" }],
      [{ text: "☎️ Admin ဆက်သွယ်ရန်", callback_data: "contact_admin" }],
    ],
  };
}

function productActionsKeyboard(productId) {
  return {
    inline_keyboard: [
      [{ text: "မှာယူမယ်", callback_data: `order:${productId}` }],
      [
        { text: "အသုံးပြုပုံ", callback_data: `usage:${productId}` },
        { text: "ကောင်းကျိုး", callback_data: `benefits:${productId}` },
      ],
      [{ text: "နောက်သို့", callback_data: "products" }],
    ],
  };
}

function quantityKeyboard(productId) {
  return {
    inline_keyboard: [
      [
        { text: "1", callback_data: `qty:${productId}:1` },
        { text: "2", callback_data: `qty:${productId}:2` },
        { text: "3", callback_data: `qty:${productId}:3` },
      ],
      [
        { text: "5", callback_data: `qty:${productId}:5` },
        { text: "10", callback_data: `qty:${productId}:10` },
      ],
      [{ text: "မလုပ်တော့ပါ", callback_data: "cancel" }],
    ],
  };
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: "ဖုန်းနံပါတ်ပို့မယ်", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function confirmKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "အတည်ပြုမယ်", callback_data: "confirm_order" }],
      [{ text: "မလုပ်တော့ပါ", callback_data: "cancel" }],
    ],
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

async function sendMessage(chatId, text, options = {}) {
  return telegram.post("/sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...options,
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return telegram.post("/answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

function money(value) {
  return `${Number(value || 0).toLocaleString("en-US")} Ks`;
}

function cleanHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function productTitle(product) {
  const unit = product.unit ? ` / ${product.unit}` : "";
  return `${product.name} - ${money(product.price)}${unit}`;
}

function formatProduct(product) {
  const freeDeliveryQty = Number(product.free_delivery_qty || 0);
  const freeText =
    freeDeliveryQty > 0
      ? `\n🚚 ${freeDeliveryQty} ခုနှင့်အထက် Free Delivery`
      : "";
  const stockText =
    product.stock === null || product.stock === undefined
      ? ""
      : `\n📦 Stock: ${product.stock}`;

  return [
    `<b>${cleanHtml(product.name)}</b>`,
    product.category ? `Category: ${cleanHtml(product.category)}` : "",
    `စျေးနှုန်း: <b>${money(product.price)}</b>${
      product.unit ? ` / ${cleanHtml(product.unit)}` : ""
    }`,
    freeText.trim(),
    stockText.trim(),
    product.description ? `\n${cleanHtml(product.description)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatUsage(product) {
  return product.usage_instruction
    ? `<b>${cleanHtml(product.name)} အသုံးပြုပုံ</b>\n${cleanHtml(
        product.usage_instruction
      )}`
    : "ဒီ product အတွက် အသုံးပြုပုံကို မကြာခင် ထည့်ပေးပါမယ်ရှင့်။";
}

function formatBenefits(product) {
  return product.benefits
    ? `<b>${cleanHtml(product.name)} ကောင်းကျိုးများ</b>\n${cleanHtml(
        product.benefits
      )}`
    : "ဒီ product အတွက် ကောင်းကျိုးစာသားကို မကြာခင် ထည့်ပေးပါမယ်ရှင့်။";
}

function calculateOrder(product, quantity) {
  const subtotal = Number(product.price || 0) * quantity;
  const freeDeliveryQty = Number(product.free_delivery_qty || 0);
  const isFreeDelivery = freeDeliveryQty > 0 && quantity >= freeDeliveryQty;
  const fee = isFreeDelivery ? 0 : deliveryFee;

  return {
    subtotal,
    deliveryFee: fee,
    total: subtotal + fee,
    isFreeDelivery,
  };
}

function formatOrderSummary(session) {
  const { product, quantity, phone, address } = session;
  const totals = calculateOrder(product, quantity);

  return [
    "<b>အော်ဒါအချက်အလက်</b>",
    `ပစ္စည်း: ${cleanHtml(product.name)}`,
    `အရေအတွက်: ${quantity}`,
    `Subtotal: ${money(totals.subtotal)}`,
    `Delivery: ${
      totals.isFreeDelivery ? "Free Delivery" : money(totals.deliveryFee)
    }`,
    `စုစုပေါင်း: <b>${money(totals.total)}</b>`,
    "Payment: COD - ပစ္စည်းရောက်မှ ငွေချေ",
    phone ? `ဖုန်း: ${cleanHtml(phone)}` : "",
    address ? `လိပ်စာ: ${cleanHtml(address)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getProduct(productId) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (error) throw error;
  return data;
}

async function insertAdaptive(table, payload) {
  const workingPayload = { ...payload };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .insert(workingPayload)
      .select("*")
      .single();

    if (!error) {
      return { data, removedColumns };
    }

    const missingColumn = error.message.match(/'([^']+)' column/)?.[1];
    if (missingColumn && Object.hasOwn(workingPayload, missingColumn)) {
      delete workingPayload[missingColumn];
      removedColumns.push(missingColumn);
      continue;
    }

    throw error;
  }

  throw new Error(`Could not insert ${table}: too many schema retries`);
}

async function saveOrder(chat, from, session) {
  const totals = calculateOrder(session.product, session.quantity);
  const customerName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const now = new Date().toISOString();

  const orderPayload = {
    telegram_user_id: from.id,
    telegram_chat_id: chat.id,
    telegram_username: from.username || null,
    customer_name: customerName || from.username || String(from.id),
    customer_phone: session.phone,
    phone: session.phone,
    delivery_address: session.address,
    address: session.address,
    payment_method: "COD",
    status: "pending",
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    total_amount: totals.total,
    total: totals.total,
    note: totals.isFreeDelivery ? "Free delivery applied" : null,
    created_at: now,
  };

  const { data: order } = await insertAdaptive("orders", orderPayload);
  const orderId = order.id;

  const itemPayload = {
    order_id: orderId,
    product_id: session.product.id,
    product_name: session.product.name,
    quantity: session.quantity,
    unit_price: Number(session.product.price || 0),
    price: Number(session.product.price || 0),
    subtotal: totals.subtotal,
    total_price: totals.subtotal,
    created_at: now,
  };

  await insertAdaptive("order_items", itemPayload);
  return { order, totals };
}

async function notifyAdmin(order, totals, session, from) {
  const username = from.username ? `@${from.username}` : "No username";
  const message = [
    "<b>New COD Order</b>",
    `Order ID: ${cleanHtml(order.id)}`,
    `Customer: ${cleanHtml(order.customer_name || from.first_name || "")}`,
    `Telegram: ${cleanHtml(username)} (${from.id})`,
    `Phone: ${cleanHtml(session.phone)}`,
    `Address: ${cleanHtml(session.address)}`,
    "",
    `Product: ${cleanHtml(session.product.name)}`,
    `Qty: ${session.quantity}`,
    `Subtotal: ${money(totals.subtotal)}`,
    `Delivery: ${totals.isFreeDelivery ? "Free" : money(totals.deliveryFee)}`,
    `Total: ${money(totals.total)}`,
  ].join("\n");

  await sendMessage(ADMIN_CHAT_ID, message);
}

async function showCategories(chatId) {
  const products = await getProducts();
  if (products.length === 0) {
    await sendMessage(chatId, TEXT.noProducts);
    return;
  }

  const categories = [...new Set(products.map((item) => item.category || "Other"))];
  await sendMessage(chatId, TEXT.products, {
    reply_markup: {
      inline_keyboard: categories.map((category) => [
        { text: category, callback_data: `cat:${category}` },
      ]),
    },
  });
}

async function showProductsByCategory(chatId, category) {
  const products = (await getProducts()).filter(
    (product) => (product.category || "Other") === category
  );

  await sendMessage(chatId, `ရွေးထားသော category: ${cleanHtml(category)}`, {
    reply_markup: {
      inline_keyboard: [
        ...products.map((product) => [
          { text: productTitle(product), callback_data: `product:${product.id}` },
        ]),
        [{ text: "နောက်သို့", callback_data: "products" }],
      ],
    },
  });
}

async function showProduct(chatId, productId) {
  const product = await getProduct(productId);
  await sendMessage(chatId, formatProduct(product), {
    reply_markup: productActionsKeyboard(product.id),
  });
}

function setSession(chatId, session) {
  sessions.set(String(chatId), {
    ...session,
    updatedAt: Date.now(),
  });
}

function getSession(chatId) {
  return sessions.get(String(chatId));
}

function clearSession(chatId) {
  sessions.delete(String(chatId));
}

async function handleStart(chatId) {
  clearSession(chatId);
  await sendMessage(chatId, TEXT.start, {
    reply_markup: mainMenuKeyboard(),
  });
}

async function handleHelpOrder(chatId) {
  await sendMessage(
    chatId,
    [
      "<b>မှာယူပုံ</b>",
      "1. ပစ္စည်းရွေးပါ",
      "2. အရေအတွက်ရွေးပါ",
      "3. ဖုန်းနံပါတ်နှင့် လိပ်စာပေးပါ",
      "4. Admin မှ အတည်ပြုပြီး ပို့ဆောင်ပေးပါမယ်",
      "",
      "Payment: COD - ပစ္စည်းရောက်မှ ငွေချေပေးပါရှင့်။",
      "Free Delivery: Product တစ်ခုချင်းစီမှာ သတ်မှတ်ထားတဲ့ အရေအတွက်ပြည့်ရင် အလိုအလျောက်တွက်ပေးပါတယ်။",
    ].join("\n")
  );
}

async function handleContactAdmin(chatId) {
  await sendMessage(
    chatId,
    "Admin ကို ဒီ chat ထဲမှာ မေးချင်တာ ရိုက်ပေးနိုင်ပါတယ်ရှင့်။ Order တင်ပြီးရင်လည်း Admin က ပြန်ဆက်သွယ်ပေးပါမယ်။"
  );
}

async function handleCallback(update) {
  const callback = update.callback_query;
  const chatId = callback.message.chat.id;
  const from = callback.from;
  const data = callback.data;

  await answerCallbackQuery(callback.id, "");

  if (data === "products") {
    await showCategories(chatId);
    return;
  }

  if (data === "help_order") {
    await handleHelpOrder(chatId);
    return;
  }

  if (data === "contact_admin") {
    await handleContactAdmin(chatId);
    return;
  }

  if (data === "cancel") {
    clearSession(chatId);
    await sendMessage(chatId, TEXT.cancelled, { reply_markup: removeKeyboard() });
    return;
  }

  if (data.startsWith("cat:")) {
    await showProductsByCategory(chatId, data.slice(4));
    return;
  }

  if (data.startsWith("product:")) {
    await showProduct(chatId, data.slice(8));
    return;
  }

  if (data.startsWith("usage:")) {
    const product = await getProduct(data.slice(6));
    await sendMessage(chatId, formatUsage(product), {
      reply_markup: productActionsKeyboard(product.id),
    });
    return;
  }

  if (data.startsWith("benefits:")) {
    const product = await getProduct(data.slice(9));
    await sendMessage(chatId, formatBenefits(product), {
      reply_markup: productActionsKeyboard(product.id),
    });
    return;
  }

  if (data.startsWith("order:")) {
    const product = await getProduct(data.slice(6));
    setSession(chatId, {
      step: "quantity",
      product,
      from,
    });
    await sendMessage(chatId, "အရေအတွက်ရွေးပေးပါရှင့်။", {
      reply_markup: quantityKeyboard(product.id),
    });
    return;
  }

  if (data.startsWith("qty:")) {
    const [, productId, quantityText] = data.split(":");
    const product = await getProduct(productId);
    const quantity = Number(quantityText);

    setSession(chatId, {
      step: "phone",
      product,
      quantity,
      from,
    });

    await sendMessage(chatId, TEXT.askPhone, {
      reply_markup: contactKeyboard(),
    });
    return;
  }

  if (data === "confirm_order") {
    const session = getSession(chatId);
    if (!session || session.step !== "confirm") {
      await sendMessage(chatId, "အော်ဒါအချက်အလက် မတွေ့တော့ပါဘူးရှင့်။ /start မှ ပြန်စပါနော်။");
      return;
    }

    const { order, totals } = await saveOrder(callback.message.chat, from, session);
    await notifyAdmin(order, totals, session, from);
    clearSession(chatId);
    await sendMessage(chatId, TEXT.orderSaved, { reply_markup: removeKeyboard() });
    return;
  }

  await sendMessage(chatId, TEXT.unknown);
}

function looksLikePhone(text) {
  return /^[+\d\s().-]{6,}$/.test(text.trim());
}

async function answerBurmeseQuestion(chatId, text) {
  const normalized = text.toLowerCase();

  if (text.includes("cod") || text.includes("ငွေ") || text.includes("ချေ")) {
    await sendMessage(
      chatId,
      "COD နဲ့ ပစ္စည်းရောက်မှ ငွေချေပေးရပါတယ်ရှင့်။ Order တင်ပြီးရင် Admin က ဖုန်းဆက်အတည်ပြုပေးပါမယ်။"
    );
    return true;
  }

  if (text.includes("ပို့") || text.includes("delivery") || text.includes("free")) {
    await sendMessage(
      chatId,
      "Delivery fee ကို အော်ဒါအတည်ပြုချိန်မှာ တွက်ပေးပါတယ်ရှင့်။ Product မှာ သတ်မှတ်ထားတဲ့ free delivery အရေအတွက်ပြည့်ရင် delivery free ဖြစ်ပါတယ်။"
    );
    return true;
  }

  if (
    text.includes("အသုံး") ||
    text.includes("လိမ်း") ||
    text.includes("သုံး") ||
    normalized.includes("use")
  ) {
    await sendMessage(
      chatId,
      "Product တစ်ခုချင်းစီမှာ “အသုံးပြုပုံ” button ကိုနှိပ်ပြီး ကြည့်နိုင်ပါတယ်ရှင့်။"
    );
    return true;
  }

  if (
    text.includes("ကောင်း") ||
    text.includes("အကျိုး") ||
    normalized.includes("benefit")
  ) {
    await sendMessage(
      chatId,
      "Product တစ်ခုချင်းစီမှာ “ကောင်းကျိုး” button ကိုနှိပ်ပြီး ဖတ်နိုင်ပါတယ်ရှင့်။"
    );
    return true;
  }

  if (text.includes("စျေး") || text.includes("ဈေး") || normalized.includes("price")) {
    await showCategories(chatId);
    return true;
  }

  return false;
}

async function handleMessage(update) {
  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text?.trim();
  const session = getSession(chatId);

  if (text === "/start") {
    await handleStart(chatId);
    return;
  }

  if (text === "/products") {
    await showCategories(chatId);
    return;
  }

  if (text === "/cancel") {
    clearSession(chatId);
    await sendMessage(chatId, TEXT.cancelled, { reply_markup: removeKeyboard() });
    return;
  }

  if (session?.step === "phone") {
    const phone = message.contact?.phone_number || text;
    if (!phone || (!message.contact && !looksLikePhone(phone))) {
      await sendMessage(chatId, "ဖုန်းနံပါတ်ကို မှန်မှန်ကန်ကန် ရိုက်ပေးပါရှင့်။");
      return;
    }

    setSession(chatId, {
      ...session,
      step: "address",
      phone,
    });
    await sendMessage(chatId, TEXT.askAddress, { reply_markup: removeKeyboard() });
    return;
  }

  if (session?.step === "address") {
    if (!text || text.length < 8) {
      await sendMessage(chatId, "လိပ်စာကို နည်းနည်းပိုပြည့်စုံအောင် ရိုက်ပေးပါရှင့်။");
      return;
    }

    const nextSession = {
      ...session,
      step: "confirm",
      address: text,
    };
    setSession(chatId, nextSession);
    await sendMessage(chatId, formatOrderSummary(nextSession), {
      reply_markup: confirmKeyboard(),
    });
    return;
  }

  if (text && (await answerBurmeseQuestion(chatId, text))) {
    return;
  }

  await sendMessage(chatId, TEXT.unknown, {
    reply_markup: mainMenuKeyboard(),
  });
}

async function handleUpdate(update) {
  try {
    if (update.callback_query) {
      await handleCallback(update);
      return;
    }

    if (update.message) {
      await handleMessage(update);
    }
  } catch (error) {
    const chatId =
      update.message?.chat?.id || update.callback_query?.message?.chat?.id || ADMIN_CHAT_ID;
    console.error("Update handling failed", error);
    await sendMessage(
      chatId,
      "တောင်းပန်ပါတယ်ရှင့်။ System error ဖြစ်သွားပါတယ်။ Admin ကို အကြောင်းကြားထားပါတယ်။"
    ).catch(() => {});
    await sendMessage(
      ADMIN_CHAT_ID,
      `<b>Bot error</b>\n${cleanHtml(error.message || String(error))}`
    ).catch(() => {});
  }
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Magic CEO Ma Phoo Telegram Shop Bot",
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/telegram/webhook", async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const secret = req.get("x-telegram-bot-api-secret-token");
    if (secret !== TELEGRAM_WEBHOOK_SECRET) {
      res.status(401).json({ ok: false });
      return;
    }
  }

  res.sendStatus(200);
  await handleUpdate(req.body);
});

async function setupWebhook() {
  if (!WEBHOOK_URL) return;

  const webhookUrl = `${WEBHOOK_URL.replace(/\/$/, "")}/telegram/webhook`;
  await telegram.post("/setWebhook", {
    url: webhookUrl,
    secret_token: TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "callback_query"],
  });
  console.log(`Telegram webhook set: ${webhookUrl}`);
}

function startServer() {
  return app.listen(Number(PORT), async () => {
    console.log(`Bot server listening on port ${PORT}`);
    try {
      await setupWebhook();
    } catch (error) {
      console.error("Webhook setup failed", error.message);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  calculateOrder,
  formatOrderSummary,
  startServer,
};
