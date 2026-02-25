export default {
async fetch(request, env) {

```
if (request.method !== "POST") {
  return new Response("POST only", { status: 405 });
}

// Check proxy key
const proxyKey = request.headers.get("x-proxy-key");
if (proxyKey !== env.PROXY_KEY) {
  return new Response("Forbidden", { status: 403 });
}

// Forward headers
const fwdHeaders = {
  "Content-Type": "text/xml",
  "X-EBAY-API-CALL-NAME": request.headers.get("X-EBAY-API-CALL-NAME"),
  "X-EBAY-API-SITEID": request.headers.get("X-EBAY-API-SITEID"),
  "X-EBAY-API-COMPATIBILITY-LEVEL": request.headers.get("X-EBAY-API-COMPATIBILITY-LEVEL"),
  "X-EBAY-API-DEV-NAME": request.headers.get("X-EBAY-API-DEV-NAME"),
  "X-EBAY-API-APP-NAME": request.headers.get("X-EBAY-API-APP-NAME"),
  "X-EBAY-API-CERT-NAME": request.headers.get("X-EBAY-API-CERT-NAME"),
};

// IMPORTANT: pass body as binary
const body = await request.arrayBuffer();

const resp = await fetch(
  "https://api.ebay.com/ws/api.dll",
  {
    method: "POST",
    headers: fwdHeaders,
    body: body,
  }
);

return resp;
```

}
};
