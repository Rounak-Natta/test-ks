import User from "../models/UserModel.js";
import fs from "fs";
import path from "path";

// @desc    Get logged-in user's restaurant info
// @route   GET /api/restaurant/me
// @access  Private (All roles)
export const getMyRestaurant = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Convert preferences Map to object
    const preferences = Object.fromEntries(user.preferences || []);

    const restaurantData = {
      logo: user.avatar || null,
      name: `${user.firstName} ${user.lastName}`,
      contactEmail: user.email || "",
      phone: user.phone || "",
      address: user.address || {},
      supportPlan: preferences.supportPlan || "basic",
      offlineSyncStatus: user.offlineSyncStatus || "online",
      lastSyncTime: user.lastSyncTime || null,
      notes: preferences.notes || "",
      subscription: {
        tier: preferences.supportTier || "starter",
        licenseKey: preferences.licenseKey || "N/A",
        startDate: preferences.startDate || null,
        endDate: preferences.endDate || null,
        paymentStatus: preferences.paymentStatus || "unpaid",
      },
    };

    res.status(200).json(restaurantData);
  } catch (err) {
    console.error("getMyRestaurant error:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update restaurant info (admin only)
// @route   PUT /api/restaurant/me
// @access  Private (Admin only)
export const updateMyRestaurant = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update restaurant profile",
      });
    }

    const updatableFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "supportPlan",
      "offlineSyncStatus",
      "lastSyncTime",
      "deviceId",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    // Update preferences
    const preferenceFields = [
      "supportTier",
      "licenseKey",
      "startDate",
      "endDate",
      "paymentStatus",
      "notes",
    ];

    preferenceFields.forEach((key) => {
      if (req.body[key] !== undefined) {
        user.preferences.set(key, req.body[key]);
      }
    });

    // Handle logo/avatar
    if (req.file) {
      const oldPath = path.join("uploads", user.avatar || "");
      if (user.avatar && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      user.avatar = req.file.filename;
    }

    await user.save();
    res.status(200).json({ success: true, message: "Restaurant updated successfully." });
  } catch (error) {
    console.error("updateMyRestaurant error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
