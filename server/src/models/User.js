
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },

    username: {
      type: String,
      trim: true,
      maxlength: 25,
      default: "",
      validate: {
        validator: (value) => value === "" || /^[a-zA-Z0-9_-]{3,25}$/.test(value),
        message: "Username must be empty or 3–25 characters using letters, numbers, underscores, or hyphens.",
      },
    },
    bio: { type: String, trim: true, maxlength: 160, default: "" },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    avatar: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
