const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
const PROXY_KEY = process.env.PROXY_KEY;

// Raw body buffer — do NOT parse XML
app.use(express.raw({ type: "*/*", limit: "2mb" }));

app.post("/ebay", async (req, res) => {
  // Auth
  const key = req.headers["x-proxy-key"];
  if (!key || key !== PROXY_KEY) {
    return res.status(403).send("Forbidden");
  }

  // Forward these headers to eBay
  const fwdHeaders = {};
  const toForward = [
    "x-ebay-api-compatibility-level",
    "x-ebay-api-call-name",
    "x-ebay-api-siteid",
    "x-ebay-api-app-name",
    "x-ebay-api-dev-name",
    "x-ebay-api-cert-name",
    "content-type",
  ];
  for (const h of toForward) {
    if (req.headers[h]) fwdHeaders[h] = req.headers[h];
  }
  if (!fwdHeaders["content-type"]) fwdHeaders["content-type"] = "text/xml; charset=utf-8";
  if (!fwdHeaders["x-ebay-api-siteid"]) fwdHeaders["x-ebay-api-siteid"] = "3";
  if (!fwdHeaders["x-ebay-api-compatibility-level"]) fwdHeaders["x-ebay-api-compatibility-level"] = "967";

  const delays = [0, 500, 1500, 3000];
  let lastStatus = 0;
  let lastBody = "";

  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));

    let ebayRes;
    try {
      ebayRes = await fetch("https://api.ebay.com/ws/api.dll", {
        method: "POST",
        headers: fwdHeaders,
        body: req.body, // raw Buffer
      });
    } catch (err) {
      lastStatus = 502;
      lastBody = `Fetch error: ${err.message}`;
      continue;
    }

    lastStatus = ebayRes.status;
    lastBody = await ebayRes.text();

    // Got a real eBay XML response
    if (lastStatus === 200 && lastBody.includes("<Ack>")) {
      return res
        .status(200)
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(lastBody);
    }

    // Non-retryable error
    if (![502, 503, 504].includes(lastStatus)) {
      return res
        .status(lastStatus)
        .set("Content-Type", ebayRes.headers.get("content-type") || "text/plain")
        .send(lastBody);
    }

    console.log(`Attempt ${i + 1} got ${lastStatus}, retrying...`);
  }

  // All retries exhausted
  return res.status(lastStatus || 503).send(lastBody || "Upstream error");
});

app.get("/", (req, res) => res.send("eBay proxy OK"));

app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));
