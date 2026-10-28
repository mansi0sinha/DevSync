const express = require("express");
const { acceptDelivery, verifySignature } = require("../services/githubWebhookProcessor");

const router = express.Router();

router.post("/", express.raw({ type: "application/json", limit: "256kb", inflate: false }), async (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: "GitHub webhook is not configured." });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, message: "Expected an application/json webhook body." });
  if (!verifySignature(req.body, req.get("x-hub-signature-256"), secret)) return res.status(401).json({ success: false, message: "Invalid GitHub webhook signature." });

  try {
    const result = await acceptDelivery({
      deliveryId: req.get("x-github-delivery"),
      eventName: req.get("x-github-event"),
      rawBody: req.body,
      io: req.app.get("io"),
    });
    return res.status(result.status).json({ success: result.status < 400, message: result.message });
  } catch {
    return res.status(503).json({ success: false, message: "Webhook processing is temporarily unavailable." });
  }
});

module.exports = router;
