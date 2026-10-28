const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const zlib = require("node:zlib");
const express = require("express");

test("malformed gzip JSON with trailing bytes returns an error without crashing the server", async (t) => {
  const app = express();
  app.use(express.json());
  app.post("/json", (req, res) => res.json(req.body));
  app.get("/health", (_req, res) => res.status(200).send("ok"));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const address = server.address();
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: address.port, path, ...options }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });

  const malformedBody = Buffer.concat([zlib.gzipSync(Buffer.from('{"ok":true}')), Buffer.from("trailing-bytes")]);
  const malformedStatus = await request("/json", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-encoding": "gzip",
      "content-length": malformedBody.length,
    },
    body: malformedBody,
  });

  assert.ok(malformedStatus >= 400, `expected malformed request to fail, received ${malformedStatus}`);
  assert.equal(await request("/health"), 200, "server should continue serving requests after malformed input");
});
