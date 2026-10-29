import assert from "node:assert/strict";
import test from "node:test";
import { uploadAPI } from "./api.js";

const originals = {
  xhr: globalThis.XMLHttpRequest,
  formData: globalThis.FormData,
  storage: globalThis.localStorage,
  window: globalThis.window,
};

class MockFormData {
  entries = [];
  append(...args) { this.entries.push(args); }
}

class MockXHR {
  static next = { status: 200, body: "{}" };
  constructor() { this.upload = {}; this.headers = {}; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(body) {
    this.body = body;
    const next = MockXHR.next;
    if (next.network) { this.onerror(); return; }
    if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: 1, total: 1 });
    this.status = next.status;
    this.responseText = next.body;
    this.onload();
  }
}

globalThis.XMLHttpRequest = MockXHR;
globalThis.FormData = MockFormData;
globalThis.localStorage = { getItem: () => "test-token", removeItem: () => {} };
const sessionEvents = [];
globalThis.window = { dispatchEvent: (event) => sessionEvents.push(event.type) };

function setResponse(status, payload, malformed = false) {
  MockXHR.next = { status, body: malformed ? "not-json" : JSON.stringify(payload) };
}

const file = { name: "brief.pdf", size: 128 };

test("successful upload resolves only with confirmed attachment records", async () => {
  setResponse(201, { success: true, data: [{ uploadId: "upload-1" }] });
  const progress = [];
  const result = await uploadAPI.uploadFiles([file], "workspace", "project", (value) => progress.push(value));
  assert.equal(result.data[0].uploadId, "upload-1");
  assert.equal(progress.at(-1), 100);
});

test("unsupported formats and corrupted documents show backend validation messages", async () => {
  for (const message of ["Only JPG, PNG, WebP, PDF, and TXT files are allowed.", "File contents do not match the declared file type."]) {
    setResponse(400, { success: false, message });
    await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), (error) => error.message === message);
  }
});

test("oversized and malformed uploads show actionable errors", async () => {
  setResponse(413, { success: false, message: "Each file must be 5 MB or smaller." });
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), /5 MB/);
  setResponse(400, { success: false, message: "The multipart upload is incomplete or malformed." });
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), /multipart upload is incomplete/);
});

test("authentication, network, and server failures produce readable messages", async () => {
  setResponse(401, { success: false, message: "Access denied. Please log in." });
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), /Access denied/);
  assert.ok(sessionEvents.includes("devsync:session-expired"));
  MockXHR.next = { network: true };
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), /couldn't connect to DevSync/i);
  setResponse(500, { success: false, message: "Internal stack trace" });
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), (error) => {
    assert.equal(error.message, "DevSync is having trouble right now. Please try again shortly.");
    return true;
  });
});

test("malformed success responses are rejected rather than creating an attachment", async () => {
  setResponse(201, { success: true, data: [] });
  await assert.rejects(uploadAPI.uploadFiles([file], "workspace", "project"), /unexpected response/i);
});

test.after(() => {
  globalThis.XMLHttpRequest = originals.xhr;
  globalThis.FormData = originals.formData;
  if (originals.storage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originals.storage;
  if (originals.window === undefined) delete globalThis.window; else globalThis.window = originals.window;
});
