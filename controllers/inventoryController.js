import Inventory from "../models/InventoryModel.js";

// Generate batch number
const generateBatchNumber = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const time = now.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  }).replace(/:/g, '-');
  return `BATCH-${date}-${time}`;
};

/**
 * Get all active inventory items with pagination
 */
export const getInventoryList = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    
    const query = { 
      isActive: true,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { supplierName: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } }
        ]
      })
    };

    const items = await Inventory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Inventory.countDocuments(query);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        results: items.length,
        totalItems: total
      }
    });
  } catch (error) {
    console.error("getInventoryList error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching inventory" 
    });
  }
};

/**
 * Get a single inventory item by ID
 */
export const getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item || !item.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory item not found" 
      });
    }
    
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error("getInventoryById error:", error.message);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid inventory ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching inventory item" 
    });
  }
};

/**
 * Create a new inventory item with optional initial batch
 */
export const createInventory = async (req, res) => {
  try {
    const {
      name,
      type = "general",
      unit = "pcs",
      storageLocation = "default",
      supplierName = "Atanu Deb",
      reorderLevel = 0,
      recipeId = null,
      initialBatch = null,
    } = req.body;

    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Item name is required" 
      });
    }

    if (reorderLevel < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Reorder level cannot be negative" 
      });
    }

    // Prepare batches array
    const batches = [];
    if (initialBatch && initialBatch.quantity && initialBatch.costPrice) {
      batches.push({
        batchNumber: generateBatchNumber(),
        quantity: parseFloat(initialBatch.quantity),
        costPrice: parseFloat(initialBatch.costPrice),
        purchaseDate: initialBatch.purchaseDate || null,
        expiryDate: initialBatch.expiryDate || null,
        syncStatus: "pending",
        lastModified: new Date(),
      });
    }

    const newItem = new Inventory({
      name: name.trim(),
      type,
      unit,
      storageLocation,
      supplierName: supplierName.trim(),
      reorderLevel: parseInt(reorderLevel),
      recipeId,
      batches,
      lastUpdatedBy: req.user._id,
    });

    await newItem.save();
    
    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: newItem
    });
  } catch (error) {
    console.error("createInventory error:", error.message);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Item with this name already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error while creating inventory item" 
    });
  }
};

export const addNewBatchToInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, costPrice, purchaseDate, expiryDate } = req.body;

    if (!quantity || !costPrice) {
      return res.status(400).json({
        success: false,
        message: "Quantity and cost price are required",
      });
    }

    const item = await Inventory.findById(id);
    if (!item || !item.isActive) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const batch = {
      batchNumber: generateBatchNumber(),
      quantity: parseFloat(quantity),
      costPrice: parseFloat(costPrice),
      purchaseDate: purchaseDate || null,
      expiryDate: expiryDate || null,
      syncStatus: "pending",
      lastModified: new Date(),
    };

    item.batches.push(batch);
    item.lastUpdatedBy = req.user._id;

    await item.save();

    res.status(200).json({
      success: true,
      message: "New batch added successfully",
      data: item,
    });
  } catch (error) {
    console.error("addNewBatchToInventory error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while adding batch",
    });
  }
};


/**
 * Update an inventory item
 */
export const updateInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item || !item.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory item not found" 
      });
    }

    const {
      name,
      type,
      unit,
      storageLocation,
      supplierName,
      reorderLevel,
      recipeId,
      initialBatch,
    } = req.body;

    // Update basic fields
    if (name !== undefined) item.name = name.trim();
    if (type !== undefined) item.type = type;
    if (unit !== undefined) item.unit = unit;
    if (storageLocation !== undefined) item.storageLocation = storageLocation;
    if (supplierName !== undefined) item.supplierName = supplierName.trim();
    if (reorderLevel !== undefined) item.reorderLevel = parseInt(reorderLevel);
    if (recipeId !== undefined) item.recipeId = recipeId;

    // Handle batch updates for editing
    if (initialBatch) {
      if (item.batches.length > 0) {
        // Update first batch
        item.batches[0] = {
          ...item.batches[0].toObject(),
          quantity: initialBatch.quantity ? parseFloat(initialBatch.quantity) : item.batches[0].quantity,
          costPrice: initialBatch.costPrice ? parseFloat(initialBatch.costPrice) : item.batches[0].costPrice,
          purchaseDate: initialBatch.purchaseDate || item.batches[0].purchaseDate,
          expiryDate: initialBatch.expiryDate || item.batches[0].expiryDate,
          lastModified: new Date(),
        };
      } else if (initialBatch.quantity && initialBatch.costPrice) {
        // Add new batch if none exists
        item.batches.push({
          batchNumber: generateBatchNumber(),
          quantity: parseFloat(initialBatch.quantity),
          costPrice: parseFloat(initialBatch.costPrice),
          purchaseDate: initialBatch.purchaseDate || null,
          expiryDate: initialBatch.expiryDate || null,
          syncStatus: "pending",
          lastModified: new Date(),
        });
      }
    }

    item.lastUpdatedBy = req.user._id;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Inventory item updated successfully",
      data: item
    });
  } catch (error) {
    console.error("updateInventory error:", error.message);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid inventory ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating inventory item" 
    });
  }
};

/**
 * Soft delete an inventory item
 */
export const deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    
    if (!item || !item.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory item not found" 
      });
    }

    item.isActive = false;
    item.lastUpdatedBy = req.user._id;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Inventory item deleted successfully"
    });
  } catch (error) {
    console.error("deleteInventory error:", error.message);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid inventory ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting inventory item" 
    });
  }
};

/**
 * Log wastage for a specific inventory item
 */
export const addWastage = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity, reason = "" } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Wastage quantity must be greater than zero" 
      });
    }

    const item = await Inventory.findById(itemId);
    if (!item || !item.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: "Inventory item not found" 
      });
    }

    item.wastage.push({
      quantity: parseFloat(quantity),
      reason: reason.trim(),
      user: req.user._id,
      date: new Date(),
    });

    item.lastUpdatedBy = req.user._id;
    await item.save();

    res.status(200).json({
      success: true,
      message: "Wastage logged successfully",
      data: item
    });
  } catch (error) {
    console.error("addWastage error:", error.message);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid inventory ID" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Server error while logging wastage" 
    });
  }
};