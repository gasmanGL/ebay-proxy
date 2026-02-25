const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;
const PROXY_KEY = process.env.PROXY_KEY;

app.get("/", (req, res) => res.send("eBay proxy OK"));

app.post("/ebay", (req, res) => {
  const key = req.headers["x-proxy-key"];
  if (!key || key !== PROXY_KEY) {
    return res.status(403).send("Forbidden");
  }

  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);

    const toForward = [
      "x-ebay-api-compatibility-level",
      "x-ebay-api-call-name",
      "x-ebay-api-siteid",
      "x-ebay-api-app-name",
      "x-ebay-api-dev-name",
      "x-ebay-api-cert-name",
      "content-type",
    ];

    const fwdHeaders = {};
    for (const h of toForward) {
      if (req.headers[h]) fwdHeaders[h] = req.headers[h];
    }
    if (!fwdHeaders["content-type"]) fwdHeaders["content-type"] = "text/xml; charset=utf-8";
    if (!fwdHeaders["x-ebay-api-siteid"]) fwdHeaders["x-ebay-api-siteid"] = "3";
    if (!fwdHeaders["x-ebay-api-compatibility-level"]) fwdHeaders["x-ebay-api-compatibility-level"] = "967";
    fwdHeaders["content-length"] = body.length;

    const options = {
      hostname: "api.ebay.com",
      path: "/ws/api.dll",
      method: "POST",
      headers: fwdHeaders,
    };

    const ebayReq = https.request(options, (ebayRes) => {
      let data = "";
      ebayRes.on("data", chunk => data += chunk);
      ebayRes.on("end", () => {
        res.status(ebayRes.statusCode)
          .set("Content-Type", ebayRes.headers["content-type"] || "text/xml")
          .send(data);
      });
    });

    ebayReq.on("error", (err) => {
      res.status(502).send("Upstream error: " + err.message);
    });

    ebayReq.write(body);
    ebayReq.end();
  });
});

app.listen(PORT, () => console.log("eBay proxy listening on port " + PORT));
