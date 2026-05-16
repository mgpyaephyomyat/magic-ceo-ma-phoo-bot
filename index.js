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
  GATE_DELIVERY_FEE = "3000",
  KPAY_PHONE = "09963166710",
  KPAY_NAME = "Phoo Myat Aung",
  WAVE_PHONE = "09762655807",
  WAVE_NAME = "Ma Phoo Myat Aung",
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
const productImageSendGuards = new Map();
const deliveryFee = Number(DEFAULT_DELIVERY_FEE) || 3000;
const gateDeliveryFee = Number(GATE_DELIVERY_FEE) || 3000;
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

const PRODUCT_DISPLAY_NAMES = {
  bodywash: "ရေချိုးဆပ်ပြာဗူး(အဝါ)",
  "body wash": "ရေချိုးဆပ်ပြာဗူး(အဝါ)",
  shampoo: "ခေါင်းလျော်ရည်ဗူး(အဖြူ)",
  hairmask: "ပေါင်းဆေး(ဗူး)အမဲ",
  "hair mask": "ပေါင်းဆေး(ဗူး)အမဲ",
  "hair oil": "ဆံပင်တုန်ဆီ",
  "whitening soap": "ဆပ်ပြာခဲ",
  "toothpaste set": "သွားတိုက်ဆေး၂ဗူး1set",
  "acne face wash": "ဝက်ခြံပျောက်မျက်နှာသစ်",
  "pore tightening toner": "ချွေးပေါက်ကျဉ်း Toner",
  "detox essence": "အဆိပ်ထုတ် Essence serum",
};

const PRODUCT_STORAGE_IMAGES = {
  bodywash: ["bodywashprice.jpg", "bodywashusage.png"],
  shampoo: ["shampooprice.jpg", "shampoousage.jpg"],
  hairmask: ["hairmaskprice.jpg", "hairmaskusage.jpg"],
  "hair oil": ["hairessentialoil.jpg", "hairessentialoilusage.png"],
  "whitening soap": ["soapprice.jpg", "soapusage.jpg"],
  "toothpaste set": ["toothpasteprice.jpg", "toothpasteusage.png"],
  "acne face wash": ["cleanserprice.jpg"],
};

const YANGON_ALIASES = [
  "ရန်ကုန်",
  "yangon",
  "ygn",
  "သင်္ဃန်းကျွန်း",
  "thingangyun",
  "တောင်ဥက္ကလာ",
  "south okkalapa",
  "မြောက်ဥက္ကလာ",
  "north okkalapa",
  "သာကေတ",
  "thaketa",
  "ဒေါပုံ",
  "မင်္ဂလာတောင်ညွန့်",
  "မင်္ဂလာတောင်ညွန့်",
  "ပုဇွန်တောင်",
  "ဗိုလ်တစ်ထောင်",
  "ကျောက်တံတား",
  "ပန်းပဲတန်း",
  "လသာ",
  "လမ်းမတော်",
  "ဒဂုံဆိပ်ကမ်း",
  "dagon seikkan",
  "မြောက်ဒဂုံ",
  "north dagon",
  "အရှေ့ဒဂုံ",
  "east dagon",
  "တောင်ဒဂုံ",
  "south dagon",
  "ဒဂုံ",
  "dagon",
  "အလုံ",
  "ကြည့်မြင်တိုင်",
  "ကြည့်မြင်တိုင်",
  "အင်းစိန်",
  "insein",
  "လှိုင်",
  "hlaing",
  "မရမ်းကုန်း",
  "mayangone",
  "တာမွေ",
  "tamwe",
  "စမ်းချောင်း",
  "sanchaung",
  "ကမာရွတ်",
  "kamayut",
  "ရန်ကင်း",
  "yankin",
  "ဗဟန်း",
  "bahan",
  "ရွှေပြည်သာ",
  "လှည်းကူး",
  "မင်္ဂလာဒုံ",
  "မှော်ဘီ",
  "သန်လျင်",
];

const FAR_YANGON_ALIASES = [
  "ထန်းတပင်",
  "တိုက်ကြီး",
  "ကျောက်တန်း",
  "ခရမ်း",
  "သုံးခွ",
  "တွံတေး",
  "ဒလ",
  "ကော့မှူး",
  "ကွမ်းခြံကုန်း",
  "လှိုင်သာယာ",
  "hlaing tharyar",
  "hlaingtharyar",
];

const MANDALAY_ALIASES = [
  "မန္တလေး",
  "mandalay",
  "mdy",
  "ချမ်းအေးသာဇံ",
  "chanayethazan",
  "ချမ်းမြသာစည်",
  "chanmyathazi",
  "မဟာအောင်မြေ",
  "maha aung myay",
  "အောင်မြေသာဇံ",
  "aungmyethazan",
  "ပြည်ကြီးတံခွန်",
  "pyigyitagon",
  "အမရပူရ",
  "amarapura",
  "ပုသိမ်ကြီး",
  "patheingyi",
];

const FAR_MANDALAY_ALIASES = [
  "တံတာရဦး",
  "ပလိပ်",
  "မြစ်ငယ်",
  "ကျောက်ဆည်",
  "မြစ်သား",
  "ကူမဲ",
  "စဉ့်ကိုင်",
  "စဉ့်ကိုင်",
  "ပြင်ဦးလွင်",
  "အုန်းချော",
  "သာစည်",
  "ပျော်ဘွယ်",
  "မြင်းခြံ",
  "ရမည်းသင်း",
  "မိတ္ထီလာ",
  "ကျောက်ပန်းတောင်း",
  "ညောင်ဦး",
  "ပုဂံ",
  "မတ္တရာ",
  "မလှိုင်",
  "မလှိင်",
  "ဝမ်းတွင်း",
];

const NAYPYITAW_ALIASES = [
  "နေပြည်တော်",
  "naypyitaw",
  "nay pyi taw",
  "ပျဉ်းမနား",
  "ဇမ္ဗူသီရိ",
  "ဇေယာသီရိ",
  "ဒက္ခိဏသီရိ",
  "ဒဏ္ခိဏသီရိ",
  "ဥတ္တရသီရိ",
  "ပုဗ္ဗသီရိ",
  "ဇေယျာသီရိ",
  "လယ်ဝေး",
  "တပ်ကုန်း",
];

const TACHILEIK_ALIASES = ["တာချီလိတ်", "tachileik", "tachilek"];

const FAR_ZONE_CITY_ALIASES = [
  "ရန်ကုန်အဝေးမြို့နယ်များ",
  "မန္တလေးအဝေးမြို့များ",
];

const TEXT = {
  start:
    "မင်္ဂလာပါရှင့် 💄\nMagic CEO Ma Phoo Cosmetics Shop မှ ကြိုဆိုပါတယ်။\nအောက်က menu ကနေ ပစ္စည်းကြည့်ပြီး မှာယူနိုင်ပါတယ်ရှင့်။",
  products: "ပစ္စည်းအမျိုးအစား ရွေးပေးပါရှင့်။",
  loading: "ခဏလေးစောင့်ပေးပါရှင့်...",
  noProducts: "လက်ရှိ product မတွေ့သေးပါဘူးရှင့်။",
  greeting: "မင်္ဂလာပါရှင့်🥰 မဖူးဆိုင်ကနေ ဘာလေးရှာပေးရမလဲ။",
  askPhone:
    "ဖုန်းနံပါတ်ပေးပေးပါရှင့်။ Telegram contact ပို့နိုင်သလို စာနဲ့လည်း ရိုက်ပေးနိုင်ပါတယ်။",
  askAddress: "ပို့ရမယ့် လိပ်စာအပြည့်အစုံ ရိုက်ပေးပါရှင့်။",
  orderSaved:
    "အော်ဒါအတည်ပြုပြီးပါပြီရှင့်။ မဖူးဘက်က order ကို လက်ခံထားပါပြီ။ ကျေးဇူးတင်ပါတယ်🥰",
  cancelled: "အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီရှင့်။",
  unknown:
    "မင်္ဂလာပါရှင့်🥰 မဖူးဆိုင်ကနေ ဘာလေးရှာပေးရမလဲ။",
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
      [{ text: "မှာမယ်", callback_data: `order:${productId}` }],
      [{ text: "မီနူးများ", callback_data: "products" }],
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

function savedCustomerInfoKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "ဟုတ်ပါတယ်", callback_data: "use_saved_info" }],
      [{ text: "လိပ်စာအသစ်ပေးမယ်", callback_data: "new_customer_info" }],
      [{ text: "မလုပ်တော့ပါ", callback_data: "cancel" }],
    ],
  };
}

function deliveryChoiceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "မြို့ပေါ်မှာယူမယ်", callback_data: "delivery_choice:cod" }],
      [{ text: "ကားဂိတ်တင်ပေးပါ", callback_data: "delivery_choice:gate" }],
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

function productDisplayName(productOrName) {
  const name = typeof productOrName === "string" ? productOrName : productOrName?.name;
  const normalized = normalizeText(name);
  if (PRODUCT_DISPLAY_NAMES[normalized]) return PRODUCT_DISPLAY_NAMES[normalized];

  const matchedKey = Object.keys(PRODUCT_DISPLAY_NAMES).find((key) =>
    normalized.includes(key)
  );
  return matchedKey ? PRODUCT_DISPLAY_NAMES[matchedKey] : String(name || "");
}

function productImageFiles(productOrName) {
  const name = typeof productOrName === "string" ? productOrName : productOrName?.name;
  const normalized = normalizeText(name);
  if (PRODUCT_STORAGE_IMAGES[normalized]) return PRODUCT_STORAGE_IMAGES[normalized];

  const matchedKey = Object.keys(PRODUCT_STORAGE_IMAGES).find((key) =>
    normalized.includes(key)
  );
  return matchedKey ? PRODUCT_STORAGE_IMAGES[matchedKey] : [];
}

function publicProductImageUrl(fileName) {
  const baseUrl = String(SUPABASE_URL || "").replace(/\/+$/, "");
  return `${baseUrl}/storage/v1/object/public/productimgs/${encodeURIComponent(fileName)}`;
}

function productImageGuardKey(chatId, productName) {
  return `${chatId}:${normalizeText(productName)}`;
}

function wasProductImageRecentlySent(chatId, productName) {
  const key = productImageGuardKey(chatId, productName);
  const lastSentAt = productImageSendGuards.get(key) || 0;
  return Date.now() - lastSentAt < 10000;
}

function markProductImagesSent(chatId, productName) {
  productImageSendGuards.set(productImageGuardKey(chatId, productName), Date.now());
}

function productTitle(product) {
  const unit = product.unit ? ` / ${product.unit}` : "";
  return `${productDisplayName(product)} - ${money(product.price)}${unit}`;
}

function shortText(value, maxLength = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function freeDeliveryText(product) {
  const lines = [];
  if (isBodyWashItem(product)) {
    lines.push("ရေချိုးဆပ်ပြာ ၃ဗူးနှင့်အထက်ဆို Deli free / ကားဂိတ်တင်ဆို တန်ဆာခ free");
  } else if (isWhiteningSoapItem(product)) {
    lines.push("ဆပ်ပြာခဲ ၄ခဲနှင့်အထက်ဆို Deli free / ကားဂိတ်တင်ဆို တန်ဆာခ free");
  }
  lines.push("ပစ္စည်း ၃မျိုးယူရင် Deli free / ကားဂိတ်တင်ဆို တန်ဆာခ free");
  lines.push("နိုင်ငံခြား order များအတွက် free delivery မပါပါ");
  return lines.join("\n");
}

function formatProduct(product) {
  const stockText =
    product.stock === null || product.stock === undefined
      ? ""
      : `\n📦 Stock: ${product.stock}`;

  return [
    `<b>${cleanHtml(productDisplayName(product))}</b>`,
    `စျေးနှုန်း: <b>${money(product.price)}</b>${
      product.unit ? ` / ${cleanHtml(product.unit)}` : ""
    }`,
    `ပို့ခ: ${cleanHtml(freeDeliveryText(product))}`,
    stockText.trim(),
    product.description ? `\n${cleanHtml(product.description)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProductPhotoCaption(product) {
  const benefits = shortText(product.benefits || product.description, 220);
  const usage = shortText(product.usage_instruction, 220);

  return [
    `<b>${cleanHtml(productDisplayName(product))}</b>`,
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
    ? `<b>${cleanHtml(productDisplayName(product))} အသုံးပြုပုံ</b>\n${cleanHtml(
        product.usage_instruction
      )}`
    : "ဒီ product အတွက် အသုံးပြုပုံကို မကြာခင် ထည့်ပေးပါမယ်ရှင့်။";
}

function formatBenefits(product) {
  return product.benefits
    ? `<b>${cleanHtml(productDisplayName(product))} ကောင်းကျိုးများ</b>\n${cleanHtml(
        product.benefits
      )}`
    : "ဒီ product အတွက် ကောင်းကျိုးစာသားကို မကြာခင် ထည့်ပေးပါမယ်ရှင့်။";
}

function calculateOrder(product, quantity) {
  const subtotal = Number(product.price || 0) * quantity;
  const freeDeliveryQty = getProductFreeDeliveryQty(product);
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
    `ပစ္စည်း: ${cleanHtml(productDisplayName(product))}`,
    `အရေအတွက်: ${quantity}`,
    `ပစ္စည်းစုစုပေါင်း: ${money(totals.subtotal)}`,
    `ပို့ခ: ${
      totals.isFreeDelivery ? "Deli free" : money(totals.deliveryFee)
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
  const { product, quantity, phone, address } = session;
  const customerName = sessionCustomerName(session);
  const totals = calculateOrder(product, quantity);

  return [
    "<b>အော်ဒါအချက်အလက်</b>",
    `ပစ္စည်း: ${cleanHtml(productDisplayName(product))}`,
    `အရေအတွက်: ${quantity}`,
    `ပစ္စည်းစုစုပေါင်း: ${money(totals.subtotal)}`,
    `ပို့ခ: ${
      totals.isFreeDelivery ? "Deli free" : money(totals.deliveryFee)
    }`,
    `စုစုပေါင်း: <b>${money(totals.total)}</b>`,
    "ငွေချေမှု: အိမ်ရောက်ငွေချေ",
    customerName ? `နာမည်: ${cleanHtml(customerName)}` : "",
    phone ? `ဖုန်း: ${cleanHtml(phone)}` : "",
    address ? `လိပ်စာ: ${cleanHtml(address)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function paymentInstructionsText() {
  return [
    "ဟုတ်ညီမလေး🥰",
    "",
    "KPay",
    KPAY_PHONE,
    KPAY_NAME,
    "",
    "Wave Money",
    WAVE_PHONE,
    WAVE_NAME,
    "",
    "ငွေလွှဲပြီးရင် ငွေလွှဲပြီးကြောင်း confirm ကို မဖူးကို ဆက်သွယ်ပြီးပြောပေးပါရှင့်🥰🥰",
  ].join("\n");
}

function buildOrderNote(totals, deliveryInfo) {
  const notes = [];
  if (totals.freeDeliveryReason) notes.push(totals.freeDeliveryReason);
  if (deliveryInfo?.delivery_flow === "gate") {
    notes.push("ကားဂိတ်တင် order: customer must transfer payment before shipment.");
  }
  if (deliveryInfo?.delivery_flow === "foreign") {
    notes.push("Foreign delivery: staff must confirm delivery/payment separately.");
  }
  return notes.join(" | ") || null;
}

function formatOrderSummary(session) {
  const { phone, address, city, deliveryInfo } = session;
  const customerName = sessionCustomerName(session);
  const items = getSessionItems(session);
  const totals = calculateCart(items, deliveryInfo);
  const codStatus = getCodLabel(deliveryInfo);
  const paymentMethod = getPaymentLabel(deliveryInfo);
  const isGateDelivery = paymentMethod === "ကားဂိတ်တင်";
  const deliveryLabel = isGateDelivery ? "ပို့ခ/ဂိတ်တင်ခ" : "ပို့ခ";
  const destinationName = city || deliveryInfo?.township || deliveryInfo?.city || "customer မြို့";
  const itemLines = items.map(
    (item, index) =>
      `${index + 1}. ${cleanHtml(productDisplayName(item.product || item.product_name))} x${item.quantity} = ${money(item.subtotal)}`
  );

  return [
    "<b>🛒 အော်ဒါအချက်အလက်</b>",
    ...itemLines,
    "",
    `ပစ္စည်းစုစုပေါင်း: ${money(totals.subtotal)}`,
    totals.freeDeliveryReason ? cleanHtml(totals.freeDeliveryReason) : "",
    `${deliveryLabel}: ${
      totals.deliveryFee === null
        ? "Admin confirm"
        : totals.isFreeDelivery
          ? "free"
          : money(totals.deliveryFee)
    }`,
    `စုစုပေါင်း: <b>${totals.deliveryFee === null ? "Admin confirm" : money(totals.total)}</b>`,
    `ငွေချေမှု: ${cleanHtml(paymentMethod)}`,
    isGateDelivery ? `ရန်ကုန် to ${cleanHtml(destinationName)} တန်ဆာခလေးက ရောက်ရှင်းလေးလုပ်ပေးလိုက်မှာပါ🥰🥰` : `အိမ်ရောက်ငွေချေ: ${cleanHtml(codStatus)}`,
    "",
    "<b>ဝယ်သူ</b>",
    customerName ? `နာမည်: ${cleanHtml(customerName)}` : "",
    phone ? `ဖုန်း: ${cleanHtml(phone)}` : "",
    city ? `မြို့/မြို့နယ်: ${cleanHtml(city)}` : "",
    address ? `လိပ်စာ: ${cleanHtml(address)}` : "",
    !deliveryInfo ? "Note: Delivery နဲ့ ငွေချေမှုကို Admin က confirm လုပ်ပေးပါမယ်ရှင့်။" : "",
    deliveryInfo?.delivery_flow === "foreign" ? "နိုင်ငံခြားပို့ခကို သီးသန့်တွက်ပေးပါမယ်ရှင့်။" : "",
    isGateDelivery ? "လွှဲရမယ့်နံပါတ်လေး ပို့ထားပေးပါမယ်ရှင့်😘" : "",
    isGateDelivery ? paymentInstructionsText() : "",
    "",
    "မှတ်ချက် - မှာမယ်ဆို အတည်ပြုပေးပါရှင့်။ မဖူးဆီ order ရောက်သွားအောင်လို့ပါ🥰",
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

function isFarYangonZone(zone) {
  const city = normalizeText(zone?.city);
  return city.includes(normalizeText("ရန်ကုန်အဝေးမြို့နယ်များ"));
}

function isFarMandalayZone(zone) {
  const city = normalizeText(zone?.city);
  return city.includes(normalizeText("မန္တလေးအဝေးမြို့များ"));
}

function isFarDeliveryZone(zone) {
  const city = normalizeText(zone?.city);
  return FAR_ZONE_CITY_ALIASES.some((alias) => city.includes(normalizeText(alias)));
}

function zoneTokens(zone) {
  const aliases = Array.isArray(zone.aliases) ? zone.aliases : String(zone.aliases || "").split(",");
  const base = [zone.city, zone.township, zone.note, ...aliases];
  const normalizedBase = normalizeText(base.join(" "));
  const builtInAliases = [];

  if (isFarYangonZone(zone)) {
    builtInAliases.push(...FAR_YANGON_ALIASES);
  } else if (YANGON_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
    builtInAliases.push(...YANGON_ALIASES);
  }
  if (isFarMandalayZone(zone)) {
    builtInAliases.push(...FAR_MANDALAY_ALIASES);
  } else if (MANDALAY_ALIASES.some((alias) => normalizedBase.includes(normalizeText(alias)))) {
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
    .filter((token, index, tokens) => token.length >= 2 && tokens.indexOf(token) === index);
}

function isLatinAlias(alias) {
  return /^[a-z0-9\s-]+$/i.test(alias);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasMatchesInput(normalizedInput, alias) {
  if (!alias) return false;
  if (!isLatinAlias(alias)) return normalizedInput.includes(alias);

  const compactInput = normalizedInput.replace(/\s+/g, " ");
  const compactAlias = alias.replace(/\s+/g, " ");
  const boundaryPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(compactAlias)}($|[^a-z0-9])`, "i");
  return boundaryPattern.test(compactInput);
}

function getZoneMatchCandidates(zones, normalizedInput) {
  return zones
    .flatMap((zone) =>
      zoneTokens(zone).map((alias) => ({
        zone,
        alias,
        score: alias.length,
        priority: isFarDeliveryZone(zone) ? 1 : 0,
      }))
    )
    .filter((candidate) => aliasMatchesInput(normalizedInput, candidate.alias))
    .sort((a, b) => b.score - a.score || a.priority - b.priority);
}

function matchDeliveryZoneFromList(input, zones) {
  const normalized = normalizeText(input);
  if (!normalized) return null;
  const [match] = getZoneMatchCandidates(zones, normalized);
  if (!match) return null;
  const deliveryInfo = normalizeDeliveryZone(match.zone);
  return {
    ...deliveryInfo,
    matched_alias: match.alias,
    matched_region: deliveryInfo?.city || deliveryInfo?.township || "",
  };
}

function zoneHasAnyAlias(zone, aliases) {
  const haystack = zoneTokens(zone).join(" ");
  return aliases.some((alias) =>
    haystack.includes(normalizeText(alias))
  );
}

function isAutoCodRegion(zone) {
  return zoneHasAnyAlias(zone, [...YANGON_ALIASES, ...MANDALAY_ALIASES]);
}

function normalizeDeliveryZone(zone) {
  if (!zone) return null;
  const codAvailable = Boolean(isAutoCodRegion(zone) || zone.cod_available);
  const normalizedFee = Number(zone.delivery_fee);
  const deliveryFeeValue = Number.isFinite(normalizedFee)
    ? (codAvailable ? normalizedFee : gateDeliveryFee)
    : codAvailable
      ? deliveryFee
      : gateDeliveryFee;
  const paymentMethod = codAvailable ? "အိမ်ရောက်ငွေချေ" : "ကားဂိတ်တင်";

  return {
    ...zone,
    cod_available: codAvailable,
    delivery_fee: deliveryFeeValue,
    payment_method: paymentMethod,
    delivery_flow: codAvailable ? "cod" : "gate",
    status: codAvailable ? "pending_cod" : "awaiting_payment",
  };
}

function getPaymentLabel(deliveryInfo) {
  if (!deliveryInfo) return "Admin confirm";
  if (deliveryInfo.payment_method) return deliveryInfo.payment_method;
  return deliveryInfo.cod_available ? "အိမ်ရောက်ငွေချေ" : "ကားဂိတ်တင်";
}

function getCodLabel(deliveryInfo) {
  if (!deliveryInfo) return "Admin confirm";
  return deliveryInfo.cod_available ? "ရပါတယ်" : "မရပါ";
}

function getOrderStatus(deliveryInfo) {
  if (!deliveryInfo) return "needs_review";
  if (deliveryInfo.status) return deliveryInfo.status;
  return deliveryInfo.cod_available ? "pending_cod" : "awaiting_payment";
}

function isLikelyMyanmarAddress(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  const normalized = normalizeText(value);
  const foreignWords = [
    "usa",
    "america",
    "united states",
    "uk",
    "england",
    "london",
    "singapore",
    "malaysia",
    "thailand",
    "japan",
    "korea",
    "china",
    "australia",
    "canada",
    "dubai",
    "uae",
    "စင်္ကာပူ",
    "ထိုင်း",
    "မလေးရှား",
    "ဂျပန်",
    "ကိုရီးယား",
    "တရုတ်",
    "အမေရိကန်",
    "ဒူဘိုင်း",
    "နိုင်ငံခြား",
  ];
  if (includesAny(normalized, foreignWords)) return false;
  if (/[\u1000-\u109f]/.test(value)) return true;
  return includesAny(normalized, [
    "yangon",
    "ygn",
    "mandalay",
    "mdy",
    "naypyitaw",
    "myanmar",
    "burma",
    "tachileik",
    "taunggyi",
    "pyay",
    "bago",
    "mawlamyine",
    "pathein",
  ]);
}

function makeGateDeliveryInfo(input) {
  return {
    city: "",
    township: "",
    aliases: [],
    cod_available: false,
    delivery_fee: gateDeliveryFee,
    payment_method: "ကားဂိတ်တင်",
    delivery_flow: "gate",
    status: "awaiting_payment",
    note: "ရန်ကုန်ကနေ ကားဂိတ်တင်ပေးပါမယ်။ တန်ဆာခကို ရောက်ရှင်းလုပ်ပေးပါရှင့်။",
    matched_alias: "",
    matched_region: "",
    raw_address: String(input || "").slice(0, 300),
  };
}

function makeForeignDeliveryInfo(input) {
  return {
    city: "",
    township: "",
    aliases: [],
    cod_available: false,
    delivery_fee: null,
    payment_method: "Admin confirm",
    delivery_flow: "foreign",
    status: "needs_review",
    note: "နိုင်ငံခြားပို့ဆောင်မှုကို သီးသန့် confirm လုပ်ရန်လိုပါတယ်။",
    matched_alias: "",
    matched_region: "",
    raw_address: String(input || "").slice(0, 300),
  };
}

function looksLikeVillageNearTownAddress(text) {
  const normalized = normalizeText(text);
  return includesAny(normalized, [
    "ရွာ",
    "ကျေးရွာ",
    "အနီး",
    "နား",
    "ဘုရားအနီး",
    "လမ်းအနီး",
    "မြို့နား",
    "အပြင်",
    "outskirts",
  ]);
}

function needsDeliveryChoice(session, deliveryInfo, rawText = "") {
  if (!deliveryInfo?.cod_available || deliveryInfo.delivery_flow !== "cod") return false;
  const haystack = [rawText, session?.address, session?.city].filter(Boolean).join("\n");
  return looksLikeVillageNearTownAddress(haystack);
}

function gateInfoFromMatchedZone(deliveryInfo, address = "") {
  return {
    ...makeGateDeliveryInfo(address),
    city: deliveryInfo?.city || "",
    township: deliveryInfo?.township || "",
    matched_alias: deliveryInfo?.matched_alias || "",
    matched_region: deliveryInfo?.matched_region || deliveryInfo?.city || deliveryInfo?.township || "",
  };
}

function nearTownDeliveryQuestion() {
  return [
    "ညီမလေး လိပ်စာက မြို့ပေါ်အိမ်အရောက်ပို့လို့ရတဲ့နေရာလားရှင့်?",
    "မြို့ပေါ်မှာသွားယူပေးလို့အဆင်ပြေလားရှင့်?",
  ].join("\n");
}

async function getDeliveryInfo(input) {
  const normalized = normalizeText(input);
  if (!normalized) return null;

  const zones = await getDeliveryZones();
  const deliveryInfo = matchDeliveryZoneFromList(normalized, zones);
  if (!deliveryInfo) {
    if (isLikelyMyanmarAddress(input)) {
      const gateInfo = makeGateDeliveryInfo(input);
      console.log("delivery zone not COD, using gate delivery", {
        rawAddress: String(input || "").slice(0, 300),
        deliveryFee: gateInfo.delivery_fee,
        paymentType: gateInfo.payment_method,
      });
      return gateInfo;
    }
    console.log("delivery zone not matched", { rawAddress: String(input || "").slice(0, 300) });
    return makeForeignDeliveryInfo(input);
  }

  const matchedRegion = deliveryInfo?.city || deliveryInfo?.township || "";
  const paymentType = getPaymentLabel(deliveryInfo);
  console.log("delivery zone matched", {
    matchedAlias: deliveryInfo.matched_alias,
    matchedRegion,
    deliveryFee: deliveryInfo?.delivery_fee ?? null,
    paymentType,
  });

  return deliveryInfo;
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
  const normalizedSession = canonicalCustomerSession(session);
  const patch = {
    last_product: getSessionItems(normalizedSession).map((item) => item.product_name).join(", ") || null,
    last_city: normalizedSession.city || normalizedSession.deliveryInfo?.township || normalizedSession.deliveryInfo?.city || null,
    interests: getSessionItems(normalizedSession).map((item) => item.product_name),
    current_intent: currentIntent,
    draft_order: cartDraftFromSession(normalizedSession),
  };
  if (sessionCustomerName(normalizedSession)) patch.customer_name = sessionCustomerName(normalizedSession);
  if (normalizedSession.phone) patch.phone = normalizedSession.phone;
  if (normalizedSession.address) patch.address = normalizedSession.address;

  await updateCustomerSession(from.id, patch);
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

function productMenuKeyboard(products) {
  return {
    inline_keyboard: sortProductsForMenu(products).map((product) => [
      { text: productDisplayName(product), callback_data: `product:${product.id}` },
    ]),
  };
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
    sessionCustomerName(session) ||
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
    status: getOrderStatus(session.deliveryInfo),
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    total_amount: totals.total,
    total: totals.deliveryFee === null ? null : totals.total,
    note: buildOrderNote(totals, session.deliveryInfo),
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
  const isGateDelivery = deliveryInfo?.delivery_flow === "gate" || getPaymentLabel(deliveryInfo) === "ကားဂိတ်တင်";
  const deliveryFeeLabel = isGateDelivery ? "Delivery fee / ဂိတ်တင်ခ" : "Delivery fee";
  const items = getSessionItems(session);
  const itemLines = items.map(
    (item, index) =>
      `${index + 1}. ${cleanHtml(productDisplayName(item.product || item.product_name))} x${item.quantity} = ${money(item.subtotal)}`
  );
  const message = [
    "<b>New Order</b>",
    `Order ID: ${cleanHtml(order.id)}`,
    `Status: ${cleanHtml(order.status || "pending")}`,
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "<b>Items</b>",
    ...itemLines,
    `Subtotal: ${money(totals.subtotal)}`,
    totals.freeDeliveryReason ? cleanHtml(totals.freeDeliveryReason) : "",
    `${deliveryFeeLabel}: ${
      totals.deliveryFee === null ? "Admin confirm" : totals.isFreeDelivery ? "Free" : money(totals.deliveryFee)
    }`,
    `Total: ${totals.deliveryFee === null ? "Admin confirm" : money(totals.total)}`,
    `Payment: ${cleanHtml(getPaymentLabel(deliveryInfo))}`,
    `အိမ်ရောက်ငွေချေ: ${cleanHtml(getCodLabel(deliveryInfo))}`,
    isGateDelivery ? "Payment note: customer must transfer payment before gate delivery. Highway cargo fee is paid at destination if needed." : "",
    deliveryInfo?.estimated_days ? `ETA: ${cleanHtml(deliveryInfo.estimated_days)}` : "",
    deliveryInfo?.note ? `Delivery note: ${cleanHtml(deliveryInfo.note)}` : "",
    !deliveryInfo ? "Note: Unknown delivery zone. Admin must confirm fee/payment." : "",
    order.note ? `Order note: ${cleanHtml(order.note)}` : "",
    "",
    `Customer: ${cleanHtml(sessionCustomerName(session) || order.customer_name || "")}`,
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

async function showCategories(chatId, prompt = "ပစ္စည်းရွေးပေးပါရှင့် 🛍") {
  const products = await getProducts();
  if (products.length === 0) {
    await sendMessage(chatId, TEXT.noProducts);
    return;
  }

  await sendMessage(chatId, prompt, {
    reply_markup: productMenuKeyboard(products),
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

async function sendProductImages(chatId, productName) {
  if (wasProductImageRecentlySent(chatId, productName)) {
    console.log("product images already sent", productName);
    return 0;
  }

  const files = productImageFiles(productName);
  const urls = files.map(publicProductImageUrl);
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  console.log("sending product images", productName, uniqueUrls);
  if (uniqueUrls.length === 0) return 0;

  let sentCount = 0;

  for (const imageUrl of uniqueUrls) {
    try {
      await sendPhoto(chatId, imageUrl);
      sentCount += 1;
    } catch (error) {
      console.error("Product storage photo failed", imageUrl, error.message);
    }
  }

  if (sentCount > 0) {
    markProductImagesSent(chatId, productName);
  }

  return sentCount;
}

async function showProduct(chatId, productId) {
  const product = await getProduct(productId);
  const sentMappedImages = await sendProductImages(chatId, product.name);

  if (!sentMappedImages && product.image_url) {
    try {
      await sendPhoto(chatId, product.image_url);
    } catch (error) {
      console.error("Product photo failed", error.message);
    }
  }

  await sendMessage(chatId, formatProductPhotoCaption(product), {
    reply_markup: productActionsKeyboard(product.id),
  });
}

function setSession(chatId, session) {
  const canonical = canonicalCustomerSession(session);
  sessions.set(String(chatId), {
    ...canonical,
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
      ? items.map((item) => `${productDisplayName(item.product || item.product_name)} x${item.quantity}`).join(", ")
      : `အရေအတွက်: ${session.quantity || 1} ခု`;
  const missing = missingCustomerInfoFields(session);
  const missingLines = missing.length > 0
    ? missing.map((field) => `* ${field}`).join("\n")
    : "* အချက်အလက်ပြည့်စုံပါပြီ";

  return [
    "ဟုတ်ညီမလေး🥰",
    "မဖူးကို",
    "",
    missingLines,
    "",
    "လေးပေးထားပေးနော်🥰🥰",
    "",
    `မှာယူမည့်ပစ္စည်း: ${itemText}`,
  ].join("\n");
}

function parseCustomerInfo(text, product = null) {
  const rawLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = rawLines
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
  const phoneLine = phoneIndex >= 0 ? lines[phoneIndex] : "";
  const beforePhone = phoneMatch ? phoneLine.slice(0, phoneMatch.index).trim() : "";
  const afterPhone = phoneMatch ? phoneLine.slice(phoneMatch.index + phoneMatch[0].length).trim() : "";
  const otherLines = lines.filter((_, index) => index !== phoneIndex);

  if (phoneIndex === 1 && lines[0] && lines.length >= 3) {
    return {
      customerName: rawLines[0],
      address: rawLines.slice(phoneIndex + 1).join("\n").trim(),
      phone,
    };
  }

  const rawCustomerName = beforePhone || (phoneIndex === 0 ? "" : otherLines[0] || "");
  const hasStandaloneNameLine = phoneIndex > 0 && rawCustomerName === lines[0];
  const customerName = hasStandaloneNameLine
    ? rawCustomerName
    : product
    ? cleanCustomerNameLine(rawCustomerName, product)
    : rawCustomerName;
  const address =
    afterPhone ||
    (phoneIndex >= 0
      ? lines.slice(phoneIndex + 1).join(", ").trim()
      : otherLines.slice(1).join(", ").trim());

  return { customerName, address, phone };
}

function sessionCustomerName(session) {
  return session?.customer_name || session?.customerName || "";
}

function canonicalCustomerSession(session) {
  const customerName = sessionCustomerName(session);
  return {
    ...(session || {}),
    customer_name: customerName || session?.customer_name || "",
    customerName: customerName || session?.customerName || "",
    phone: session?.phone || "",
    address: session?.address || "",
    city: session?.city || "",
  };
}

function missingCustomerInfoFields(session) {
  const missing = [];
  if (!sessionCustomerName(session)) missing.push("နာမည်");
  if (!session?.address) missing.push("လိပ်စာ(အိမ်/လမ်းနံပတ်ပါအပါ)");
  if (!session?.phone) missing.push("Phနံပတ်");
  return missing;
}

function hasCustomerInfo(session) {
  const info = canonicalCustomerSession(session);
  const result = Boolean(info.customer_name && info.address && info.phone);
  console.log("hasCustomerInfo", {
    hasCustomerName: Boolean(info.customer_name),
    hasPhone: Boolean(info.phone),
    hasAddress: Boolean(info.address),
    result,
  });
  return result;
}

function isUsefulAddress(value) {
  const text = String(value || "").trim();
  if (text.length < 8) return false;
  if (looksLikePhone(text)) return false;
  if (hasQuantityCue(text) && text.length < 25) return false;
  const normalized = normalizeText(text);
  return !includesAny(normalized, ["မှာမယ်", "ယူမယ်", "order", "buy"]);
}

function looksLikeCustomerName(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (looksLikePhone(text)) return false;
  if (hasQuantityCue(text) && text.length < 25) return false;
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["မှာမယ်", "ယူမယ်", "order", "buy", "ဘူး", "ခဲ", "set"])) return false;
  return text.length <= 40;
}

function mergeCustomerInfo(session, extractedInfo = {}) {
  const next = canonicalCustomerSession(session || {});
  const customerName = extractedInfo.customerName || extractedInfo.customer_name;

  if (customerName && looksLikeCustomerName(customerName)) {
    next.customer_name = customerName;
    next.customerName = customerName;
  }
  if (extractedInfo.phone && looksLikePhone(extractedInfo.phone)) {
    next.phone = extractedInfo.phone;
  }
  if (extractedInfo.address && isUsefulAddress(extractedInfo.address)) {
    next.address = extractedInfo.address;
  }
  if (extractedInfo.city || extractedInfo.last_city) {
    next.city = extractedInfo.city || extractedInfo.last_city;
  }

  console.log("customer info extracted", {
    customer_name: next.customer_name || null,
    phone: next.phone || null,
    address: next.address || null,
    city: next.city || null,
  });

  return next;
}

function sessionFromStoredCustomerInfo(session, storedSession) {
  if (!storedSession) return session;
  return mergeCustomerInfo(session, {
    customer_name: storedSession.customer_name,
    phone: storedSession.phone,
    address: storedSession.address,
    city: storedSession.last_city,
  });
}

async function completeOrderIfCustomerInfoReady(chatId, from, session, rawText = "") {
  if (!hasCustomerInfo(session)) return false;

  const deliveryInfo = session.deliveryInfo || await getDeliveryInfo(
    [rawText, session.city, session.address].filter(Boolean).join("\n")
  );
  const nextSession = {
    ...session,
    step: "confirm",
    awaiting_customer_info: false,
    customer_name: sessionCustomerName(session),
    customerName: sessionCustomerName(session),
    deliveryInfo,
    city: deliveryInfo
      ? [deliveryInfo.city, deliveryInfo.township].filter(Boolean).join(" / ")
      : session.city,
    paymentMethod: getPaymentLabel(deliveryInfo),
  };

  if (!nextSession.deliveryChoiceResolved && needsDeliveryChoice(nextSession, deliveryInfo, rawText)) {
    const choiceSession = {
      ...nextSession,
      step: "delivery_choice",
      awaiting_delivery_choice: true,
      pendingDeliveryInfo: deliveryInfo,
    };
    setSession(chatId, choiceSession);
    if (from?.id) {
      await persistDraftOrder(from, choiceSession, "delivery_choice");
    }
    await sendMessage(chatId, nearTownDeliveryQuestion(), {
      reply_markup: deliveryChoiceKeyboard(),
    });
    return true;
  }

  setSession(chatId, nextSession);
  if (from?.id) {
    await persistDraftOrder(from, nextSession, "order_intent");
  }
  await sendMessage(chatId, formatOrderSummary(nextSession), {
    reply_markup: confirmKeyboard(),
  });
  return true;
}

async function sendOrderSummaryOrDeliveryChoice(chatId, from, session, rawText = "") {
  return completeOrderIfCustomerInfoReady(chatId, from, session, rawText);
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
    await showCategories(
      chatId,
      "ဖျက်ရန် အတည်မပြုရသေးတဲ့ order မရှိတော့ပါဘူးရှင့်။ ပစ္စည်းလေး ပြန်ရွေးလို့ရပါတယ်။"
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

  await showCategories(chatId, "Order မလုပ်တော့ပါဘူးရှင့်။ Menu ကိုပြန်သွားပါမယ်။");
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

const QUANTITY_UNITS_PATTERN = "(?:ဘူး|ခု|ခဲ|set|sets|ဆက်|ဗူး)";
const BURMESE_QUANTITY_WORDS = [
  ["တစ်", 1],
  ["တခု", 1],
  ["တစ်ခု", 1],
  ["တစ်ဘူး", 1],
  ["တဘူး", 1],
  ["နှစ်", 2],
  ["နှစ်ဘူး", 2],
  ["သုံး", 3],
  ["သုံးဘူး", 3],
  ["လေး", 4],
  ["လေးဘူး", 4],
  ["ငါး", 5],
  ["ငါးဘူး", 5],
  ["ဆယ်", 10],
  ["ဆယ်ဘူး", 10],
].sort((left, right) => right[0].length - left[0].length);

function extractExplicitQuantity(text) {
  const normalized = normalizeMyanmarDigits(text);
  const parenRemoved = normalized.replace(/\([^)]*\)/g, " ");

  const unitNumberMatch = parenRemoved.match(
    new RegExp(`(?:^|\\s)(\\d{1,2})\\s*${QUANTITY_UNITS_PATTERN}`, "i")
  );
  if (unitNumberMatch) return Number(unitNumberMatch[1]);

  const numberUnitMatch = parenRemoved.match(
    new RegExp(`${QUANTITY_UNITS_PATTERN}\\s*(\\d{1,2})(?:\\s|$)`, "i")
  );
  if (numberUnitMatch) return Number(numberUnitMatch[1]);

  for (const [word, quantity] of BURMESE_QUANTITY_WORDS) {
    const escapedWord = escapeRegExp(word);
    const wordHasUnit = new RegExp(QUANTITY_UNITS_PATTERN, "i").test(word);
    const wordWithUnitPattern = wordHasUnit
      ? new RegExp(escapedWord, "i")
      : new RegExp(`${escapedWord}\\s*${QUANTITY_UNITS_PATTERN}|^\\s*${escapedWord}\\s*(?:ယူ|မှာ|$)`, "i");
    if (wordWithUnitPattern.test(parenRemoved)) return quantity;
  }

  const matches = [...parenRemoved.matchAll(/\d+/g)]
    .map((match) => match[0])
    .filter((raw) => raw.length <= 2 && !raw.startsWith("09"))
    .map((raw) => Number(raw))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 100);
  return matches[0] || null;
}

function extractQuantity(text, fallback = 1) {
  return extractExplicitQuantity(text) || fallback;
}

function hasQuantityCue(text) {
  const normalized = normalizeMyanmarDigits(text);
  const unitPattern = new RegExp(`\\d{1,2}\\s*${QUANTITY_UNITS_PATTERN}|${QUANTITY_UNITS_PATTERN}\\s*\\d{1,2}`, "i");
  if (unitPattern.test(normalized)) return true;
  return BURMESE_QUANTITY_WORDS.some(([word]) => {
    const escapedWord = escapeRegExp(word);
    const wordHasUnit = new RegExp(QUANTITY_UNITS_PATTERN, "i").test(word);
    const pattern = wordHasUnit
      ? new RegExp(escapedWord, "i")
      : new RegExp(`${escapedWord}\\s*${QUANTITY_UNITS_PATTERN}|^\\s*${escapedWord}\\s*(?:ယူ|မှာ|$)`, "i");
    return pattern.test(normalized);
  });
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

function mergeCartItemsWithUpdates(existingItems = [], updatedItems = []) {
  const map = new Map();
  for (const item of existingItems.filter(Boolean)) {
    map.set(String(item.product_id), { ...item });
  }
  for (const item of mergeCartItems(updatedItems).filter(Boolean)) {
    map.set(String(item.product_id), { ...item });
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

function withSessionQuantity(session, quantity) {
  const product = session.product || getSessionItems(session)[0]?.product;
  if (!product) return session;

  return {
    ...session,
    product,
    quantity,
    items: mergeCartItems([
      ...getSessionItems(session).filter((item) => String(item.product_id) !== String(product.id)),
      productToCartItem(product, quantity),
    ]),
  };
}

function myanmarNumber(value) {
  const digits = { 0: "၀", 1: "၁", 2: "၂", 3: "၃", 4: "၄", 5: "၅", 6: "၆", 7: "၇", 8: "၈", 9: "၉" };
  return String(value).replace(/\d/g, (digit) => digits[digit] || digit);
}

function productIdentityText(productOrItem) {
  const product = productOrItem?.product || productOrItem;
  return normalizeText(
    `${product?.name || productOrItem?.product_name || ""} ${productDisplayName(product || productOrItem?.product_name)}`
  );
}

function isBodyWashItem(item) {
  const name = productIdentityText(item);
  return name.includes("bodywash") || name.includes(normalizeText("ရေချိုးဆပ်ပြာ"));
}

function isWhiteningSoapItem(item) {
  const name = productIdentityText(item);
  return name.includes("whitening soap") || name.includes("soap") || name.includes(normalizeText("ဆပ်ပြာခဲ"));
}

function getProductFreeDeliveryQty(productOrItem) {
  if (isBodyWashItem(productOrItem)) return 3;
  if (isWhiteningSoapItem(productOrItem)) return 4;
  const product = productOrItem?.product || productOrItem;
  return Number(product?.free_delivery_qty || productOrItem?.free_delivery_qty || 0);
}

function calculateFreeDeliveryReason(items, label = "Deli free") {
  const bodyWash = items.find(isBodyWashItem);
  if (bodyWash && Number(bodyWash.quantity || 0) >= 3) {
    return {
      isFree: true,
      reason: `ရေချိုးဆပ်ပြာ ၃ဗူးယူထားလို့ ${label} ရပါတယ်ရှင့်🥰`,
    };
  }

  const soap = items.find(isWhiteningSoapItem);
  if (soap && Number(soap.quantity || 0) >= 4) {
    return {
      isFree: true,
      reason: `ဆပ်ပြာခဲ ၄ခဲယူထားလို့ ${label} ရပါတယ်ရှင့်🥰`,
    };
  }

  const productTypes = new Set(items.map((item) => String(item.product_id))).size;
  if (productTypes >= 3) {
    return {
      isFree: true,
      reason: `ပစ္စည်း ၃မျိုးယူထားလို့ ${label} ရပါတယ်ရှင့်🥰`,
    };
  }

  return { isFree: false, reason: "" };
}

function freeDeliveryReasonForItem(item) {
  const freeInfo = calculateFreeDeliveryReason([item]);
  if (!freeInfo.isFree) return "";
  const name = normalizeText(`${item.product_name || ""} ${productDisplayName(item.product || item.product_name)}`);
  if (name.includes("bodywash") || name.includes(normalizeText("ရေချိုးဆပ်ပြာ"))) {
    return `ရေချိုးဆပ်ပြာ ၃ဗူးယူထားလို့ Deli free ရပါတယ်ရှင့်🥰`;
  }
  if (name.includes("whitening soap") || name.includes("soap") || name.includes(normalizeText("ဆပ်ပြာခဲ"))) {
    return `ဆပ်ပြာခဲ ၄ခဲယူထားလို့ Deli free ရပါတယ်ရှင့်🥰`;
  }
  return freeInfo.reason;
}

function getFreeDeliveryLabel(deliveryInfo) {
  return deliveryInfo?.delivery_flow === "gate" || getPaymentLabel(deliveryInfo) === "ကားဂိတ်တင်"
    ? "တန်ဆာခ free"
    : "Deli free";
}

function getCartFreeDeliveryReason(items, deliveryInfo = null) {
  return calculateFreeDeliveryReason(items, getFreeDeliveryLabel(deliveryInfo)).reason;
}

function isCartFreeDelivery(items) {
  return Boolean(getCartFreeDeliveryReason(items));
}

function calculateCart(items, deliveryInfo = null) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const productTypes = new Set(items.map((item) => String(item.product_id))).size;
  const freeDeliveryReason = deliveryInfo?.delivery_flow === "foreign"
    ? ""
    : getCartFreeDeliveryReason(items, deliveryInfo);
  const isFreeDelivery = Boolean(freeDeliveryReason);
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
    freeDeliveryReason,
  };
}

function cartDraftFromSession(session) {
  const normalizedSession = canonicalCustomerSession(session);
  const items = getSessionItems(normalizedSession).map(({ product, ...item }) => item);
  const totals = calculateCart(getSessionItems(normalizedSession), normalizedSession.deliveryInfo);

  return {
    items,
    customer_name: sessionCustomerName(normalizedSession) || null,
    phone: normalizedSession.phone || null,
    address: normalizedSession.address || null,
    city: normalizedSession.city || normalizedSession.deliveryInfo?.township || normalizedSession.deliveryInfo?.city || null,
    delivery_fee: totals.deliveryFee,
    total: totals.deliveryFee === null ? null : totals.total,
    payment_method: getPaymentLabel(normalizedSession.deliveryInfo),
    status: getOrderStatus(normalizedSession.deliveryInfo),
  };
}

function getProductAliases(product) {
  const name = String(product.name || "").toLowerCase();
  const aliases = [name, productDisplayName(product)];

  if (name.includes("bodywash")) aliases.push("body wash", "bodywash", "ချိုး", "ရေချိုး", "ရေချိုးဆပ်ပြာ");
  if (name.includes("shampoo")) aliases.push("shampoo", "ခေါင်းလျှော်", "ခေါင်းလျော်", "ခေါင်းလျှော်ရည်", "ခေါင်းလျော်ရည်");
  if (name.includes("hairmask")) aliases.push("hair mask", "hairmask", "hair mask", "ပေါင်းဆေး");
  if (name.includes("hair oil")) aliases.push("ဆံပင်တုန်ဆီ", "တုန်ဆီ", "ဆံပင်ဆီ", "hair oil");
  if (name.includes("whitening") || name.includes("soap")) aliases.push("ဆပ်ပြာခဲ", "အသားဖြူဆပ်ပြာခဲ", "whitening soap", "soap");
  if (name.includes("toothpaste")) aliases.push("သွားတိုက်ဆေး", "သွားတိုက်ဆေး၂ဗူး1set", "toothpaste", "tooth paste", "toothpaste set", "tooth paste set");
  if (name.includes("acne")) aliases.push("မျက်နှာသစ်", "ဝက်ခြံပျောက်မျက်နှာသစ်", "ဝက်ခြံ", "face wash", "cleanser");
  if (name.includes("toner")) aliases.push("toner", "ချွေးပေါက်ကျဉ်း toner", "ချွေးပေါက်ကျဉ်း Toner", "ချွေးပေါက်", "pore");
  if (name.includes("detox")) aliases.push("essence", "essence serum", "အဆိပ်ထုတ် essence", "အဆိပ်ထုတ် Essence serum", "detox", "detox essence");

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
    .replace(new RegExp(`\\d+\\s*${QUANTITY_UNITS_PATTERN}`, "gi"), " ")
    .replace(new RegExp(`${QUANTITY_UNITS_PATTERN}\\s*\\d+`, "gi"), " ")
    .replace(/(ယူမယ်|ယူမယ်ရှင့်|ယူမယ်ရှင့်|မှာမယ်|မှာမယ်ရှင့်|မှာမယ်ရှင့်|လိုချင်|order|buy)/gi, " ")
    .replace(/\b(x|set|ဘူး|ခု|နဲ့|ရယ်)\b/gi, " ")
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
  const items = extractCartItems(text, products, existingItems);
  const product = items[0]?.product || existingSession?.product || null;
  if (items.length === 0 || !product) return null;

  const parsed = parseCustomerInfo(
    text,
    items.map((item) => item.product)
  );
  const mergedInfo = mergeCustomerInfo(existingSession || {}, parsed);
  if (!hasCustomerInfo(mergedInfo)) return null;
  const deliveryInfo = await getDeliveryInfo(`${text}\n${mergedInfo.address}`);
  const city =
    deliveryInfo
      ? [deliveryInfo.city, deliveryInfo.township].filter(Boolean).join(" / ")
      : mergedInfo.address.split(/[,\s]+/).find((part) => part.length > 2) || "";

  return {
    ...(existingSession || {}),
    step: "confirm",
    product,
    quantity: items[0]?.quantity || 1,
    items,
    customerName: sessionCustomerName(mergedInfo) || from.first_name || "",
    phone: mergedInfo.phone,
    address: mergedInfo.address,
    city,
    deliveryInfo,
    paymentMethod: getPaymentLabel(deliveryInfo),
    from,
  };
}

async function handleStart(chatId) {
  clearSession(chatId);
  await showCategories(chatId, TEXT.greeting);
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

  if (data === "use_saved_info") {
    const session = getSession(chatId);
    if (!session || !hasCustomerInfo(session)) {
      await showCategories(chatId, "သိမ်းထားတဲ့ လိပ်စာအချက်အလက် မတွေ့သေးပါဘူးရှင့်။ ပစ္စည်းလေး ပြန်ရွေးပေးပါနော်။");
      return;
    }
    await completeOrderIfCustomerInfoReady(chatId, from, session);
    return;
  }

  if (data === "new_customer_info") {
    const session = getSession(chatId);
    if (!session) {
      await showCategories(chatId, "အော်ဒါအချက်အလက် မတွေ့တော့ပါဘူးရှင့်။ ပစ္စည်းလေး ပြန်ရွေးပေးပါနော်။");
      return;
    }
    const nextSession = {
      ...session,
      step: "customer_address",
      awaiting_customer_info: true,
      address: "",
      deliveryInfo: null,
      city: null,
    };
    setSession(chatId, nextSession);
    await persistDraftOrder(from, nextSession, "order_intent");
    await sendMessage(chatId, "လိပ်စာအသစ်ကို အိမ်/လမ်းနံပတ်ပါအောင် ပေးပေးပါနော်🥰");
    return;
  }

  if (data.startsWith("order:")) {
    const product = await getProduct(data.slice(6));
    const storedSession = await getCustomerSession(from.id);
    const session = sessionFromStoredCustomerInfo({
      step: "customer_info",
      awaiting_customer_info: true,
      product,
      quantity: 1,
      items: [productToCartItem(product, 1)],
      from,
    }, storedSession);
    setSession(chatId, session);
    await persistDraftOrder(from, session, "order_intent");

    if (hasCustomerInfo(session)) {
      await sendMessage(chatId, "အရင်လိပ်စာနဲ့ပဲပို့ပေးရမလားရှင့်?", {
        reply_markup: savedCustomerInfoKeyboard(),
      });
      return;
    }

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
      awaiting_customer_info: true,
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
      await completeOrderIfCustomerInfoReady(chatId, from, nextSession);
      return;
    }

    setSession(chatId, nextSession);
    await persistDraftOrder(from, nextSession, "order_intent");
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

  if (data.startsWith("delivery_choice:")) {
    const choice = data.split(":")[1];
    const session = getSession(chatId);
    if (!session || session.step !== "delivery_choice") {
      await showCategories(chatId, "အော်ဒါအချက်အလက် မတွေ့တော့ပါဘူးရှင့်။ ပစ္စည်းလေး ပြန်ရွေးပေးပါနော်။");
      return;
    }

    const chosenDeliveryInfo =
      choice === "gate"
        ? gateInfoFromMatchedZone(session.pendingDeliveryInfo || session.deliveryInfo, session.address)
        : session.pendingDeliveryInfo || session.deliveryInfo;
    const nextSession = {
      ...session,
      step: "confirm",
      awaiting_delivery_choice: false,
      deliveryChoiceResolved: true,
      deliveryInfo: chosenDeliveryInfo,
      city: chosenDeliveryInfo
        ? [chosenDeliveryInfo.city, chosenDeliveryInfo.township].filter(Boolean).join(" / ")
        : session.city,
      paymentMethod: getPaymentLabel(chosenDeliveryInfo),
    };
    delete nextSession.pendingDeliveryInfo;
    setSession(chatId, nextSession);
    await persistDraftOrder(from, nextSession, "order_intent");
    await sendMessage(chatId, formatOrderSummary(nextSession), {
      reply_markup: confirmKeyboard(),
    });
    return;
  }

  if (data === "confirm_order") {
    const session = getSession(chatId);
    if (!session || session.step !== "confirm") {
      await showCategories(chatId, "အော်ဒါအချက်အလက် မတွေ့တော့ပါဘူးရှင့်။ ပစ္စည်းလေး ပြန်ရွေးပေးပါနော်။");
      return;
    }

    const { order, totals } = await saveOrder(callback.message.chat, from, session);
    await notifyAdmin(order, totals, session, from);
    await updateCustomerSession(from.id, {
      last_product: getSessionItems(session).map((item) => item.product_name).join(", "),
      last_city: session.city || session.deliveryInfo?.township || session.deliveryInfo?.city || null,
      customer_name: sessionCustomerName(session) || null,
      phone: session.phone || null,
      address: session.address || null,
      interests: getSessionItems(session).map((item) => item.product_name),
      current_intent: "order_confirmed",
      draft_order: null,
    });
    clearSession(chatId);
    await sendMessage(chatId, TEXT.orderSaved, { reply_markup: removeKeyboard() });
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
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
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
    const displayName = normalizeText(productDisplayName(product));
    const category = normalizeText(product.category);
    return (
      (name && normalized.includes(name)) ||
      (displayName && normalized.includes(displayName)) ||
      getProductAliases(product).some((alias) => normalized.includes(normalizeText(alias))) ||
      (category && normalized.includes(category))
    );
  });
}

async function shouldShowProductMenuForText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (await findMatchingProduct(text)) return false;

  const menuKeywords = [
    "hi",
    "hello",
    "hey",
    "မင်္ဂလာပါ",
    "မဂ်လာပါ",
    "မင်္ဂလာ",
    "ဟိုင်း",
    "စျေးမေး",
    "ဈေးမေး",
    "စျေးသိ",
    "ဈေးသိ",
    "product",
    "ပစ္စည်း",
    "ကုန်ပစ္စည်း",
    "ကြည့်ချင်",
    "ကြည့်ချင်",
    "ကြည့်မယ်",
    "ကြည့်မယ်",
    "ဘာတွေရှိ",
    "ရှိတာ",
    "ပြပါ",
  ];
  if (includesAny(normalized, menuKeywords)) return true;

  const actionableKeywords = [
    "မှာ",
    "order",
    "ဝယ်",
    "ယူမယ်",
    "လိုချင်",
    "ပို့",
    "delivery",
    "deli",
    "cod",
    "ငွေချေ",
    "မြို့",
    "မြို့နယ်",
    "အသုံး",
    "သုံး",
    "benefit",
    "ကောင်း",
    "ဝက်ခြံ",
    "အသား",
    "ဆံပင်",
    "ချွေးပေါက်",
    "sensitive",
    "skin",
  ];

  return !includesAny(normalized, actionableKeywords);
}

async function recommendByConcern(chatId, text) {
  const normalized = normalizeText(text);
  const products = await getProducts();

  const concernRules = [
    {
      keywords: ["ဝက်ခြံ", "acne", "pimple"],
      productWords: ["acne", "face wash"],
      reply:
        "ဝက်ခြံအတွက်ဆို ဝက်ခြံပျောက်မျက်နှာသစ် ကို အရင်ကြည့်လို့ရပါတယ်ရှင့်။ Skin sensitive ဖြစ်ရင် နေ့တိုင်းမသုံးခင် နည်းနည်းစမ်းသုံးပေးပါနော်။",
    },
    {
      keywords: ["ချွေးနံ့", "body", "bodywash", "အနံ့"],
      productWords: ["bodywash", "body wash"],
      reply: "Body care အတွက် ရေချိုးဆပ်ပြာဗူး(အဝါ) ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["ဆံပင်", "ဗောက်", "shampoo", "hair"],
      productWords: ["shampoo", "hair mask", "hair oil"],
      reply: "ဆံပင်အတွက် ခေါင်းလျော်ရည်ဗူး(အဖြူ), ပေါင်းဆေး(ဗူး)အမဲ, ဆံပင်တုန်ဆီ တွေရှိပါတယ်ရှင့်။",
    },
    {
      keywords: ["ဖြူ", "whitening", "soap"],
      productWords: ["whitening", "soap"],
      reply: "Whitening care အတွက် ဆပ်ပြာခဲ ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["သွား", "tooth", "toothpaste"],
      productWords: ["toothpaste"],
      reply: "သွားတိုက်ဆေး Set အတွက် သွားတိုက်ဆေး၂ဗူး1set ရှိပါတယ်ရှင့်။",
    },
    {
      keywords: ["ချွေးပေါက်", "pore", "toner"],
      productWords: ["pore", "toner"],
      reply: "ချွေးပေါက်ကျဉ်းချင်ရင် ချွေးပေါက်ကျဉ်း Toner ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
    {
      keywords: ["detox", "essence", "အဆီ"],
      productWords: ["detox", "essence"],
      reply: "Skin care အတွက် အဆိပ်ထုတ် Essence serum ကို ကြည့်လို့ရပါတယ်ရှင့်။",
    },
  ];

  const rule = concernRules.find((item) => includesAny(normalized, item.keywords));
  if (!rule) return false;

  const matchedProducts = products.filter((product) => {
    const haystack = normalizeText(
      `${product.name} ${productDisplayName(product)} ${product.category} ${product.description}`
    );
    return rule.productWords.some((word) => haystack.includes(word));
  });

  if (matchedProducts.length === 0) {
    await sendMessage(chatId, rule.reply, {
      reply_markup: productMenuKeyboard(products),
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
      display_name: productDisplayName(product),
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
    "Never invent products or delivery zones. Pick product_name only from product data if clear. Product data has English name and Burmese display_name.",
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
    products.find((product) => normalizeText(productDisplayName(product)) === normalizedName) ||
    products.find((product) => normalizeText(product.name).includes(normalizedName)) ||
    products.find((product) => normalizeText(productDisplayName(product)).includes(normalizedName)) ||
    products.find((product) =>
      getProductAliases(product).some((alias) => normalizedText.includes(normalizeText(alias)))
    ) ||
    null
  );
}

function extractQuantityNearAlias(text, alias) {
  const normalized = normalizeMyanmarDigits(text);
  const lower = normalized.toLowerCase();
  const normalizedAlias = normalizeMyanmarDigits(alias).toLowerCase();
  const aliasIndex = lower.indexOf(normalizedAlias);
  if (aliasIndex === -1) return 1;

  const after = lower.slice(aliasIndex + normalizedAlias.length, aliasIndex + normalizedAlias.length + 40);
  const before = lower.slice(Math.max(0, aliasIndex - 20), aliasIndex);
  return extractExplicitQuantity(after) || extractExplicitQuantity(before) || 1;
}

function extractSharedQuantity(text) {
  const normalized = normalizeMyanmarDigits(text);
  const patterns = [
    new RegExp(`(\\d{1,2})\\s*${QUANTITY_UNITS_PATTERN}?\\s*စီ`, "i"),
    /(\d{1,2})\s*each/i,
    new RegExp(`တစ်မျိုး\\s*(\\d{1,2})\\s*${QUANTITY_UNITS_PATTERN}?\\s*စီ`, "i"),
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return Number(match[1]);
  }
  for (const [word, quantity] of BURMESE_QUANTITY_WORDS) {
    const escapedWord = escapeRegExp(word);
    const pattern = new RegExp(`${escapedWord}\\s*${QUANTITY_UNITS_PATTERN}?\\s*စီ`, "i");
    if (pattern.test(normalized)) return quantity;
  }
  return null;
}

function findProductMentions(text, products) {
  const normalized = normalizeText(text);
  const mentions = [];

  for (const product of products) {
    const aliases = getProductAliases(product).sort((a, b) => b.length - a.length);
    let bestMention = null;
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      const index = normalized.indexOf(normalizedAlias);
      if (index === -1) continue;
      if (!bestMention || normalizedAlias.length > bestMention.normalizedAlias.length) {
        bestMention = { product, alias, normalizedAlias, index };
      }
    }
    if (bestMention) mentions.push(bestMention);
  }

  return mentions.sort((left, right) => left.index - right.index);
}

function extractCartItems(text, products, existingCart = []) {
  const sharedQuantity = extractSharedQuantity(text);
  const mentions = findProductMentions(text, products);
  const updatedItems = mentions.map((mention) =>
    productToCartItem(
      mention.product,
      sharedQuantity || extractQuantityNearAlias(text, mention.alias)
    )
  );

  if (updatedItems.length === 0) {
    return mergeCartItems(existingCart);
  }

  return mergeCartItemsWithUpdates(existingCart, updatedItems);
}

function extractCartItemsFromText(text, products) {
  return extractCartItems(text, products, []);
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
  if (zone.delivery_flow === "foreign") {
    return "နိုင်ငံခြားပို့ခကို သီးသန့်တွက်ပေးပါမယ်ရှင့်။";
  }

  const payment = zone.cod_available
    ? "အိမ်ရောက်ငွေချေ ရပါတယ်ရှင့်။"
    : "ကားဂိတ်တင် ဖြစ်ပါတယ်ရှင့်။";
  const feeLabel = zone.delivery_flow === "gate" ? "ဂိတ်တင်ခ" : "delivery fee";

  return [
    `${zone.township || zone.city || "အဲဒီမြို့"} အတွက် ${feeLabel} ${money(zone.delivery_fee)} ပါရှင့်။`,
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
    textItems.length > 0 || aiItems.length > 0
      ? mergeCartItemsWithUpdates(textItems, aiItems)
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
    await showCategories(chatId, TEXT.greeting);
    return true;
  }

  if (intent.intent === "delivery_question") {
    await sendMessage(chatId, deliveryReply(deliveryInfo), {
      reply_markup: productMenuKeyboard(products),
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
        reply_markup: productMenuKeyboard(products),
      });
      return true;
    }

    const hasFreshCustomerInfo = Boolean(intent.customer_name || intent.phone || intent.address);
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
      setSession(chatId, session);
      await persistDraftOrder(from, session, "order_intent");
      if (!hasFreshCustomerInfo && storedSession?.customer_name && storedSession?.phone && storedSession?.address) {
        await sendMessage(chatId, "အရင်လိပ်စာနဲ့ပဲပို့ပေးရမလားရှင့်?", {
          reply_markup: savedCustomerInfoKeyboard(),
        });
        return true;
      }
      await completeOrderIfCustomerInfoReady(chatId, from, session, text);
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
    "When mentioning products to customers, use product display_name, not the English internal name.",
    "Keep the reply short, warm, and sales-friendly. Prefer 2 to 5 short lines.",
    "Never show internal status/payment words to customers: COD, prepaid, needs_review, pending_cod, awaiting_payment. Use customer labels only: အိမ်ရောက်ငွေချေ, ကားဂိတ်တင်, or Admin confirm.",
    "If the customer asks for usage, explain from usage_instruction only.",
    "If the customer asks for benefits, explain from benefits only.",
    "If the customer asks about price, mention product price and unit only from the data.",
    "Free delivery rules: BodyWash quantity >= 3, Whitening Soap quantity >= 4, or 3 different product types. For non-COD Myanmar gate delivery, call it တန်ဆာခ free. For COD cities, call it Deli free.",
    "Delivery and payment must use delivery_zones data first. COD zones use အိမ်ရောက်ငွေချေ. Myanmar cities/townships without COD use ကားဂိတ်တင် with 3,000 Ks ဂိတ်တင်ခ. International/foreign addresses use Admin confirm.",
    "If the customer wants to buy or order, tell them to choose the product and press the 'မှာမယ်' order button.",
    "If customer mentions multiple products, answer for all of them and explain mixed-cart free delivery only if there are 3 different product types.",
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
      wantsToOrder && !reply.includes("မှာမယ်")
        ? "\n\nမှာယူချင်ရင် product ကိုရွေးပြီး “မှာမယ်” button ကိုနှိပ်ပေးပါရှင့်။"
        : "";

    await sendMessage(chatId, cleanHtml(`${reply}${suffix}`), {
      reply_markup: matchedProduct
        ? productActionsKeyboard(matchedProduct.id)
        : productMenuKeyboard(products),
    });
    return true;
  } catch (error) {
    console.error(
      "OpenRouter failed",
      error.response?.data?.error?.message || error.message
    );
    await showCategories(chatId, fallbackAiReply());
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
    await showCategories(chatId, TEXT.greeting);
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

  const wantsPaymentNumber =
    includesAny(normalized, ["ငွေလွှဲ", "လွှဲရ", "kpay", "wave", "payment number"]) ||
    (includesAny(normalized, ["နံပါတ်", "number"]) && includesAny(normalized, ["ငွေ", "လွှဲ", "kpay", "wave", "payment"]));

  if (wantsPaymentNumber) {
    await sendMessage(chatId, paymentInstructionsText());
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
      "အိမ်ရောက်ငွေချေ ရတဲ့မြို့တွေမှာ ပစ္စည်းရောက်မှ ငွေချေပေးလို့ရပါတယ်ရှင့်။ COD မရတဲ့ မြန်မာမြို့တွေကိုတော့ ကားဂိတ်တင်နဲ့ လွှဲငွေချေပါရှင့်။"
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
      "Product တစ်ခုချင်းစီမှာ စျေးနှုန်း၊ Deli free, အသုံးပြုပုံနဲ့ ကောင်းကျိုးကို တခါတည်း ဖော်ပြပေးထားပါတယ်ရှင့်။"
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
      "Product ကိုရွေးလိုက်တာနဲ့ ကောင်းကျိုးနဲ့ အသုံးပြုပုံကို တခါတည်း ဖတ်နိုင်ပါတယ်ရှင့်။"
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
      "မှာယူမယ်ဆို ပစ္စည်းရွေးပြီး “မှာမယ်” button ကိုနှိပ်ပေးပါရှင့်။"
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

  let activeSession = session;
  if (activeSession && text) {
    const products = await getProducts();
    const messageQuantity = hasQuantityCue(text) ? extractQuantity(text, null) : null;
    const sessionItems = getSessionItems(activeSession);
    const textCartItems = extractCartItems(text, products, sessionItems);
    const productMentionChanged =
      textCartItems.length !== sessionItems.length ||
      textCartItems.some((item) => {
        const existing = sessionItems.find((oldItem) => String(oldItem.product_id) === String(item.product_id));
        return !existing || Number(existing.quantity || 0) !== Number(item.quantity || 0);
      });
    const quantitySession = productMentionChanged
      ? {
          ...activeSession,
          product: textCartItems[0]?.product || activeSession.product,
          quantity: textCartItems[0]?.quantity || activeSession.quantity,
          items: textCartItems,
        }
      : messageQuantity && sessionItems.length === 1
        ? withSessionQuantity(activeSession, messageQuantity)
        : activeSession;
    const parsed = parseCustomerInfo(text, getSessionItems(quantitySession).map((item) => item.product));
    const mergedSession = mergeCustomerInfo(quantitySession, parsed);
    const mergedItems = getSessionItems(mergedSession);
    const quantityChanged =
      productMentionChanged ||
      (messageQuantity &&
        sessionItems.length === 1 &&
        mergedItems.length === 1 &&
        Number(sessionItems[0]?.quantity || 0) !== Number(mergedItems[0]?.quantity || 0));
    if (
      quantityChanged ||
      mergedSession.customer_name !== activeSession.customer_name ||
      mergedSession.customerName !== activeSession.customerName ||
      mergedSession.phone !== activeSession.phone ||
      mergedSession.address !== activeSession.address ||
      mergedSession.city !== activeSession.city
    ) {
      activeSession = mergedSession;
      setSession(chatId, activeSession);
      await persistDraftOrder(message.from, activeSession, "order_intent");
      if (hasCustomerInfo(activeSession) && getSessionItems(activeSession).length > 0) {
        await completeOrderIfCustomerInfoReady(chatId, message.from, activeSession, text);
        return;
      }
      if (quantityChanged || activeSession.step === "customer_info") {
        await sendMessage(chatId, orderInfoPrompt(activeSession), {
          reply_markup: quantityKeyboard(activeSession.product.id),
        });
        return;
      }
    }
  }

  if (!activeSession && text) {
    const textOrderSession = await buildOrderSessionFromText(text, message.from);
    if (textOrderSession) {
      await sendOrderSummaryOrDeliveryChoice(chatId, message.from, textOrderSession, text);
      return;
    }
  }

  if (activeSession?.step === "quantity") {
    const quantity = text ? extractQuantity(text, null) : null;
    if (!quantity) {
      await sendMessage(chatId, "အရေအတွက်လေး 1, 2, 3 ဒါမှမဟုတ် ၂ဘူး စသဖြင့် ပြန်ပေးပေးပါနော်🥰", {
        reply_markup: quantityKeyboard(activeSession.product.id),
      });
      return;
    }

    const parsed = parseCustomerInfo(text, getSessionItems(activeSession).map((item) => item.product));
    const nextSession = mergeCustomerInfo({
      ...withSessionQuantity(activeSession, quantity),
      step: "customer_info",
    }, parsed);
    if (await completeOrderIfCustomerInfoReady(chatId, message.from, nextSession, text)) {
      return;
    }
    setSession(chatId, nextSession);
    await persistDraftOrder(message.from, nextSession, "order_intent");
    await sendMessage(chatId, orderInfoPrompt(nextSession), {
      reply_markup: quantityKeyboard(nextSession.product.id),
    });
    return;
  }

  if (activeSession?.step === "customer_info") {
    if (!text) {
      await sendMessage(chatId, orderInfoPrompt(activeSession), {
        reply_markup: quantityKeyboard(activeSession.product.id),
      });
      return;
    }

    if (hasQuantityCue(text) && !looksLikePhone(text)) {
      const quantity = extractQuantity(text, null);
      if (quantity) {
        const parsed = parseCustomerInfo(text, getSessionItems(activeSession).map((item) => item.product));
        const nextSession = mergeCustomerInfo(withSessionQuantity(activeSession, quantity), parsed);
        if (await completeOrderIfCustomerInfoReady(chatId, message.from, nextSession, text)) {
          return;
        }
        setSession(chatId, nextSession);
        await persistDraftOrder(message.from, nextSession, "order_intent");
        await sendMessage(chatId, orderInfoPrompt(nextSession), {
          reply_markup: quantityKeyboard(nextSession.product.id),
        });
        return;
      }
    }

    const textOrderSession = await buildOrderSessionFromText(text, message.from, activeSession);
    if (textOrderSession) {
      await sendOrderSummaryOrDeliveryChoice(chatId, message.from, textOrderSession, text);
      return;
    }

    const parsed = parseCustomerInfo(text, getSessionItems(activeSession).map((item) => item.product));
    const nextSession = mergeCustomerInfo(activeSession, parsed);
    if (hasCustomerInfo(nextSession)) {
      await completeOrderIfCustomerInfoReady(chatId, message.from, nextSession, text);
      return;
    }
    if (nextSession.customerName || nextSession.phone || nextSession.address) {
      setSession(chatId, nextSession);
      await persistDraftOrder(message.from, nextSession, "order_intent");
      await sendMessage(chatId, orderInfoPrompt(nextSession), {
        reply_markup: quantityKeyboard(nextSession.product.id),
      });
      return;
    }

    setSession(chatId, {
      ...activeSession,
      step: "customer_address",
      customer_name: text,
      customerName: text,
      awaiting_customer_info: true,
    });
    await sendMessage(chatId, "လိပ်စာအပြည့်အစုံလေး ပေးပေးပါနော်🥰");
    return;
  }

  if (activeSession?.step === "customer_address") {
    const textOrderSession = await buildOrderSessionFromText(text, message.from, activeSession);
    if (textOrderSession) {
      await sendOrderSummaryOrDeliveryChoice(chatId, message.from, textOrderSession, text);
      return;
    }

    const parsed = parseCustomerInfo(text, getSessionItems(activeSession).map((item) => item.product));
    const mergedSession = mergeCustomerInfo(activeSession, parsed);
    if (await completeOrderIfCustomerInfoReady(chatId, message.from, mergedSession, text)) {
      return;
    }
    if (mergedSession.phone && !mergedSession.address) {
      setSession(chatId, mergedSession);
      await persistDraftOrder(message.from, mergedSession, "order_intent");
      await sendMessage(chatId, "လိပ်စာအပြည့်အစုံလေး ပေးပေးပါနော်🥰");
      return;
    }

    if (!text || text.length < 8) {
      await sendMessage(chatId, "လိပ်စာကို အိမ်/လမ်းနံပတ်ပါအောင် နည်းနည်းပိုပြည့်စုံအောင် ပေးပေးပါနော်🥰");
      return;
    }

    const nextSession = {
      ...activeSession,
      step: "customer_phone",
      address: text,
      awaiting_customer_info: true,
    };
    setSession(chatId, nextSession);
    await persistDraftOrder(message.from, nextSession, "order_intent");
    await sendMessage(chatId, "Phနံပတ်လေး ပေးပေးပါနော်🥰");
    return;
  }

  if (activeSession?.step === "customer_phone") {
    const textOrderSession = await buildOrderSessionFromText(text, message.from, activeSession);
    if (textOrderSession) {
      await sendOrderSummaryOrDeliveryChoice(chatId, message.from, textOrderSession, text);
      return;
    }

    const parsed = parseCustomerInfo(text, getSessionItems(activeSession).map((item) => item.product));
    const mergedSession = mergeCustomerInfo(activeSession, parsed);
    if (await completeOrderIfCustomerInfoReady(chatId, message.from, mergedSession, text)) {
      return;
    }

    const phone = message.contact?.phone_number || text;
    if (!phone || (!message.contact && !looksLikePhone(phone))) {
      await sendMessage(chatId, "Phနံပတ်လေး မှန်အောင် ပြန်ပေးပေးပါနော်🥰");
      return;
    }

    const deliveryInfo = await getDeliveryInfo(activeSession.address);
    const nextSession = {
      ...activeSession,
      step: "confirm",
      awaiting_customer_info: false,
      phone,
      deliveryInfo,
      city: deliveryInfo?.township || deliveryInfo?.city || activeSession.city,
      paymentMethod: getPaymentLabel(deliveryInfo),
    };
    setSession(chatId, nextSession);
    await persistDraftOrder(message.from, nextSession, "order_intent");
    await sendOrderSummaryOrDeliveryChoice(chatId, message.from, nextSession, text);
    return;
  }

  if (activeSession?.step === "phone") {
    const phone = message.contact?.phone_number || text;
    if (!phone || (!message.contact && !looksLikePhone(phone))) {
      await sendMessage(chatId, "ဖုန်းနံပါတ်ကို မှန်မှန်ကန်ကန် ရိုက်ပေးပါရှင့်။");
      return;
    }

    setSession(chatId, {
      ...activeSession,
      step: "address",
      phone,
    });
    await sendMessage(chatId, TEXT.askAddress, { reply_markup: removeKeyboard() });
    return;
  }

  if (activeSession?.step === "address") {
    if (!text || text.length < 8) {
      await sendMessage(chatId, "လိပ်စာကို နည်းနည်းပိုပြည့်စုံအောင် ရိုက်ပေးပါရှင့်။");
      return;
    }

    const nextSession = {
      ...activeSession,
      step: "confirm",
      address: text,
    };
    setSession(chatId, nextSession);
    await sendOrderSummaryOrDeliveryChoice(chatId, message.from, nextSession, text);
    return;
  }

  if (text && (await shouldShowProductMenuForText(text))) {
    await showCategories(chatId, TEXT.greeting);
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

  await showCategories(chatId, TEXT.unknown);
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
  calculateCart,
  calculateOrder,
  extractCartItems,
  extractQuantity,
  formatOrderSummary,
  isLikelyMyanmarAddress,
  looksLikeVillageNearTownAddress,
  matchDeliveryZoneFromList,
  parseCustomerInfo,
  productImageFiles,
  startPolling,
  startServer,
};
