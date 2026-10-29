import assert from "node:assert/strict";
import test from "node:test";
import { uploadAttachmentsAndSend } from "./discussionMessageUpload.js";

const file = { name: "spec.pdf" };

test("a confirmed upload sends its returned attachment ID with the discussion message", async () => {
  const calls = [];
  const result = await uploadAttachmentsAndSend({
    files: [file], workspaceId: "workspace", projectId: "project", text: "Design spec",
    uploadFiles: async (...args) => { calls.push(["upload", args]); return { success: true, data: [{ uploadId: "upload-1" }] }; },
    addMessage: async (payload) => { calls.push(["message", payload]); return { success: true }; },
    onProgress: () => {},
  });
  assert.deepEqual(calls[1][1], { text: "Design spec", attachments: [{ uploadId: "upload-1" }] });
  assert.deepEqual(result, { success: true });
});

test("a failed upload never creates a discussion message", async () => {
  let messageCreated = false;
  await assert.rejects(uploadAttachmentsAndSend({
    files: [file], workspaceId: "workspace", projectId: "project", text: "retry this",
    uploadFiles: async () => { throw new Error("The document is corrupted."); },
    addMessage: async () => { messageCreated = true; },
  }), /corrupted/);
  assert.equal(messageCreated, false);
});

test("an unconfirmed upload response is rejected before creating a message", async () => {
  let messageCreated = false;
  await assert.rejects(uploadAttachmentsAndSend({
    files: [file], workspaceId: "workspace", projectId: "project", text: "no attachment",
    uploadFiles: async () => ({ success: true, data: [] }),
    addMessage: async () => { messageCreated = true; },
  }), /could not confirm/);
  assert.equal(messageCreated, false);
});
