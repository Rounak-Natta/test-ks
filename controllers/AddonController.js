import Addon from "../models/AddOnModel.js";

// Add
export const createAddon = async (req, res) => {
  try {
    const addon = await Addon.create(req.body);
    res.status(201).json({ success: true, addon });
  } catch (err) {
    res.status(500).json({ success: false, message: "Addon creation failed" });
  }
};

// Get all
export const getAllAddons = async (req, res) => {
  try {
    const addons = await Addon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, addons });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// Update Addon
export const updateAddon = async (req, res) => {
  try {
    const addon = await Addon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!addon) return res.status(404).json({ success: false, message: "Addon not found" });
    res.status(200).json({ success: true, addon });
  } catch (err) {
    res.status(500).json({ success: false, message: "Addon update failed" });
  }
};

// Delete
export const deleteAddon = async (req, res) => {
  try {
    await Addon.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Addon deleted" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
