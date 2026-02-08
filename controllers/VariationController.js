import Variation from "../models/VariationModel.js";

// Add
export const createVariation = async (req, res) => {
  try {
    const variation = await Variation.create(req.body);
    res.status(201).json({ success: true, variation });
  } catch (err) {
    res.status(500).json({ success: false, message: "Variation creation failed" });
  }
};

// Get all
export const getAllVariations = async (req, res) => {
  try {
    const variations = await Variation.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, variations });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

//update
export const updateVariation = async (req, res) => {
  try {
    const variation = await Variation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!variation) return res.status(404).json({ success: false, message: "Variation not found" });
    res.status(200).json({ success: true, variation });
  } catch (err) {
    res.status(500).json({ success: false, message: "Variation update failed" });
  }
};

// Delete
export const deleteVariation = async (req, res) => {
  try {
    await Variation.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Variation deleted" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
