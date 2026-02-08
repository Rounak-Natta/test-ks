import Order from "../models/OrderModel.js";
import Inventory from "../models/InventoryModel.js";
import Recipe from "../models/RecipeModel.js";

// ---------------- Helper: Generate Order Number ----------------
const generateOrderNumber = async () => {
  const count = await Order.countDocuments({});
  const next = count + 1;
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `ORD-${year}${month}-${String(next).padStart(4, "0")}`;
};

// ---------------- Helper: Generate unique temp order number ----------------
const generateTempOrderNumber = () => {
  return `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ---------------- Helper: Calculate Order Totals ----------------
const calculateOrderTotals = (items = [], tax = 0, discount = 0, serviceCharge = 0) => {
  let subtotal = items.reduce((acc, item) => {
    const hasVariation = item.variation && typeof item.variation.extraPrice === "number";
    const base = hasVariation ? Number(item.variation.extraPrice) : Number(item.basePrice || 0);
    const addonsPrice = item.addons?.reduce((sum, a) => sum + Number(a.price || 0), 0) || 0;
    const quantity = Number(item.quantity || 1);

    const totalItem = (base + addonsPrice) * quantity;
    return acc + totalItem;
  }, 0);

  const grandTotal = subtotal + Number(tax || 0) - Number(discount || 0) + Number(serviceCharge || 0);
  return { subtotal, grandTotal };
};

// ---------------- Helper: Validate Order Data ----------------
const validateOrderData = (orderData) => {
  const errors = [];
  
  if (!orderData.orderType || !['dine-in', 'takeaway', 'delivery'].includes(orderData.orderType)) {
    errors.push('Valid order type is required');
  }
  
  if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    errors.push('Order must contain at least one item');
  } else {
    orderData.items.forEach((item, index) => {
      if (!item.itemId || !item.itemName || !item.basePrice || !item.quantity) {
        errors.push(`Item ${index + 1} is missing required fields`);
      }
      if (item.quantity < 1) {
        errors.push(`Item ${index + 1} must have a quantity of at least 1`);
      }
      if (item.basePrice < 0) {
        errors.push(`Item ${index + 1} cannot have a negative price`);
      }
    });
  }
  
  return errors;
};

// ---------------- Helper: Unit Conversion ----------------
const convertToBaseUnit = (quantity, fromUnit, toUnit) => {
  const unitMultipliers = {
    // Weight
    kg: 1000, g: 1, mg: 0.001,
    // Volume
    liter: 1000, ltr: 1000, ml: 1,
    // Count
    pcs: 1, pack: 1, bottle: 1, dozen: 12, box: 1
  };

  const fromMultiplier = unitMultipliers[fromUnit] || 1;
  const toMultiplier = unitMultipliers[toUnit] || 1;
  
  return (quantity * fromMultiplier) / toMultiplier;
};

// ---------------- Helper: Deduct Inventory (FIXED) ----------------
const deductInventoryForOrder = async (items) => {
  const inventoryUpdates = [];
  
  for (const item of items) {
    const variationId = item.variation?._id || null;

    // Find recipe for this menu item & variation
    let recipe = await Recipe.findOne({ menuId: item.itemId, variationId });
    if (!recipe) {
      recipe = await Recipe.findOne({ menuId: item.itemId, variationId: null });
    }
    
    if (!recipe?.ingredients?.length) {
      console.log(`No recipe found for order item: ${item.itemName}`);
      continue;
    }

    console.log(`Processing recipe for order item: ${item.itemName}, Ingredients:`, recipe.ingredients.length);

    for (const ing of recipe.ingredients) {
      const inventoryItem = await Inventory.findById(ing.inventoryId);
      if (!inventoryItem) {
        console.log(`Inventory item not found: ${ing.inventoryId}`);
        continue;
      }

      // Convert required quantity to inventory base unit
      const requiredQty = convertToBaseUnit(
        ing.quantity * item.quantity, 
        ing.unit, 
        inventoryItem.unit
      );

      console.log(`Order - Deducting ${requiredQty} ${inventoryItem.unit} of ${inventoryItem.name}`);

      if (inventoryItem.quantity < requiredQty) {
        throw new Error(`Insufficient inventory for ${inventoryItem.name}. Required: ${requiredQty}, Available: ${inventoryItem.quantity}`);
      }
      
      // Update inventory quantity
      inventoryItem.quantity = Math.max(0, inventoryItem.quantity - requiredQty);
      inventoryUpdates.push(inventoryItem.save());
    }
  }
  
  await Promise.all(inventoryUpdates);
  console.log('Order inventory deduction completed successfully');
};

// ---------------- Save Order (draft/running) ----------------
export const saveOrder = async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate order data
    const validationErrors = validateOrderData(orderData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    // Generate order number
    if (!orderData.orderNumber) {
      orderData.orderNumber = orderData.isOffline
        ? generateTempOrderNumber()
        : await generateOrderNumber();
    }

    // Calculate totals
    const { subtotal, grandTotal } = calculateOrderTotals(
      orderData.items || [],
      orderData.tax,
      orderData.discount,
      orderData.serviceCharge
    );
    orderData.subtotal = subtotal;
    orderData.grandTotal = grandTotal;

    // Set status
    if (orderData.finalize) {
      orderData.status = "completed";
      orderData.completedAt = new Date();
      
      // Deduct inventory for finalized orders
      try {
        await deductInventoryForOrder(orderData.items || []);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }
    } else {
      orderData.status = orderData.status || "running";
    }

    // Handle offline orders
    if (orderData.isOffline && !orderData.tempOrderId) {
      orderData.tempOrderId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const order = new Order(orderData);
    await order.save();

    res.status(201).json({ 
      success: true, 
      message: "Order saved successfully", 
      orderId: order._id, 
      orderNumber: order.orderNumber,
      order 
    });
  } catch (err) {
    console.error("Save Order Error:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors 
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Order number already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to save order", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------- Generate Final Bill with Inventory Deduction ----------------
export const generateBill = async (req, res) => {
  try {
    const { orderId, paymentMode, split = {} } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "completed") {
      return res.status(400).json({ success: false, message: "Order already completed" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot generate bill for cancelled order" });
    }

    // Calculate payment
    const totalPaid = Number(split.cash || 0) + Number(split.upi || 0) + Number(split.card || 0);
    const returnAmount = Math.max(0, totalPaid - order.grandTotal);
    const dueAmount = Math.max(0, order.grandTotal - totalPaid);

    if (paymentMode !== 'due' && totalPaid < order.grandTotal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient payment. Total: ${order.grandTotal}, Paid: ${totalPaid}`
      });
    }

    // ---------------- Deduct Inventory ----------------
    if (totalPaid >= order.grandTotal || paymentMode === 'due') {
      try {
        await deductInventoryForOrder(order.items || []);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }
    }

    // ---------------- Update Order ----------------
    order.status = "completed";
    order.completedAt = new Date();
    order.paymentDetails = {
      mode: paymentMode,
      amountPaid: totalPaid,
      split,
      returnAmount,
    };

    await order.save();

    res.status(200).json({
      success: true,
      message: "Bill generated successfully",
      orderId: order._id,
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      amountPaid: totalPaid,
      returnAmount,
      dueAmount,
      order,
    });

  } catch (err) {
    console.error("Generate Bill Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate bill",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// ---------------- Cancel Order ----------------
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID is required" 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ 
        success: false, 
        message: "Order already cancelled" 
      });
    }
    
    if (order.status === "completed") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot cancel completed order" 
      });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();

    await order.save();
    
    res.status(200).json({ 
      success: true, 
      message: "Order cancelled successfully", 
      orderId: order._id,
      orderNumber: order.orderNumber
    });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to cancel order", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------- Get All Running Orders ----------------
export const getRunningOrders = async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const orders = await Order.find({ status: "running" })
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
    
    const total = await Order.countDocuments({ status: "running" });

    res.status(200).json({ 
      success: true, 
      orders,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (err) {
    console.error("Get Running Orders Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch orders", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------- Get Order by ID ----------------
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID is required" 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      order 
    });
  } catch (err) {
    console.error("Get Order By ID Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch order", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------- Sync Offline Orders ----------------
export const syncOfflineOrders = async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ 
        success: false, 
        message: "Orders array is required" 
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    for (const orderData of orders) {
      try {
        // Generate a permanent order number for offline orders
        if (orderData.isOffline && orderData.tempOrderId) {
          orderData.orderNumber = await generateOrderNumber();
          orderData.isOffline = false;
          orderData.synced = true;
        }

        const order = new Order(orderData);
        await order.save();
        
        results.successful.push({
          tempOrderId: orderData.tempOrderId,
          orderId: order._id,
          orderNumber: order.orderNumber
        });
      } catch (error) {
        results.failed.push({
          tempOrderId: orderData.tempOrderId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${results.successful.length} orders, ${results.failed.length} failed`,
      results
    });
  } catch (err) {
    console.error("Sync Offline Orders Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to sync offline orders", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};