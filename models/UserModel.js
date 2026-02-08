import mongoose from "mongoose";
import bcrypt from "bcrypt";

// User Schema
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "cashier", "steward", "user"], // staff roles + general user
      default: "manager",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    dateOfJoining: {
      type: Date,
      default: Date.now,
    },
    avatar: {
      type: String, // URL for profile picture
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    permissions: {
      type: [String], // future-proof role-based permissions
      default: [],
    },
    preferences: {
      type: Map,
      of: String, // store user settings/preferences
      default: {},
    },

    // ✅ NEW FIELDS START HERE

    deviceId: {
      type: String,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIP: {
      type: String,
      trim: true,
    },
    sessionToken: {
      type: String,
    },
    loginHistory: [
      {
        ip: String,
        device: String,
        time: Date,
      },
    ],
    licenseAuditTrail: [
      {
        licenseKey: String,
        activatedAt: Date,
        expiresAt: Date,
        status: {
          type: String,
          enum: ["active", "expired", "revoked"],
          default: "active",
        },
      },
    ],
    offlineSyncStatus: {
      type: String,
      enum: ["online", "offline", "syncing"],
      default: "online",
    },
    lastSyncTime: {
      type: Date,
    },
    pendingSyncCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Password hashing before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
