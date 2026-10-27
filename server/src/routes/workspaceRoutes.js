
const express = require("express");
const Workspace = require("../models/Workspace");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/workspaces — Create a workspace
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Workspace name is required.",
      });
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
    const { email } = req.body;

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

    workspace.members.push({
      user: newUser._id,
      role: "Member",
    });

    await workspace.save();

    return res.status(200).json({
      success: true,
      message: "Member added successfully.",
      workspace,
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
    const { role } = req.body;

    if (!/^[0-9a-fA-F]{24}$/.test(workspaceId) ||
        !/^[0-9a-fA-F]{24}$/.test(userId)) {
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
