const http = require("http");
const { app, extractQuantity } = require("../index");

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
