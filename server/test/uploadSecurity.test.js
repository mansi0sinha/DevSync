const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const Workspace = require("../src/models/Workspace");
const Project = require("../src/models/Project");
const UploadQuota = require("../src/models/UploadQuota");
const Upload = require("../src/models/Upload");
const { MAX_REQUEST_BYTES, WORKSPACE_USER_QUOTA_BYTES, hasQuotaCapacity, parseUploadContentLength, getSupportedUploadFormats } = require("../src/utils/uploadPolicy");

test("upload policy enforces request and workspace quota boundaries", () => {
  assert.deepEqual(getSupportedUploadFormats(), [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"]);
  assert.deepEqual(parseUploadContentLength(String(MAX_REQUEST_BYTES)), { bytes: MAX_REQUEST_BYTES });
  assert.equal(parseUploadContentLength(String(MAX_REQUEST_BYTES + 1)).status, 413);
  assert.equal(parseUploadContentLength(undefined).status, 400);
  assert.equal(hasQuotaCapacity(WORKSPACE_USER_QUOTA_BYTES - 100, 0, 100), true);
  assert.equal(hasQuotaCapacity(WORKSPACE_USER_QUOTA_BYTES - 100, 1, 100), false);
});

test("uploads authenticate and authorize scope before Multer parses or writes files", async (t) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "devsync-upload-test-"));
  process.env.DEVSYNC_UPLOAD_DIRECTORY = tempDirectory;
  process.env.JWT_SECRET = "devsync-upload-test-secret";

  const originalUserFindById = User.findById;
  const originalWorkspaceFindOne = Workspace.findOne;
  const originalProjectFindOne = Project.findOne;
  const originalQuotaFindOneAndUpdate = UploadQuota.findOneAndUpdate;
  const originalUploadCreate = Upload.create;
  const userId = new (require("mongoose").Types.ObjectId)();
  const workspaceId = new (require("mongoose").Types.ObjectId)();
  const projectId = new (require("mongoose").Types.ObjectId)();
  let workspaceAuthorized = false;
  User.findById = () => ({ select: async () => ({ _id: userId, name: "Test", email: "test@example.test" }) });
  Workspace.findOne = () => ({ select: async () => workspaceAuthorized ? { _id: workspaceId } : null });
  Project.findOne = () => ({ select: async () => ({ _id: projectId }) });
  UploadQuota.findOneAndUpdate = async () => ({ reservedBytes: 1 });
  let savedUploads = 0;
  Upload.create = async (record) => { savedUploads += 1; return { ...record, _id: new (require("mongoose").Types.ObjectId)() }; };

  const app = express();
  app.use("/api/uploads", require("../src/routes/uploadRoutes"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    User.findById = originalUserFindById;
    Workspace.findOne = originalWorkspaceFindOne;
    Project.findOne = originalProjectFindOne;
    UploadQuota.findOneAndUpdate = originalQuotaFindOneAndUpdate;
    Upload.create = originalUploadCreate;
    delete process.env.DEVSYNC_UPLOAD_DIRECTORY;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const boundary = `devsync-${crypto.randomUUID()}`;
  const malformedMultipart = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="partial.txt"\r\nContent-Type: text/plain\r\n\r\npartial file bytes`);
  const send = (authorized, body = malformedMultipart, contentType = `multipart/form-data; boundary=${boundary}`) => new Promise((resolve, reject) => {
    const headers = {
      "content-type": contentType,
      "content-length": body.length,
    };
    if (authorized) headers.authorization = `Bearer ${jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET)}`;
    const req = http.request({
      host: "127.0.0.1", port: server.address().port,
      path: `/api/uploads?workspaceId=${workspaceId}&projectId=${projectId}`,
      method: "POST", headers,
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end(body);
  });
  const sendDetailed = (body) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path: `/api/uploads?workspaceId=${workspaceId}&projectId=${projectId}`, method: "POST", headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": body.length,
      authorization: `Bearer ${jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET)}`,
    } }, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(responseBody) }));
    });
    req.on("error", reject);
    req.end(body);
  });

  assert.equal(await send(false), 401);
  assert.equal(await send(true), 404);
  workspaceAuthorized = true;
  assert.equal(await send(true), 400, "malformed multipart should fail with a client error");
  assert.equal(await send(true, Buffer.from("{}"), "application/json"), 400, "non-multipart upload requests should be rejected");
  const unsupported = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="payload.bin"\r\nContent-Type: application/x-executable\r\n\r\nnot allowed\r\n--${boundary}--\r\n`);
  assert.equal(await send(true, unsupported), 400, "unsupported MIME types should be rejected");
  assert.deepEqual(fs.readdirSync(tempDirectory), [], "unauthorized uploads must not create files");

  const multipartPdf = (contents) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="spec.pdf"\r\nContent-Type: application/pdf\r\n\r\n${contents}\r\n--${boundary}--\r\n`);
  const corrupted = await sendDetailed(multipartPdf("not a PDF document"));
  assert.equal(corrupted.status, 400);
  assert.match(corrupted.body.message, /contents do not match/i);
  assert.equal(savedUploads, 0);
  assert.deepEqual(fs.readdirSync(tempDirectory), [], "invalid document contents must be removed");

  const success = await sendDetailed(multipartPdf("%PDF-1.7\nvalid signature"));
  assert.equal(success.status, 201);
  assert.equal(success.body.success, true);
  assert.equal(success.body.data.length, 1);
  assert.equal(savedUploads, 1);
});
