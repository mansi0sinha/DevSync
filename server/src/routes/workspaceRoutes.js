
const express = require("express");
const Workspace = require("../models/Workspace");
const WorkspaceInvitation = require("../models/WorkspaceInvitation");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const crypto = require("crypto");

const router = express.Router();

const normalizeEmail = (email) => email.trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

router.post("/invitations/accept", authMiddleware, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || typeof req.body.token !== "string") {
      return res.status(400).json({ success: false, message: "A valid invitation token is required." });
    }
    const token = req.body.token.trim();
    if (token.length < 32 || token.length > 200) {
      return res.status(400).json({ success: false, message: "Invitation token is invalid or expired." });
    }

    const now = new Date();
    const invitation = await WorkspaceInvitation.findOne({
      tokenHash: hashInvitationToken(token),
      email: normalizeEmail(req.user.email),
      acceptedAt: null,
      expiresAt: { $gt: now },
    }).select("workspace email");

    if (!invitation) {
      return res.status(404).json({ success: false, message: "Invitation is invalid, expired, already used, or addressed to another account." });
    }

    const workspace = await Workspace.findOneAndUpdate(
      {
        _id: invitation.workspace,
        members: { $not: { $elemMatch: { user: req.user._id } } },
      },
      { $push: { members: { user: req.user._id, role: "Member" } } },
      { new: true, runValidators: true }
    );

    if (!workspace) {
      const alreadyMember = await Workspace.exists({ _id: invitation.workspace, "members.user": req.user._id });
      return res.status(alreadyMember ? 409 : 404).json({
        success: false,
        message: alreadyMember ? "You are already a workspace member." : "Workspace no longer exists.",
      });
    }

    await WorkspaceInvitation.updateOne(
      { _id: invitation._id, acceptedAt: null, expiresAt: { $gt: now } },
      { $set: { acceptedAt: now, acceptedBy: req.user._id } }
    );

    return res.status(200).json({ success: true, message: "Workspace joined successfully.", workspace });
  } catch (error) {
    console.error("Workspace invitation acceptance failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not accept the invitation." });
  }
});

router.post("/:workspaceId/invitations", authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!mongoose.isObjectIdOrHexString(workspaceId)) {
      return res.status(400).json({ success: false, message: "Invalid workspace ID." });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || typeof req.body.email !== "string") {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }
    const email = normalizeEmail(req.body.email);
    if (email.length > 254 || !validEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required." });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    const membership = workspace.members.find((member) => String(member.user) === String(req.user._id));
    if (!membership) return res.status(403).json({ success: false, message: "You are not a member of this workspace." });
    if (membership.role !== "Admin") return res.status(403).json({ success: false, message: "Only workspace Admins can invite members." });

    const existingUser = await User.findOne({ email }).select("_id");
    if (existingUser && workspace.members.some((member) => String(member.user) === String(existingUser._id))) {
      return res.status(409).json({ success: false, message: "This user is already a workspace member." });
    }
    const now = new Date();
    const pendingInvitation = await WorkspaceInvitation.exists({ workspace: workspace._id, email, acceptedAt: null, expiresAt: { $gt: now } });
    if (pendingInvitation) return res.status(409).json({ success: false, message: "A valid invitation is already pending for this email." });

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await WorkspaceInvitation.create({
      workspace: workspace._id,
      email,
      tokenHash: hashInvitationToken(token),
      invitedBy: req.user._id,
      expiresAt,
    });

    return res.status(201).json({ success: true, message: "Invitation created. Share this token with the invited account.", token, expiresAt });
  } catch (error) {
    console.error("Workspace invitation creation failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not create the invitation." });
  }
});

// POST /api/workspaces — Create a workspace
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: "A valid request body is required." });
    }
    const { name, description } = req.body;

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: "Workspace name must be between 2 and 80 characters.",
      });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 500)) {
      return res.status(400).json({ success: false, message: "Workspace description must be 500 characters or fewer." });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description?.trim() || "",
      createdBy: req.user._id,
      members: [
        {
          user: req.user._id,
          role: "Admin",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully.",
      workspace,
    });
  } catch (error) {
    console.error("Workspace creation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while creating workspace.",
    });
  }
});

/* GET /api/workspaces — List workspaces for the logged-in user */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      "members.user": req.user._id,
    })
      .sort({ createdAt: -1 })
      .select("name description createdBy members createdAt updatedAt");

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    console.error("Workspace listing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching workspaces.",
    });
  }
});

/* GET /api/workspaces/:workspaceId — Get workspace details */
router.get("/:workspaceId", authMiddleware, async (req, res) => {
  try {
    if (!req.params.workspaceId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate("createdBy", "name email")
      .populate("members.user", "name email avatar");

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    const isMember = workspace.members.some(
      (member) => member.user._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    return res.status(200).json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error("Workspace details error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching workspace details.",
    });
  }
});

/* POST /api/workspaces/:workspaceId/members
   Admin adds an existing user by email. */
router.post("/:workspaceId/members", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.workspaceId)) {
      return res.status(400).json({ success: false, message: "Invalid workspace ID." });
    }
    const email = req.body && typeof req.body.email === "string" ? req.body.email : "";

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Member email is required.",
      });
    }

    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    const currentMembership = workspace.members.find(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (!currentMembership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    if (currentMembership.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only workspace Admins can add members.",
      });
    }

    const User = require("../models/User");
    const newUser = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!newUser) {
      return res.status(404).json({
        success: false,
        message: "User with this email was not found.",
      });
    }

    const alreadyMember = workspace.members.some(
      (member) => member.user.toString() === newUser._id.toString()
    );

    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: "This user is already a workspace member.",
      });
    }

    const normalizedAddress = normalizeEmail(newUser.email);
    const now = new Date();
    const pendingInvitation = await WorkspaceInvitation.exists({
      workspace: workspace._id,
      email: normalizedAddress,
      acceptedAt: null,
      expiresAt: { $gt: now },
    });
    if (pendingInvitation) {
      return res.status(409).json({ success: false, message: "A valid invitation is already pending for this email." });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await WorkspaceInvitation.create({
      workspace: workspace._id,
      email: normalizedAddress,
      tokenHash: hashInvitationToken(token),
      invitedBy: req.user._id,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Invitation created. The invited account must accept it to join.",
      token,
      expiresAt,
    });
  } catch (error) {
    console.error("Add workspace member error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while adding workspace member.",
    });
  }
});

/* PATCH /api/workspaces/:workspaceId/members/:userId/role
   Admin can change a workspace member's role. */
router.patch("/:workspaceId/members/:userId/role", authMiddleware, async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const role = req.body?.role;

    if (!mongoose.isObjectIdOrHexString(workspaceId) ||
        !mongoose.isObjectIdOrHexString(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID or user ID.",
      });
    }

    if (!["Admin", "Member"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be Admin or Member.",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    const currentMembership = workspace.members.find(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (!currentMembership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    if (currentMembership.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only workspace Admins can change member roles.",
      });
    }

    const targetMembership = workspace.members.find(
      (member) => member.user.toString() === userId
    );

    if (!targetMembership) {
      return res.status(404).json({
        success: false,
        message: "Target user is not a member of this workspace.",
      });
    }

    if (targetMembership.role === role) {
      return res.status(200).json({
        success: true,
        message: `User already has the ${role} role.`,
        workspace,
      });
    }

    // Never allow the workspace to have zero Admins.
    const adminCount = workspace.members.filter(
      (member) => member.role === "Admin"
    ).length;

    if (targetMembership.role === "Admin" && role === "Member" && adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "The workspace must have at least one Admin.",
      });
    }

    targetMembership.role = role;
    await workspace.save();

    return res.status(200).json({
      success: true,
      message: `Member role updated to ${role}.`,
      workspace,
    });
  } catch (error) {
    console.error("Update workspace role error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while updating member role.",
    });
  }
});

module.exports = router;
