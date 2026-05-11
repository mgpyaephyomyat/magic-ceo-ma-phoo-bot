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
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324",
  WEBHOOK_URL,
  TELEGRAM_WEBHOOK_SECRET,
  USE_POLLING = "false",
  POLLING_DROP_PENDING = "false",
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

const openRouter = axios.create({
  baseURL: "https://openrouter.ai/api/v1",
  timeout: 30000,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sessions = new Map();
const deliveryFee = Number(DEFAULT_DELIVERY_FEE) || 3000;
let pollingActive = false;

const PRODUCT_MENU_ORDER = [
  "BodyWash",
  "Shampoo",
  "HairMask",
  "Hair Oil",
  "Whitening Soap",
  "Toothpaste Set",
  "Acne Face Wash",
  "Pore Tightening Toner",
  "Detox Essence",
];

const YANGON_ALIASES = [
  "ရန်ကုန်",
  "yangon",
  "သင်္ဃန်းကျွန်း",
  "တောင်ဥက္ကလာ",
  "မြောက်ဥက္ကလာ",
  "သာကေတ",
  "ဒဂုံ",
  "အင်းစိန်",
  "လှိုင်",
  "မရမ်းကုန်း",
  "တာမွေ",
  "စမ်းချောင်း",
  "ကမာရွတ်",
  "ရန်ကင်း",
  "ဗဟန်း",
];

const MANDALAY_ALIASES = [
  "မန္တလေး",
  "mandalay",
  "ချမ်းအေးသာဇံ",
  "ချမ်းမြသာစည်",
  "မဟာအောင်မြေ",
  "အောင်မြေသာဇံ",
  "ပြည်ကြီးတံခွန်",
  "အမရပူရ",
  "ပုသိမ်ကြီး",
];

const NAYPYITAW_ALIASES = [
  "နေပြည်တော်",
  "naypyitaw",
  "nay pyi taw",
  "ပျဉ်းမနား",
  "ဇမ္ဗူသီရိ",
  "ဒက္ခိဏသီရိ",
  "ဥတ္တရသီရိ",
  "ပုဗ္ဗသီရိ",
  "ဇေယျာသီရိ",
  "လယ်ဝေး",
  "တပ်ကုန်း",
];

const TACHILEIK_ALIASES = ["တာချီလိတ်", "tachileik", "tachilek"];

const REGION_4800_ALIASES = [
  ...YANGON_ALIASES,
  ...MANDALAY_ALIASES,
  ...NAYPYITAW_ALIASES,
];

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
    "အော်ဒါတင်ပြီးပါပြီရှင့်။ Admin မှ ဖုန်းဆက်ပြီး အတည်ပြုပေးပါမယ်။ အိမ်ရောက်ငွေချေ ရတဲ့မြို့တွေမှာ ပစ္စည်းရောက်မှ ငွေချေပေးရပါမယ်ရှင့်။",
  cancelled: "အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီရှင့်။",
  unknown:
    "နားလည်အောင် မဖမ်းမိသေးပါဘူးရှင့်။ ပစ္စည်းကြည့်ရန် /start ကိုနှိပ်နိုင်ပါတယ်။",
};

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🛍 ပစ္စည်းများ", callback_data: "products" }],
      [{ text: "🚚 မှာယူပုံ / ငွေချေမှု", callback_data: "help_order" }],
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
      [{ text: "ပစ္စည်းများ", callback_data: "products" }],
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

async function sendPhoto(chatId, photo, options = {}) {
  return telegram.post("/sendPhoto", {
    chat_id: chatId,
    photo,
    parse_mode: "HTML",
    ...options,
  });
}

function getAdminChatIds() {
  return String(ADMIN_CHAT_ID || "")
    .split(",")
    .map((chatId) => chatId.trim())
    .filter(Boolean)
    .filter((chatId) => {
      const isNumeric = /^-?\d+$/.test(chatId);
      if (!isNumeric) {
        console.error("ADMIN_CHAT_ID must be numeric, not username:", chatId);
      }
      return isNumeric;
    });
}

async function sendAdminMessage(text) {
  const adminChatIds = getAdminChatIds();
  if (adminChatIds.length === 0) {
    throw new Error("ADMIN_CHAT_ID is empty");
  }

  const results = await Promise.allSettled(
    adminChatIds.map((chatId) => sendMessage(chatId, text))
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length === results.length) {
    const reason = failures[0]?.reason;
    throw new Error(
      reason?.response?.data?.description || reason?.message || "Admin notification failed"
    );
  }

  for (const failure of failures) {
    console.error(
      "Admin notification failed for one chat",
      failure.reason?.response?.data?.description || failure.reason?.message
    );
  }
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

function shortText(value, maxLength = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function freeDeliveryText(product) {
  const freeDeliveryQty = normalizeText(product.name).includes("bodywash")
    ? 4
    : Number(product.free_delivery_qty || 0);
  return freeDeliveryQty > 0
    ? `${freeDeliveryQty} ခုနှင့်အထက် Free Delivery`
    : "Free delivery သတ်မှတ်ချက် မရှိသေးပါ";
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

function formatProductPhotoCaption(product) {
  const benefits = shortText(product.benefits || product.description, 120);
  const usage = shortText(product.usage_instruction, 120);

  return [
    `<b>${cleanHtml(product.name)}</b>`,
    `စျေးနှုန်း: <b>${money(product.price)}</b>${
      product.unit ? ` / ${cleanHtml(product.unit)}` : ""
    }`,
    `ပို့ခ: ${cleanHtml(freeDeliveryText(product))}`,
    benefits ? `အကျိုးကျေးဇူး: ${cleanHtml(benefits)}` : "",
    usage ? `အသုံးပြုပုံ: ${cleanHtml(usage)}` : "",
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
  const zoneDeliveryFee =
    arguments.length > 2 && arguments[2] && Number.isFinite(Number(arguments[2].delivery_fee))
      ? Number(arguments[2].delivery_fee)
      : deliveryFee;
  const fee = isFreeDelivery ? 0 : zoneDeliveryFee;

  return {
    subtotal,
    deliveryFee: fee,
    total: subtotal + fee,
    isFreeDelivery,
  };
}

function formatLegacyOrderSummary(session) {
  const { product, quantity, phone, address } = session;
  const totals = calculateOrder(product, quantity);

  return [
    "<b>အော်ဒါအချက်အလက်</b>",
    `ပစ္စည်း: ${cleanHtml(product.name)}`,
    `အရေအတွက်: ${quantity}`,
    `Subtotal: ${money(totals.subtotal)}`,
    `ပို့ခ: ${
      totals.isFreeDelivery ? "Free Delivery" : money(totals.deliveryFee)
    }`,
    `စုစုပေါင်း: <b>${money(totals.total)}</b>`,
    "ငွေချေမှု: အိမ်ရောက်ငွေချေ",
    phone ? `ဖုန်း: ${cleanHtml(phone)}` : "",
    address ? `လိပ်စာ: ${cleanHtml(address)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatBasicOrderSummary(session) {
  const { product, quantity, customerName, phone, address } = session;
  const totals = calculateOrder(product, quantity);

  return [
    "<b>Order Summary</b>",
    `Product: ${cleanHtml(product.name)}`,
    `Quantity: ${quantity}`,
    `Subtotal: ${money(totals.subtotal)}`,
    `Delivery fee: ${
      totals.isFreeDelivery ? "Free Delivery" : money(totals.deliveryFee)
    }`,
    `Total: <b>${money(totals.total)}</b>`,
    "ငွေချေမှု: အိမ်ရောက်ငွေချေ",
    customerName ? `Customer name: ${cleanHtml(customerName)}` : "",
    phone ? `Phone: ${cleanHtml(phone)}` : "",
    address ? `Address: ${cleanHtml(address)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatOrderSummary(session) {
  const { customerName, phone, address, city, deliveryInfo } = session;
  const items = getSessionItems(session);
  const totals = calculateCart(items, deliveryInfo);
  const codStatus = getCodLabel(deliveryInfo);
  const paymentMethod = getPaymentLabel(deliveryInfo);
  const itemLines = items.map(
    (item, index) =>
      `${index + 1}. ${cleanHtml(item.product_name)} x${item.quantity} = ${money(item.subtotal)}`
  );

  return [
    "<b>🛒 Order Summary</b>",
    ...itemLines,
    "",
    `Subtotal: ${money(totals.subtotal)}`,
    totals.freeDeliveryReason ? cleanHtml(totals.freeDeliveryReason) : "",
    `ပို့ခ: ${
      totals.deliveryFee === null
        ? "Admin confirm"
        : totals.isFreeDelivery
          ? "Free"
          : money(totals.deliveryFee)
    }`,
    `စုစုပေါင်း: <b>${totals.deliveryFee === null ? "Admin confirm" : money(totals.total)}</b>`,
    `ငွေချေမှု: ${cleanHtml(paymentMethod)}`,
    `အိမ်ရောက်ငွေချေ: ${cleanHtml(codStatus)}`,
    "",
    "<b>Customer</b>",
    customerName ? `Customer name: ${cleanHtml(customerName)}` : "",
    phone ? `Phone: ${cleanHtml(phone)}` : "",
    city ? `City/Township: ${cleanHtml(city)}` : "",
    address ? `Address: ${cleanHtml(address)}` : "",
    !deliveryInfo ? "Note: Delivery နဲ့ ငွေချေမှုကို Admin က confirm လုပ်ပေးပါမယ်ရှင့်။" : "",
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

async function getDeliveryZones() {
  const { data, error } = await supabase.from("delivery_zones").select("*");
  if (error) {
    console.error("delivery_zones unavailable", error.message);
    return [];
  }
  return data || [];
}

function zoneSearchText(zone) {
  const aliases = Array.isArray(zone.aliases)
    ? zone.aliases.join(" ")
    : String(zone.aliases || "");
  return normalizeText(`${zone.city || ""} ${zone.township || ""} ${aliases}`);
}

function zoneTokens(zone) {
  const aliases = Array.isArray(zone.aliases) ? zone.aliases : String(zone.aliases || "").split(",");
  const base = [zone.city, zone.township, ...aliases];
  const normalizedBase = normalizeText(base.join(" "));
  const builtInAliases = [];

  if (YANGON_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
    builtInAliases.push(...YANGON_ALIASES);
  }
  if (MANDALAY_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
    builtInAliases.push(...MANDALAY_ALIASES);
  }
  if (NAYPYITAW_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
    builtInAliases.push(...NAYPYITAW_ALIASES);
  }
  if (TACHILEIK_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
    builtInAliases.push(...TACHILEIK_ALIASES);
  }

  return [...base, ...builtInAliases]
    .map((token) => normalizeText(token))
    .filter((token) => token.length >= 2);
}

function zoneHasAnyAlias(zone, aliases) {
  const haystack = zoneTokens(zone).join(" ");
  return aliases.some((alias) =>
    haystack.includes(normalizeText(alias))
  );
}

function isRegion4800(zone) {
  return zoneHasAnyAlias(zone, REGION_4800_ALIASES);
}

function isAutoCodRegion(zone) {
  return zoneHasAnyAlias(zone, [...YANGON_ALIASES, ...MANDALAY_ALIASES]);
}

function normalizeDeliveryZone(zone) {
  if (!zone) return null;
  const region4800 = isRegion4800(zone);
  const codAvailable = Boolean(isAutoCodRegion(zone) || zone.cod_available);
  const normalizedFee = region4800 ? 4800 : codAvailable ? 6000 : Number(zone.delivery_fee);

  return {
    ...zone,
    cod_available: codAvailable,
    delivery_fee: Number.isFinite(normalizedFee) ? normalizedFee : null,
    payment_method: codAvailable ? "အိမ်ရောက်ငွေချေ" : "ကြိုလွှဲငွေချေ",
  };
}

function getPaymentLabel(deliveryInfo) {
  if (!deliveryInfo) return "Admin confirm";
  return deliveryInfo.cod_available ? "အိမ်ရောက်ငွေချေ" : "ကြိုလွှဲငွေချေ";
}

function getCodLabel(deliveryInfo) {
  if (!deliveryInfo) return "Admin confirm";
  return deliveryInfo.cod_available ? "ရပါတယ်" : "မရပါ";
}

async function getDeliveryInfo(input) {
  const normalized = normalizeText(input);
  if (!normalized) return null;

  const zones = await getDeliveryZones();
  const zone =
    zones.find((zone) =>
      zoneTokens(zone).some((token) => normalized.includes(token))
    ) ||
    zones.find((zone) => {
      const haystack = zoneSearchText(zone);
      return haystack && (normalized.includes(haystack) || haystack.includes(normalized));
    }) ||
    zones.find((zone) => {
      const haystack = zoneSearchText(zone);
      return haystack
        .split(/\s+/)
        .filter((part) => part.length >= 2)
        .some((part) => normalized.includes(part));
    }) ||
    null;

  return normalizeDeliveryZone(zone);
}

async function getCustomerSession(telegramUserId) {
  const { data, error } = await supabase
    .from("customer_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (error) {
    console.error("customer_sessions unavailable", error.message);
    return null;
  }
  return data;
}

async function updateCustomerSession(telegramUserId, patch) {
  const payload = {
    telegram_user_id: telegramUserId,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("customer_sessions")
    .upsert(payload, { onConflict: "telegram_user_id" });

  if (error) {
    console.error("customer_sessions update failed", error.message);
  }
}

async function persistDraftOrder(from, session, currentIntent = "draft_order") {
  await updateCustomerSession(from.id, {
    last_product: getSessionItems(session).map((item) => item.product_name).join(", ") || null,
    last_city: session.city || session.deliveryInfo?.township || session.deliveryInfo?.city || null,
    customer_name: session.customerName || null,
    phone: session.phone || null,
    address: session.address || null,
    interests: getSessionItems(session).map((item) => item.product_name),
    current_intent: currentIntent,
    draft_order: cartDraftFromSession(session),
  });
}

function sortProductsForMenu(products) {
  return [...products].sort((left, right) => {
    const leftIndex = PRODUCT_MENU_ORDER.findIndex(
      (name) => name.toLowerCase() === String(left.name || "").toLowerCase()
    );
    const rightIndex = PRODUCT_MENU_ORDER.findIndex(
      (name) => name.toLowerCase() === String(right.name || "").toLowerCase()
    );
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    if (safeLeft !== safeRight) return safeLeft - safeRight;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
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
  const items = getSessionItems(session);
  const totals = calculateCart(items, session.deliveryInfo);
  const customerName =
    session.customerName ||
    [from.first_name, from.last_name].filter(Boolean).join(" ") ||
    from.username ||
    String(from.id);
  const now = new Date().toISOString();

  const orderPayload = {
    telegram_user_id: from.id,
    telegram_chat_id: chat.id,
    telegram_username: from.username || null,
    customer_name: customerName,
    customer_phone: session.phone,
    phone: session.phone,
    delivery_address: session.address,
    address: session.address,
    city: session.city || session.deliveryInfo?.city || null,
    payment_method: getPaymentLabel(session.deliveryInfo),
    status: session.deliveryInfo
      ? session.deliveryInfo.cod_available
        ? "pending"
        : "needs_payment"
      : "needs_review",
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    total_amount: totals.total,
    total: totals.deliveryFee === null ? null : totals.total,
    note: totals.isFreeDelivery ? "Free delivery applied" : null,
    created_at: now,
  };

  const { data: order } = await insertAdaptive("orders", orderPayload);
  const orderId = order.id;

  for (const item of items) {
    const itemPayload = {
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.price,
      price: item.price,
      subtotal: item.subtotal,
      total_price: item.subtotal,
      created_at: now,
    };

    await insertAdaptive("order_items", itemPayload);
  }
  return { order, totals };
}

async function notifyAdmin(order, totals, session, from) {
  const username = from.username ? `@${from.username}` : "No username";
  const deliveryInfo = session.deliveryInfo;
  const items = getSessionItems(session);
  const itemLines = items.map(
    (item, index) =>
      `${index + 1}. ${cleanHtml(item.product_name)} x${item.quantity} = ${money(item.subtotal)}`
  );
  const message = [
    "<b>New Order</b>",
    `Order ID: ${cleanHtml(order.id)}`,
    `Status: ${cleanHtml(order.status || "pending")}`,
    "",
    "<b>Items</b>",
    ...itemLines,
    `Subtotal: ${money(totals.subtotal)}`,
    totals.freeDeliveryReason ? cleanHtml(totals.freeDeliveryReason) : "",
    `Delivery fee: ${
      totals.deliveryFee === null ? "Admin confirm" : totals.isFreeDelivery ? "Free" : money(totals.deliveryFee)
    }`,
    `Total: ${totals.deliveryFee === null ? "Admin confirm" : money(totals.total)}`,
    `Payment: ${cleanHtml(getPaymentLabel(deliveryInfo))}`,
    `COD: ${cleanHtml(getCodLabel(deliveryInfo))}`,
    deliveryInfo?.estimated_days ? `ETA: ${cleanHtml(deliveryInfo.estimated_days)}` : "",
    deliveryInfo?.note ? `Delivery note: ${cleanHtml(deliveryInfo.note)}` : "",
    !deliveryInfo ? "Note: Unknown delivery zone. Admin must confirm fee/payment." : "",
    order.note ? `Order note: ${cleanHtml(order.note)}` : "",
    "",
    `Customer: ${cleanHtml(session.customerName || order.customer_name || "")}`,
    `Phone: ${cleanHtml(session.phone)}`,
    `City/Township: ${cleanHtml(session.city || deliveryInfo?.township || deliveryInfo?.city || "")}`,
    `Address: ${cleanHtml(session.address)}`,
    `Telegram: ${cleanHtml(username)} (${from.id})`,
  ].join("\n");

  try {
    await sendAdminMessage(message);
    return true;
  } catch (error) {
    console.error("Admin notification failed", error.message);
    return false;
  }
}

async function showCategories(chatId) {
  const products = await getProducts();
  if (products.length === 0) {
    await sendMessage(chatId, TEXT.noProducts);
    return;
  }

  const menuProducts = sortProductsForMenu(products);
  await sendMessage(chatId, "ပစ္စည်းရွေးပေးပါရှင့် 🛍", {
    reply_markup: {
      inline_keyboard: menuProducts.map((product) => [
        { text: product.name, callback_data: `product:${product.id}` },
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
  const options = {
    caption: formatProductPhotoCaption(product),
    reply_markup: productActionsKeyboard(product.id),
  };

  if (product.image_url) {
    try {
      await sendPhoto(chatId, product.image_url, options);
      return;
    } catch (error) {
      console.error("Product photo failed", error.message);
    }
  }

  await sendMessage(chatId, formatProductPhotoCaption(product), {
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

function orderInfoPrompt(session) {
  const items = getSessionItems(session);
  const itemText =
    items.length > 0
      ? items.map((item) => `${item.product_name} x${item.quantity}`).join(", ")
      : `အရေအတွက်: ${session.quantity || 1} ခု`;

  return [
    "ဟုတ်ညီမလေး🥰",
    "မဖူးကို",
    "",
    "* နာမည်",
    "* လိပ်စာ(အိမ်/လမ်းနံပတ်ပါအပါ)",
    "* Phနံပတ်",
    "",
    "လေးပေးထားပေးနော်🥰🥰",
    "",
    `Order: ${itemText}`,
  ].join("\n");
}

function parseCustomerInfo(text, product = null) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^[-*•\s]+/, "")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^(name|customer|phone|ph|address|နာမည်|ဖုန်း|လိပ်စာ)\s*[:=-]?\s*/i, "")
        .trim()
    )
    .filter(Boolean);

  const phoneIndex = lines.findIndex((line) => /(?:\+?95|09)[\d\s().-]{5,}/.test(line));
  const phoneMatch = phoneIndex >= 0 ? lines[phoneIndex].match(/(?:\+?95|09)[\d\s().-]{5,}/) : null;
  const phone = phoneMatch ? phoneMatch[0].trim() : "";
  const otherLines = lines.filter((_, index) => index !== phoneIndex);
  const rawCustomerName = phoneIndex === 0 ? "" : otherLines[0] || "";
  const customerName = product
    ? cleanCustomerNameLine(rawCustomerName, product)
    : rawCustomerName;
  const address =
    phoneIndex >= 0
      ? lines.slice(phoneIndex + 1).join(", ").trim()
      : otherLines.slice(1).join(", ").trim();

  return { customerName, address, phone };
}

function hasCustomerInfo(session) {
  return Boolean(session?.customerName && session?.address && session?.phone);
}

function isCancelText(text) {
  const normalized = normalizeText(text);
  return [
    "cancel",
    "❌ cancel",
    "မလုပ်တော့ပါ",
    "မလုပ်တော့ဘူး",
    "မလုပ်တော့ပါဘူး",
    "မယူတော့ပါ",
  ].some((keyword) => normalized === normalizeText(keyword) || normalized.includes(normalizeText(keyword)));
}

async function cancelOrder(chatId, from = null) {
  const currentSession = getSession(chatId);
  if (!currentSession) {
    await sendMessage(
      chatId,
      "ဖျက်ရန် pending order မရှိတော့ပါဘူးရှင့်။ အတည်ပြုပြီး order ဆိုရင် Admin က ကူညီစစ်ပေးပါမယ်။",
      { reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  clearSession(chatId);
  if (from?.id) {
    await updateCustomerSession(from.id, {
      current_intent: "cancelled",
      draft_order: null,
    });
  }

  await sendMessage(chatId, "Order မလုပ်တော့ပါဘူးရှင့်။ Menu ကိုပြန်သွားပါမယ်။", {
    reply_markup: mainMenuKeyboard(),
  });
}

function normalizeMyanmarDigits(value) {
  const digits = {
    "၀": "0",
    "၁": "1",
    "၂": "2",
    "၃": "3",
    "၄": "4",
    "၅": "5",
    "၆": "6",
    "၇": "7",
    "၈": "8",
    "၉": "9",
  };
  return String(value || "").replace(/[၀-၉]/g, (digit) => digits[digit] || digit);
}

function extractQuantity(text) {
  const normalized = normalizeMyanmarDigits(text);
  const parenRemoved = normalized.replace(/\([^)]*\)/g, " ");
  const matches = [...parenRemoved.matchAll(/\d+/g)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 100);
  return matches[0] || 1;
}

function productToCartItem(product, quantity = 1) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const price = Number(product.price || 0);

  return {
    product_id: product.id,
    product_name: product.name,
    quantity: safeQuantity,
    unit: product.unit || null,
    price,
    subtotal: price * safeQuantity,
    product,
  };
}

function mergeCartItems(items) {
  const map = new Map();

  for (const item of items.filter(Boolean)) {
    const key = String(item.product_id);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.subtotal = existing.price * existing.quantity;
    } else {
      map.set(key, { ...item });
    }
  }

  return [...map.values()];
}

function getSessionItems(session) {
  if (Array.isArray(session?.items) && session.items.length > 0) {
    return session.items;
  }

  if (session?.product) {
    return [productToCartItem(session.product, session.quantity || 1)];
  }

  return [];
}

function isCartFreeDelivery(items) {
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  if (items.length === 1) {
    const item = items[0];
    const productName = normalizeText(item.product_name);
    const freeDeliveryQty = productName.includes("bodywash")
      ? 4
      : Number(item.product?.free_delivery_qty || 0);
    return freeDeliveryQty > 0 && Number(item.quantity || 0) >= freeDeliveryQty;
  }

  return totalQuantity >= 3;
}

function calculateCart(items, deliveryInfo = null) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const productTypes = new Set(items.map((item) => String(item.product_id))).size;
  const isFreeDelivery = isCartFreeDelivery(items);
  const zoneFee = deliveryInfo && Number.isFinite(Number(deliveryInfo.delivery_fee))
    ? Number(deliveryInfo.delivery_fee)
    : null;
  const deliveryFee = deliveryInfo ? (isFreeDelivery ? 0 : zoneFee) : null;

  return {
    subtotal,
    deliveryFee,
    total: deliveryFee === null ? subtotal : subtotal + deliveryFee,
    totalQuantity,
    productTypes,
    isFreeDelivery,
    freeDeliveryReason: isFreeDelivery
      ? totalQuantity >= 3 && items.length > 1
        ? "၃ခုနှင့်အထက်ယူထားလို့ Deli free ရပါတယ်ရှင့် 🥰"
        : "Deli free ရပါတယ်ရှင့် 🥰"
      : "",
  };
}

function cartDraftFromSession(session) {
  const items = getSessionItems(session).map(({ product, ...item }) => item);
  const totals = calculateCart(getSessionItems(session), session.deliveryInfo);

  return {
    items,
    customer_name: session.customerName || null,
    phone: session.phone || null,
    address: session.address || null,
    city: session.city || session.deliveryInfo?.township || session.deliveryInfo?.city || null,
    delivery_fee: totals.deliveryFee,
    total: totals.deliveryFee === null ? null : totals.total,
    payment_method: getPaymentLabel(session.deliveryInfo),
    status: session.deliveryInfo
      ? session.deliveryInfo.cod_available
        ? "pending"
        : "needs_payment"
      : "needs_review",
  };
}

function getProductAliases(product) {
  const name = String(product.name || "").toLowerCase();
  const aliases = [name];

  if (name.includes("bodywash")) aliases.push("body wash", "bodywash", "ချိုး", "ရေချိုး", "ရေချိုးဆပ်ပြာ");
  if (name.includes("shampoo")) aliases.push("shampoo", "ခေါင်းလျှော်", "ခေါင်းလျှော်ရည်");
  if (name.includes("hairmask")) aliases.push("hair mask", "hairmask", "ပေါင်းဆေး");
  if (name.includes("hair oil")) aliases.push("ဆံပင်တုန်ဆီ", "တုန်ဆီ", "ဆံပင်ဆီ", "hair oil");
  if (name.includes("whitening") || name.includes("soap")) aliases.push("ဆပ်ပြာခဲ", "အသားဖြူဆပ်ပြာခဲ", "whitening soap", "soap");
  if (name.includes("toothpaste")) aliases.push("သွားတိုက်ဆေး", "toothpaste", "tooth paste", "toothpaste set", "tooth paste set");
  if (name.includes("acne")) aliases.push("မျက်နှာသစ်", "ဝက်ခြံပျောက်မျက်နှာသစ်", "ဝက်ခြံ", "face wash", "cleanser");
  if (name.includes("toner")) aliases.push("toner", "ချွေးပေါက်ကျဉ်း toner", "ချွေးပေါက်", "pore");
  if (name.includes("detox")) aliases.push("essence", "အဆိပ်ထုတ် essence", "detox", "detox essence");

  return [...new Set(aliases.filter(Boolean))];
}

function cleanCustomerNameLine(line, productOrProducts) {
  let cleaned = normalizeMyanmarDigits(line)
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:\+?95|09)[\d\s().-]{5,}/g, " ");

  const products = Array.isArray(productOrProducts) ? productOrProducts : [productOrProducts];
  for (const product of products.filter(Boolean)) {
    for (const alias of getProductAliases(product)) {
      cleaned = cleaned.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
    }
  }

  cleaned = cleaned
    .replace(/\b(x|set|ဘူး|ခု|နဲ့|ရယ်|ယူမယ်|မှာမယ်)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

async function findProductFromOrderText(text) {
  const normalized = normalizeText(text);
  const products = await getProducts();
  return products.find((product) =>
    getProductAliases(product).some((alias) => normalized.includes(normalizeText(alias)))
  );
}

async function buildOrderSessionFromText(text, from, existingSession = null) {
  const products = await getProducts();
  const existingItems = getSessionItems(existingSession);
  const extractedItems = extractCartItemsFromText(text, products);
  const items = mergeCartItems(extractedItems.length > 0 ? extractedItems : existingItems);
  const product = items[0]?.product || existingSession?.product || null;
  if (items.length === 0 || !product) return null;

  const parsed = parseCustomerInfo(
    text,
    items.map((item) => item.product)
  );
  if (!parsed.phone || !parsed.address) return null;
  const deliveryInfo = await getDeliveryInfo(`${text}\n${parsed.address}`);
  const city =
    deliveryInfo
      ? [deliveryInfo.city, deliveryInfo.township].filter(Boolean).join(" / ")
      : parsed.address.split(/[,\s]+/).find((part) => part.length > 2) || "";

  return {
    ...(existingSession || {}),
    step: "confirm",
    product,
    quantity: items[0]?.quantity || 1,
    items,
    customerName: parsed.customerName || existingSession?.customerName || from.first_name || "",
    phone: parsed.phone,
    address: parsed.address,
    city,
    deliveryInfo,
    paymentMethod: getPaymentLabel(deliveryInfo),
    from,
  };
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
      "ငွေချေမှု: အိမ်ရောက်ငွေချေ ရတဲ့မြို့တွေမှာ ပစ္စည်းရောက်မှ ငွေချေပေးပါရှင့်။",
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

  if (data === "cancel" || data === "cancel_order") {
    await cancelOrder(chatId, from);
    return;
  }

  if (data.startsWith("cat:")) {
    await showCategories(chatId);
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
    const session = {
      step: "customer_info",
      product,
      quantity: 1,
      items: [productToCartItem(product, 1)],
      from,
    };
    setSession(chatId, session);
    await sendMessage(chatId, orderInfoPrompt(session), {
      reply_markup: quantityKeyboard(product.id),
    });
    return;
  }

  if (data.startsWith("legacy_order:")) {
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
    const currentSession = getSession(chatId);
    const nextSession = {
      ...(currentSession || {}),
      step: currentSession?.step || "customer_info",
      product,
      quantity,
      items: mergeCartItems([
        ...getSessionItems(currentSession).filter(
          (item) => String(item.product_id) !== String(product.id)
        ),
        productToCartItem(product, quantity),
      ]),
      from,
    };

    if (hasCustomerInfo(nextSession)) {
      nextSession.step = "confirm";
      setSession(chatId, nextSession);
      await sendMessage(chatId, formatOrderSummary(nextSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }

    setSession(chatId, nextSession);
    await sendMessage(chatId, orderInfoPrompt(nextSession), {
      reply_markup: quantityKeyboard(product.id),
    });
    return;
  }

  if (data.startsWith("legacy_qty:")) {
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
    const adminNotified = await notifyAdmin(order, totals, session, from);
    await updateCustomerSession(from.id, {
      last_product: getSessionItems(session).map((item) => item.product_name).join(", "),
      last_city: session.city || session.deliveryInfo?.township || session.deliveryInfo?.city || null,
      customer_name: session.customerName || null,
      phone: session.phone || null,
      address: session.address || null,
      interests: getSessionItems(session).map((item) => item.product_name),
      current_intent: "order_confirmed",
      draft_order: null,
    });
    clearSession(chatId);
    await sendMessage(chatId, TEXT.orderSaved, { reply_markup: removeKeyboard() });
    if (!adminNotified) {
      await sendMessage(
        chatId,
        "Admin notification မရောက်နိုင်သေးပါဘူးရှင့်။ Order ကိုတော့ သိမ်းထားပြီးပါပြီ။ Admin Chat ID setup ကို စစ်ပေးပါမယ်။",
        { reply_markup: mainMenuKeyboard() }
      );
    }
    return;
  }

  await sendMessage(chatId, TEXT.unknown);
}

function looksLikePhone(text) {
  return /^[+\d\s().-]{6,}$/.test(text.trim());
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[၊။!?.,()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function customerMayWantToOrder(text) {
  const normalized = normalizeText(text);
  return includesAny(normalized, [
    "order",
    "buy",
    "purchase",
    "မှာ",
    "ဝယ်",
    "ယူမယ်",
    "လိုချင်",
    "မှာချင်",
  ]);
}

async function findMatchingProduct(text) {
  const normalized = normalizeText(text);
  const products = await getProducts();

  return products.find((product) => {
    const name = normalizeText(product.name);
    const category = normalizeText(product.category);
    return (
      (name && normalized.includes(name)) ||
      (category && normalized.includes(category))
    );
  });
}

async function recommendByConcern(chatId, text) {
  const normalized = normalizeText(text);
  const products = await getProducts();

  const concernRules = [
    {
      keywords: ["ဝက်ခြံ", "acne", "pimple"],
      productWords: ["acne", "face wash"],
      reply:
        "ဝက်ခြံအတွက်ဆို Acne Face Wash ကို အရင်ကြည့်လို့ရပါတယ်ရှင့်။ Skin sensitive ဖြစ်ရင် နေ့တိုင်းမသုံးခင် နည်းနည်းစမ်းသုံးပေးပါနော်။",
    },
    {
      keywords: ["ချွေးနံ့", "body", "bodywash", "အနံ့"],
      productWords: ["bodywash", "body wash"],
      reply: "Body care အတွက် BodyWash ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["ဆံပင်", "ဗောက်", "shampoo", "hair"],
      productWords: ["shampoo", "hair mask", "hair oil"],
      reply: "ဆံပင်အတွက် Shampoo, HairMask, Hair Oil တွေရှိပါတယ်ရှင့်။",
    },
    {
      keywords: ["ဖြူ", "whitening", "soap"],
      productWords: ["whitening", "soap"],
      reply: "Whitening care အတွက် Whitening Soap ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["သွား", "tooth", "toothpaste"],
      productWords: ["toothpaste"],
      reply: "သွားတိုက်ဆေး Set အတွက် Toothpaste Set ရှိပါတယ်ရှင့်။",
    },
    {
      keywords: ["ချွေးပေါက်", "pore", "toner"],
      productWords: ["pore", "toner"],
      reply: "ချွေးပေါက်ကျဉ်းချင်ရင် Pore Tightening Toner ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["detox", "essence", "အဆီ"],
      productWords: ["detox", "essence"],
      reply: "Skin care အတွက် Detox Essence ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
  ];

  const rule = concernRules.find((item) => includesAny(normalized, item.keywords));
  if (!rule) return false;

  const matchedProducts = products.filter((product) => {
    const haystack = normalizeText(
      `${product.name} ${product.category} ${product.description}`
    );
    return rule.productWords.some((word) => haystack.includes(word));
  });

  if (matchedProducts.length === 0) {
    await sendMessage(chatId, rule.reply, {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  await sendMessage(chatId, rule.reply, {
    reply_markup: {
      inline_keyboard: matchedProducts.map((product) => [
        { text: productTitle(product), callback_data: `product:${product.id}` },
      ]),
    },
  });
  return true;
}

function buildProductCatalog(products) {
  return products
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      free_delivery_qty: product.free_delivery_qty,
      description: product.description,
      usage_instruction: product.usage_instruction,
      benefits: product.benefits,
      stock: product.stock,
    }))
    .map((product) => JSON.stringify(product))
    .join("\n");
}

function buildDeliveryCatalog(zones) {
  return zones
    .map((zone) => ({
      city: zone.city,
      township: zone.township,
      aliases: zone.aliases,
      cod_available: zone.cod_available,
      delivery_fee: zone.delivery_fee,
      payment_method: zone.payment_method,
      estimated_days: zone.estimated_days,
      note: zone.note,
    }))
    .map((zone) => JSON.stringify(zone))
    .join("\n");
}

function parseAiJson(text) {
  const raw = String(text || "").trim();
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function extractAiIntent(text, context = {}) {
  if (!OPENROUTER_API_KEY) return null;

  const systemPrompt = [
    "You extract intent/entities for a Myanmar cosmetics Telegram shop bot.",
    "Return JSON only. No markdown.",
    "Use null for unknown fields.",
    "Allowed intents: greeting, product_info, usage, benefits, recommend, delivery_question, order_intent, smalltalk, unknown.",
    "Never invent products or delivery zones. Pick product_name only from product data if clear.",
    "Fields: intent, product_name, quantity, items, city, township, customer_name, phone, address, question.",
    "For multi-product orders, set items to an array of { product_name, quantity }. Use quantity 1 if not specified.",
    "Understand Burmese, English, and mixed Burmese-English product/order messages.",
  ].join("\n");

  const userPrompt = [
    "Products:",
    context.productsCatalog || "none",
    "",
    "Delivery zones:",
    context.deliveryCatalog || "none",
    "",
    context.customerSession ? `Known customer session: ${JSON.stringify(context.customerSession)}` : "",
    "",
    `Message: ${text}`,
  ].join("\n");

  try {
    const { data } = await openRouter.post(
      "/chat/completions",
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": WEBHOOK_URL || "https://render.com",
          "X-Title": "Magic CEO Ma Phoo Telegram Shop Bot",
        },
      }
    );

    return parseAiJson(data?.choices?.[0]?.message?.content);
  } catch (error) {
    console.error("OpenRouter intent extraction failed", error.response?.data?.error?.message || error.message);
    return null;
  }
}

function findProductByAiName(products, name, originalText = "") {
  const normalizedName = normalizeText(name);
  const normalizedText = normalizeText(`${name || ""} ${originalText || ""}`);

  return (
    products.find((product) => normalizeText(product.name) === normalizedName) ||
    products.find((product) => normalizeText(product.name).includes(normalizedName)) ||
    products.find((product) =>
      getProductAliases(product).some((alias) => normalizedText.includes(normalizeText(alias)))
    ) ||
    null
  );
}

function extractQuantityNearAlias(text, alias) {
  const normalized = normalizeMyanmarDigits(text);
  const lower = normalized.toLowerCase();
  const aliasIndex = lower.indexOf(alias.toLowerCase());
  if (aliasIndex === -1) return 1;

  const after = lower.slice(aliasIndex + alias.length, aliasIndex + alias.length + 40);
  const before = lower.slice(Math.max(0, aliasIndex - 20), aliasIndex);
  const afterMatch = after.match(/\d+/);
  if (afterMatch) return Math.max(1, Number(afterMatch[0]) || 1);

  const beforeMatches = [...before.matchAll(/\d+/g)];
  if (beforeMatches.length > 0) {
    return Math.max(1, Number(beforeMatches[beforeMatches.length - 1][0]) || 1);
  }

  return 1;
}

function extractCartItemsFromText(text, products) {
  const normalized = normalizeText(text);
  const items = [];

  for (const product of products) {
    const aliases = getProductAliases(product).sort((a, b) => b.length - a.length);
    const matchedAlias = aliases.find((alias) => normalized.includes(normalizeText(alias)));
    if (!matchedAlias) continue;

    items.push(productToCartItem(product, extractQuantityNearAlias(text, matchedAlias)));
  }

  return mergeCartItems(items);
}

function cartItemsFromAiItems(aiItems, products, originalText) {
  if (!Array.isArray(aiItems)) return [];

  const items = aiItems
    .map((item) => {
      const product = findProductByAiName(
        products,
        item.product_name || item.name || item.product,
        `${originalText} ${item.product_name || ""}`
      );
      if (!product) return null;
      return productToCartItem(product, Number(item.quantity) > 0 ? Number(item.quantity) : 1);
    })
    .filter(Boolean);

  return mergeCartItems(items);
}

function deliveryReply(zone) {
  if (!zone) {
    return "အဲဒီမြို့/မြို့နယ်အတွက် delivery fee နဲ့ ငွေချေမှုကို Admin က confirm လုပ်ပေးပါမယ်ရှင့်။ မြို့နယ်နာမည်လေး ပိုပြောပေးပါနော်။";
  }

  const payment = zone.cod_available
    ? "အိမ်ရောက်ငွေချေ ရပါတယ်ရှင့်။"
    : "ကြိုလွှဲငွေချေ ဖြစ်ပါတယ်ရှင့်။";

  return [
    `${zone.township || zone.city} အတွက် delivery fee ${money(zone.delivery_fee)} ပါရှင့်။`,
    payment,
    zone.estimated_days ? `ကြာချိန်: ${zone.estimated_days}` : "",
    zone.note ? `မှတ်ချက်: ${zone.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleAiAssistant(chatId, from, text) {
  if (!OPENROUTER_API_KEY) return false;

  const [products, zones, storedSession] = await Promise.all([
    getProducts(),
    getDeliveryZones(),
    getCustomerSession(from.id),
  ]);

  const productsCatalog = buildProductCatalog(products);
  const deliveryCatalog = buildDeliveryCatalog(zones);
  const intent = await extractAiIntent(text, {
    productsCatalog,
    deliveryCatalog,
    customerSession: storedSession,
  });

  if (!intent) return false;

  const aiItems = cartItemsFromAiItems(intent.items, products, text);
  const textItems = extractCartItemsFromText(text, products);
  const product = findProductByAiName(products, intent.product_name, text) || aiItems[0]?.product || textItems[0]?.product || null;
  const items = mergeCartItems(
    aiItems.length > 0
      ? aiItems
      : textItems.length > 0
        ? textItems
        : product
          ? [productToCartItem(product, Number(intent.quantity) > 0 ? Number(intent.quantity) : extractQuantity(text))]
          : []
  );
  const deliveryInfo = await getDeliveryInfo(
    [intent.city, intent.township, intent.address, storedSession?.last_city, text]
      .filter(Boolean)
      .join(" ")
  );
  const quantity = items[0]?.quantity || (Number(intent.quantity) > 0 ? Number(intent.quantity) : extractQuantity(text));

  await updateCustomerSession(from.id, {
    last_product: items.map((item) => item.product_name).join(", ") || product?.name || storedSession?.last_product || null,
    last_city: deliveryInfo?.township || deliveryInfo?.city || intent.township || intent.city || storedSession?.last_city || null,
    current_intent: intent.intent || "unknown",
    interests: items.length > 0 ? items.map((item) => item.product_name) : product ? [product.name] : storedSession?.interests || null,
  });

  if (intent.intent === "greeting" || intent.intent === "smalltalk") {
    await sendMessage(chatId, "မင်္ဂလာပါရှင့်🥰 မဖူးဆိုင်ကနေ ဘာလေးရှာပေးရမလဲ။", {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  if (intent.intent === "delivery_question") {
    await sendMessage(chatId, deliveryReply(deliveryInfo), {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }

  if (["product_info", "usage", "benefits", "recommend"].includes(intent.intent) && product) {
    await showProduct(chatId, product.id);
    return true;
  }

  if (intent.intent === "order_intent") {
    if (items.length === 0 || !product) {
      await sendMessage(chatId, "ဘယ် product လေးမှာချင်တာလဲ ပြောပေးပါနော်🥰", {
        reply_markup: mainMenuKeyboard(),
      });
      return true;
    }

    const session = {
      step: "customer_info",
      product,
      quantity,
      items,
      deliveryInfo,
      city: deliveryInfo?.township || deliveryInfo?.city || intent.township || intent.city || null,
      customerName: intent.customer_name || storedSession?.customer_name || "",
      phone: intent.phone || storedSession?.phone || "",
      address: intent.address || storedSession?.address || "",
      paymentMethod: getPaymentLabel(deliveryInfo),
      from,
    };

    if (hasCustomerInfo(session)) {
      session.step = "confirm";
      setSession(chatId, session);
      await sendMessage(chatId, formatOrderSummary(session), {
        reply_markup: confirmKeyboard(),
      });
      return true;
    }

    setSession(chatId, session);
    await updateCustomerSession(from.id, {
      draft_order: {
        product_id: product.id,
        product_name: product.name,
        quantity,
        items: cartDraftFromSession(session).items,
        city: session.city,
      },
    });
    await sendMessage(chatId, orderInfoPrompt(session), {
      reply_markup: quantityKeyboard(product.id),
    });
    return true;
  }

  return false;
}

function fallbackAiReply() {
  return "တောင်းပန်ပါတယ်ရှင့်။ အခု AI assistant ခဏမဖြေနိုင်သေးပါဘူး။ ပစ္စည်းကြည့်ချင်ရင် အောက်က menu ကနေရွေးနိုင်ပါတယ်ရှင့်။";
}

async function answerWithOpenRouter(chatId, text) {
  if (!OPENROUTER_API_KEY) return false;

  const products = await getProducts();
  const zones = await getDeliveryZones();
  const catalog = buildProductCatalog(products);
  const deliveryCatalog = buildDeliveryCatalog(zones);
  const matchedProduct = await findMatchingProduct(text);
  const wantsToOrder = customerMayWantToOrder(text);

  const systemPrompt = [
    "You are a polite Myanmar cosmetics shop assistant for a Telegram ecommerce bot.",
    "Reply only in friendly Burmese/Myanmar language.",
    "Use only the product data provided below. Do not invent unavailable products, prices, stock, benefits, usage instructions, or delivery rules.",
    "Keep the reply short, warm, and sales-friendly. Prefer 2 to 5 short lines.",
    "Never show internal status/payment words to customers: COD, prepaid, needs_review, pending_cod, awaiting_payment. Use Burmese labels only: အိမ်ရောက်ငွေချေ, ကြိုလွှဲငွေချေ, or Admin confirm.",
    "If the customer asks for usage, explain from usage_instruction only.",
    "If the customer asks for benefits, explain from benefits only.",
    "If the customer asks about price, mention product price and unit only from the data.",
    `Delivery rule: if product.free_delivery_qty is available and customer quantity is at least that number, free delivery applies. Otherwise delivery fee is ${deliveryFee} Ks.`,
    "Delivery and payment must use delivery_zones data. If zone is unknown, say staff will confirm delivery fee and payment. Use Burmese labels: အိမ်ရောက်ငွေချေ or ကြိုလွှဲငွေချေ.",
    "If the customer wants to buy or order, tell them to choose the product and press the 'မှာယူမယ်' order button.",
    "If customer mentions multiple products, answer for all of them and explain mixed-cart free delivery if total quantity is 3 or more.",
    "Do not make medical guarantees. For acne/skin concerns, use gentle language like 'အထောက်အကူဖြစ်နိုင်ပါတယ်' and suggest patch testing if skin is sensitive.",
    "If no available product fits the question, say it is not currently available and invite them to choose from the menu.",
  ].join("\n");

  const userPrompt = [
    "Available product data:",
    catalog || "No products are currently available.",
    "",
    "Available delivery_zones data:",
    deliveryCatalog || "No delivery zones are currently available.",
    "",
    `Customer message: ${text}`,
  ].join("\n");

  try {
    const { data } = await openRouter.post(
      "/chat/completions",
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 350,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": WEBHOOK_URL || "https://render.com",
          "X-Title": "Magic CEO Ma Phoo Telegram Shop Bot",
        },
      }
    );

    const reply = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!reply) throw new Error("OpenRouter returned an empty response");

    const suffix =
      wantsToOrder && !reply.includes("မှာယူမယ်")
        ? "\n\nမှာယူချင်ရင် product ကိုရွေးပြီး “မှာယူမယ်” button ကိုနှိပ်ပေးပါရှင့်။"
        : "";

    await sendMessage(chatId, cleanHtml(`${reply}${suffix}`), {
      reply_markup: matchedProduct
        ? productActionsKeyboard(matchedProduct.id)
        : mainMenuKeyboard(),
    });
    return true;
  } catch (error) {
    console.error(
      "OpenRouter failed",
      error.response?.data?.error?.message || error.message
    );
    await sendMessage(chatId, fallbackAiReply(), {
      reply_markup: mainMenuKeyboard(),
    });
    return true;
  }
}

async function answerBurmeseQuestion(chatId, text) {
  const normalized = normalizeText(text);

  if (
    includesAny(normalized, [
      "hi",
      "hello",
      "hey",
      "ဟိုင်း",
      "မင်္ဂလာပါ",
      "မဂ်လာပါ",
      "မင်္ဂလာ",
      "ရှိလား",
      "မမ",
      "sis",
    ])
  ) {
    await sendMessage(
      chatId,
      "မင်္ဂလာပါရှင့် 💄 ဘာလေးရှာပေးရမလဲ။ ပစ္စည်းကြည့်မယ်ဆို အောက်က menu ကနေရွေးနိုင်ပါတယ်ရှင့်။",
      { reply_markup: mainMenuKeyboard() }
    );
    return true;
  }

  if (
    includesAny(normalized, [
      "menu",
      "start",
      "ပစ္စည်း",
      "ကုန်ပစ္စည်း",
      "ရှိတာ",
      "ဘာတွေရှိ",
      "ပြပါ",
      "ကြည့်မယ်",
      "ကြည့်မယ်",
    ])
  ) {
    await showCategories(chatId);
    return true;
  }

  const matchedProduct = await findMatchingProduct(text);
  if (matchedProduct) {
    await sendMessage(chatId, formatProduct(matchedProduct), {
      reply_markup: productActionsKeyboard(matchedProduct.id),
    });
    return true;
  }

  if (await recommendByConcern(chatId, text)) {
    return true;
  }

  if (
    includesAny(normalized, [
      "cod",
      "ငွေ",
      "ချေ",
      "cash",
      "payment",
      "အိမ်ရောက်",
      "ပစ္စည်းရောက်",
    ])
  ) {
    await sendMessage(
      chatId,
      "အိမ်ရောက်ငွေချေ ရတဲ့မြို့တွေမှာ ပစ္စည်းရောက်မှ ငွေချေပေးလို့ရပါတယ်ရှင့်။ တခြားမြို့တွေမှာ ကြိုလွှဲငွေချေ ဖြစ်နိုင်ပါတယ်။"
    );
    return true;
  }

  if (
    includesAny(normalized, [
      "ပို့",
      "delivery",
      "free",
      "deli",
      "ပို့ခ",
      "ဘယ်မြို့",
      "မြို့နယ်",
    ])
  ) {
    await sendMessage(
      chatId,
      "Delivery fee ကို အော်ဒါအတည်ပြုချိန်မှာ တွက်ပေးပါတယ်ရှင့်။ Product မှာ သတ်မှတ်ထားတဲ့ free delivery အရေအတွက်ပြည့်ရင် delivery free ဖြစ်ပါတယ်။"
    );
    return true;
  }

  if (
    includesAny(normalized, [
      "အသုံး",
      "လိမ်း",
      "သုံး",
      "ဘယ်လိုသုံး",
      "use",
      "usage",
    ])
  ) {
    await sendMessage(
      chatId,
      "Product တစ်ခုချင်းစီမှာ “အသုံးပြုပုံ” button ကိုနှိပ်ပြီး ကြည့်နိုင်ပါတယ်ရှင့်။"
    );
    return true;
  }

  if (
    includesAny(normalized, [
      "ကောင်း",
      "အကျိုး",
      "benefit",
      "ဘာကောင်း",
      "အာနိသင်",
      "သက်သာ",
    ])
  ) {
    await sendMessage(
      chatId,
      "Product တစ်ခုချင်းစီမှာ “ကောင်းကျိုး” button ကိုနှိပ်ပြီး ဖတ်နိုင်ပါတယ်ရှင့်။"
    );
    return true;
  }

  if (
    includesAny(normalized, [
      "စျေး",
      "ဈေး",
      "price",
      "ဘယ်လောက်",
      "တန်ဖိုး",
      "ကုန်ကျ",
    ])
  ) {
    await showCategories(chatId);
    return true;
  }

  if (
    includesAny(normalized, [
      "stock",
      "ကျန်",
      "ရှိသေး",
      "ရနိုင်",
      "ဝယ်လို့ရ",
    ])
  ) {
    await sendMessage(
      chatId,
      "Stock ရှိ/မရှိကို product တစ်ခုချင်းစီမှာ ကြည့်နိုင်ပါတယ်ရှင့်။ ပစ္စည်းရွေးပေးပါနော်။"
    );
    await showCategories(chatId);
    return true;
  }

  if (
    includesAny(normalized, [
      "မှာ",
      "order",
      "ဝယ်",
      "ယူမယ်",
      "လိုချင်",
      "ဘယ်လိုမှာ",
    ])
  ) {
    await sendMessage(
      chatId,
      "မှာယူမယ်ဆို ပစ္စည်းရွေးပြီး “မှာယူမယ်” button ကိုနှိပ်ပေးပါရှင့်။"
    );
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
    await cancelOrder(chatId, message.from);
    return;
  }

  if (text && isCancelText(text)) {
    await cancelOrder(chatId, message.from);
    return;
  }

  if (text === "/id") {
    await sendMessage(
      chatId,
      [`Chat ID: <code>${chatId}</code>`, `User ID: <code>${message.from.id}</code>`].join("\n")
    );
    return;
  }

  if (!session && text) {
    const textOrderSession = await buildOrderSessionFromText(text, message.from);
    if (textOrderSession) {
      setSession(chatId, textOrderSession);
      await persistDraftOrder(message.from, textOrderSession, "order_intent");
      await sendMessage(chatId, formatOrderSummary(textOrderSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }
  }

  if (session?.step === "customer_info") {
    if (!text) {
      await sendMessage(chatId, orderInfoPrompt(session), {
        reply_markup: quantityKeyboard(session.product.id),
      });
      return;
    }

    const textOrderSession = await buildOrderSessionFromText(text, message.from, session);
    if (textOrderSession) {
      setSession(chatId, textOrderSession);
      await persistDraftOrder(message.from, textOrderSession, "order_intent");
      await sendMessage(chatId, formatOrderSummary(textOrderSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }

    const parsed = parseCustomerInfo(text, session.product);
    if (parsed.customerName && parsed.address && parsed.phone) {
      const deliveryInfo = await getDeliveryInfo(`${text}\n${parsed.address}`);
      const nextSession = {
        ...session,
        step: "confirm",
        customerName: parsed.customerName,
        address: parsed.address,
        phone: parsed.phone,
        deliveryInfo,
        city: deliveryInfo
          ? [deliveryInfo.city, deliveryInfo.township].filter(Boolean).join(" / ")
          : session.city,
        paymentMethod: getPaymentLabel(deliveryInfo),
      };
      setSession(chatId, nextSession);
      await persistDraftOrder(message.from, nextSession, "order_intent");
      await sendMessage(chatId, formatOrderSummary(nextSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }

    setSession(chatId, {
      ...session,
      step: "customer_address",
      customerName: text,
    });
    await sendMessage(chatId, "လိပ်စာအပြည့်အစုံလေး ပေးပေးပါနော်🥰");
    return;
  }

  if (session?.step === "customer_address") {
    const textOrderSession = await buildOrderSessionFromText(text, message.from, session);
    if (textOrderSession) {
      setSession(chatId, textOrderSession);
      await persistDraftOrder(message.from, textOrderSession, "order_intent");
      await sendMessage(chatId, formatOrderSummary(textOrderSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }

    if (!text || text.length < 8) {
      await sendMessage(chatId, "လိပ်စာကို အိမ်/လမ်းနံပတ်ပါအောင် နည်းနည်းပိုပြည့်စုံအောင် ပေးပေးပါနော်🥰");
      return;
    }

    setSession(chatId, {
      ...session,
      step: "customer_phone",
      address: text,
    });
    await sendMessage(chatId, "Phနံပတ်လေး ပေးပေးပါနော်🥰");
    return;
  }

  if (session?.step === "customer_phone") {
    const textOrderSession = await buildOrderSessionFromText(text, message.from, session);
    if (textOrderSession) {
      setSession(chatId, textOrderSession);
      await persistDraftOrder(message.from, textOrderSession, "order_intent");
      await sendMessage(chatId, formatOrderSummary(textOrderSession), {
        reply_markup: confirmKeyboard(),
      });
      return;
    }

    const phone = message.contact?.phone_number || text;
    if (!phone || (!message.contact && !looksLikePhone(phone))) {
      await sendMessage(chatId, "Phနံပတ်လေး မှန်အောင် ပြန်ပေးပေးပါနော်🥰");
      return;
    }

    const deliveryInfo = await getDeliveryInfo(session.address);
    const nextSession = {
      ...session,
      step: "confirm",
      phone,
      deliveryInfo,
      city: deliveryInfo?.township || deliveryInfo?.city || session.city,
      paymentMethod: getPaymentLabel(deliveryInfo),
    };
    setSession(chatId, nextSession);
    await persistDraftOrder(message.from, nextSession, "order_intent");
    await sendMessage(chatId, formatOrderSummary(nextSession), {
      reply_markup: confirmKeyboard(),
    });
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

  if (text && (await handleAiAssistant(chatId, message.from, text))) {
    return;
  }

  if (text && (await answerWithOpenRouter(chatId, text))) {
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
    await sendAdminMessage(
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

async function startPolling() {
  if (pollingActive) return;
  pollingActive = true;

  try {
    await telegram.post("/deleteWebhook", {
      drop_pending_updates: POLLING_DROP_PENDING === "true",
    });
  } catch (error) {
    console.error("Could not delete webhook before polling", error.message);
  }

  console.log("Telegram polling started for local development");
  let offset = 0;

  while (pollingActive) {
    try {
      const { data } = await telegram.get("/getUpdates", {
        params: {
          offset,
          timeout: 25,
          allowed_updates: JSON.stringify(["message", "callback_query"]),
        },
        timeout: 30000,
      });

      for (const update of data.result || []) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error("Polling error", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

function startServer() {
  return app.listen(Number(PORT), async () => {
    console.log(`Bot server listening on port ${PORT}`);
    try {
      if (USE_POLLING === "true") {
        startPolling().catch((error) => {
          console.error("Polling setup failed", error.message);
        });
      } else {
        await setupWebhook();
      }
    } catch (error) {
      console.error("Telegram setup failed", error.message);
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  answerWithOpenRouter,
  calculateOrder,
  formatOrderSummary,
  startPolling,
  startServer,
};
