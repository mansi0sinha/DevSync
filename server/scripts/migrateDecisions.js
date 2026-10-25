
require("dotenv").config();

const mongoose = require("mongoose");
const Discussion = require("../src/models/Discussion");
const Decision = require("../src/models/Decision");

async function migrateDecisions() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const discussions = await Discussion.find({
      decision: { $exists: true, $ne: null },
    });

    console.log(`Found ${discussions.length} discussions with decisions.`);

    let migrated = 0;
    let skipped = 0;

    for (const discussion of discussions) {
      const existingDecision = await Decision.findOne({
        discussionId: discussion._id,
      });

      if (existingDecision) {
        skipped++;
        continue;
      }

      if (
        !discussion.decision?.title?.trim() ||
        !discussion.decision?.summary?.trim()
      ) {
        console.warn(`Skipping invalid decision in discussion ${discussion._id}`);
        skipped++;
        continue;
      }

      await Decision.create({
        title: discussion.decision.title,
        summary: discussion.decision.summary,
        context: discussion.decision.context || "",
        project: discussion.project || "Platform",
        taskId: discussion.taskId || "",
        discussionId: discussion._id,
        lifecycleStatus: "Accepted",
        createdBy: "Unknown",
        deletedAt: null,
      });

      migrated++;
    }

    console.log("Migration finished.");
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log("Original discussions and embedded decisions were preserved.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateDecisions();
