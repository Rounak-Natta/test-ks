import MenuModel from "../models/MenuModel.js";
import fs from "fs";
import VariationModel from "../models/VariationModel.js";

// -------------------- Add Menu Item --------------------
export const addMenuModel = async (req, res) => {
  try {
    const data = req.body;
    const menuImg = req.file ? req.file.path : null;

    // Parse variations safely
    const variations = data.variations
      ? JSON.parse(data.variations)
          .filter(v => v.variationId && !isNaN(Number(v.price)) && Number(v.price) >= 0)
          .map(v => ({ variationId: v.variationId, price: Number(v.price) }))
      : [];

    const addOns = data.addOns
      ? JSON.parse(data.addOns).filter(id => id)
      : [];

    const tags = data.tags ? JSON.parse(data.tags) : [];

    const newItem = new MenuModel({
      name: data.name,
      categoryId: data.categoryId,
      price: Number(data.price),
      dietary: data.dietary,
      menuImg,
      variations,
      addOns,
      tags,
      extraCharge: data.extraCharge ? Number(data.extraCharge) : 0,
      description: data.description || "",
      status: data.status || "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newItem.save();

    return res.status(201).json({
      success: true,
      message: "Menu item added successfully",
      item: newItem,
    });
  } catch (error) {
    console.error("Add Menu Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding menu item",
      error: error.message,
    });
  }
};

// -------------------- Update Menu Item --------------------
export const updateMenuModel = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const item = await MenuModel.findById(id);
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    // Parse variations if sent
    const variations = data.variations
      ? JSON.parse(data.variations)
          .filter(v => v.variationId && !isNaN(Number(v.price)) && Number(v.price) >= 0)
          .map(v => ({ variationId: v.variationId, price: Number(v.price) }))
      : item.variations;

    // Parse add-ons
    let addOns = item.addOns;
    if (data.addOns) {
      try {
        const parsedAddOns = JSON.parse(data.addOns);
        if (Array.isArray(parsedAddOns)) {
          addOns = parsedAddOns.map(a => (typeof a === "string" ? a : a?._id)).filter(Boolean);
        }
      } catch (err) {
        console.error("Add-ons parsing error:", err);
      }
    }

    const tags = data.tags ? JSON.parse(data.tags) : item.tags;

    // Replace image if new file uploaded
    if (req.file && item.menuImg) {
      fs.unlink(item.menuImg, err => {
        if (err) console.error("Error deleting old image:", err);
      });
    }

    item.name = data.name || item.name;
    item.categoryId = data.categoryId || item.categoryId;
    item.price = data.price !== undefined ? Number(data.price) : item.price;
    item.dietary = data.dietary || item.dietary;
    item.menuImg = req.file ? req.file.path : item.menuImg;
    item.variations = variations;
    item.addOns = addOns;
    item.tags = tags;
    item.extraCharge = data.extraCharge !== undefined ? Number(data.extraCharge) : item.extraCharge;
    item.description = data.description || item.description;
    item.status = data.status || item.status;
    item.updatedAt = new Date();

    await item.save();

    return res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      item,
    });
  } catch (error) {
    console.error("Update Menu Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating menu item",
      error: error.message,
    });
  }
};

// -------------------- Get All Menu Items --------------------
export const getAllMenuModels = async (req, res) => {
  try {
    const items = await MenuModel.find().sort({ createdAt: -1 }).lean();

    const variationIds = items.flatMap(item => item.variations.map(v => v.variationId));
    const variations = await VariationModel.find({ _id: { $in: variationIds } }).lean();

    const itemsWithVariationNames = items.map(item => ({
      ...item,
      variations: item.variations.map(v => {
        const variation = variations.find(va => va._id.toString() === v.variationId.toString());
        return { ...v, name: variation?.name || `Option - ₹${v.price}` };
      }),
    }));

    return res.status(200).json({ success: true, items: itemsWithVariationNames });
  } catch (error) {
    console.error("Get All Menu Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching menu items",
      error: error.message,
    });
  }
};

// -------------------- Get Menu By ID --------------------
export const getMenuModelById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuModel.findById(id).lean();

    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    const variationIds = item.variations.map(v => v.variationId);
    const allVariations = await VariationModel.find({ _id: { $in: variationIds } }).lean();

    item.variations = item.variations.map(v => {
      const varObj = allVariations.find(va => va._id.toString() === v.variationId.toString());
      return { ...v, name: varObj?.name || `Option - ₹${v.price}` };
    });

    return res.status(200).json({ success: true, menu: item });
  } catch (error) {
    console.error("Get Menu By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching menu item",
      error: error.message,
    });
  }
};

// -------------------- Delete Menu Item --------------------
export const deleteMenuModel = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MenuModel.findById(id);
    if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });

    if (item.menuImg) {
      fs.unlink(item.menuImg, err => {
        if (err) console.error("Error deleting image:", err);
      });
    }

    await item.deleteOne();

    return res.status(200).json({ success: true, message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Delete Menu Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting menu item",
      error: error.message,
    });
  }
};
