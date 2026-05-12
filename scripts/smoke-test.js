const http = require("http");
const {
  app,
  extractCartItems,
  extractQuantity,
  matchDeliveryZoneFromList,
  productImageFiles,
} = require("../index");

const quantityCases = [
  ["2ဗူးနော်", 2],
  ["၂ဗူးယူမယ်", 2],
  ["နှစ်ဘူးယူမယ်", 2],
  ["4ခဲ", 4],
  ["၂set", 2],
];

for (const [input, expected] of quantityCases) {
  const actual = extractQuantity(input, null);
  if (actual !== expected) {
    console.error(`Quantity test failed: ${input} => ${actual}, expected ${expected}`);
    process.exit(1);
  }
}

const mockProducts = [
  { id: 1, name: "BodyWash", price: 38000, unit: "ဘူး" },
  { id: 2, name: "Shampoo", price: 38000, unit: "ဘူး" },
  { id: 3, name: "HairMask", price: 45000, unit: "ဘူး" },
  { id: 4, name: "Hair Oil", price: 38000, unit: "ဘူး" },
  { id: 5, name: "Whitening Soap", price: 15000, unit: "ခဲ" },
  { id: 6, name: "Toothpaste Set", price: 38000, unit: "set" },
  { id: 7, name: "Acne Face Wash", price: 38000, unit: "ဘူး" },
  { id: 8, name: "Pore Tightening Toner", price: 45000, unit: "ဘူး" },
  { id: 9, name: "Detox Essence", price: 45000, unit: "ဘူး" },
];

const cartCases = [
  ["ရေချိုးဆပ်ပြာ 1 ဗူး", [["BodyWash", 1]]],
  ["ရေချိုးဆပ်ပြာ 2 ဗူး သွားတိုက်ဆေး 1 set", [["BodyWash", 2], ["Toothpaste Set", 1]]],
  ["BodyWash 1 နဲ့ Shampoo 1", [["BodyWash", 1], ["Shampoo", 1]]],
  ["ရေချိုးဆပ်ပြာရယ် သွားတိုက်ဆေးရယ်", [["BodyWash", 1], ["Toothpaste Set", 1]]],
  ["ဆပ်ပြာခဲ 4 ခဲနဲ့ ဆံပင်တုန်ဆီ 1 ဗူး", [["Whitening Soap", 4], ["Hair Oil", 1]]],
  ["ပေါင်းဆေးနဲ့ ခေါင်းလျော်ရည် ၂ဘူးစီ", [["HairMask", 2], ["Shampoo", 2]]],
];

for (const [input, expectedItems] of cartCases) {
  const actualItems = extractCartItems(input, mockProducts);
  for (const [productName, quantity] of expectedItems) {
    const item = actualItems.find((cartItem) => cartItem.product_name === productName);
    if (!item || item.quantity !== quantity) {
      console.error(`Cart test failed: ${input} missing ${productName} x${quantity}. Actual: ${JSON.stringify(actualItems)}`);
      process.exit(1);
    }
  }
  if (actualItems.length !== expectedItems.length) {
    console.error(`Cart test failed: ${input} item count ${actualItems.length}, expected ${expectedItems.length}`);
    process.exit(1);
  }
}

const mockZones = [
  { city: "ရန်ကုန်", township: null, aliases: [], cod_available: true, delivery_fee: 4800 },
  { city: "ရန်ကုန်အဝေးမြို့နယ်များ", township: null, aliases: [], cod_available: true, delivery_fee: 6300 },
  { city: "မန္တလေး", township: null, aliases: [], cod_available: true, delivery_fee: 4800 },
  { city: "မန္တလေးအဝေးမြို့များ", township: null, aliases: [], cod_available: true, delivery_fee: 6300 },
  { city: "နေပြည်တော်", township: null, aliases: [], cod_available: true, delivery_fee: 4800 },
];

const zoneCases = [
  ["လှိုင်", 4800],
  ["လှိုင်သာယာ", 6300],
  ["ချမ်းမြသာစည်", 4800],
  ["စဉ့်ကိုင်", 6300],
  ["ဒလ", 6300],
  ["သင်္ဃန်းကျွန်း", 4800],
  ["နေပြည်တော်", 4800],
];

for (const [input, expectedFee] of zoneCases) {
  const zone = matchDeliveryZoneFromList(input, mockZones);
  if (!zone || zone.delivery_fee !== expectedFee) {
    console.error(`Zone test failed: ${input} => ${zone?.delivery_fee}, expected ${expectedFee}`);
    process.exit(1);
  }
}

const imageCases = [
  ["BodyWash", ["bodywashprice.jpg", "bodywashusage.png"]],
  ["Shampoo", ["shampooprice.jpg", "shampoousage.jpg"]],
  ["HairMask", ["hairmaskprice.jpg", "hairmaskusage.jpg"]],
  ["Hair Oil", ["hairessentialoil.jpg", "hairessentialoilusage.png"]],
  ["Whitening Soap", ["soapprice.jpg", "soapusage.jpg"]],
  ["Toothpaste Set", ["toothpasteprice.jpg", "toothpasteusage.png"]],
  ["Acne Face Wash", ["cleanserprice.jpg"]],
];

for (const [productName, expectedFiles] of imageCases) {
  const actualFiles = productImageFiles(productName);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    console.error(`Image mapping test failed: ${productName} => ${JSON.stringify(actualFiles)}, expected ${JSON.stringify(expectedFiles)}`);
    process.exit(1);
  }
}

const server = app.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  const request = http.get(
    {
      hostname: "127.0.0.1",
      port,
      path: "/health",
      timeout: 3000,
    },
    (response) => {
      let body = "";

      response.on("data", (chunk) => {
        body += chunk;
      });

      response.on("end", () => {
        if (response.statusCode !== 200 || !body.includes('"ok":true')) {
          console.error(`Unexpected health response: ${response.statusCode} ${body}`);
          server.close(() => process.exit(1));
          return;
        }

        console.log("Smoke test passed: /health returned ok");
        server.close(() => process.exit(0));
      });
    }
  );

  request.on("timeout", () => {
    console.error("Smoke test timed out");
    request.destroy();
    server.close(() => process.exit(1));
  });

  request.on("error", (error) => {
    console.error(`Smoke test failed: ${error.message}`);
    server.close(() => process.exit(1));
  });
});
