import Billing from "../models/BillingModel.js";
import Recipe from "../models/RecipeModel.js";
import Inventory from "../models/InventoryModel.js";
import { v4 as uuidv4 } from 'uuid';

// Top of your file
import crypto from 'crypto';

const generateBillingNumber = async () => {
  try {
    const latestBill = await Billing.findOne().sort({ createdAt: -1 });

    let nextNumber = 1;
    if (latestBill && latestBill.billingNumber) {
      const match = latestBill.billingNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const randomSuffix = crypto.randomBytes(2).toString('hex'); // 4-character unique suffix

    return `BIL-${year}${month}-${String(nextNumber).padStart(4, "0")}-${randomSuffix}`;
  } catch (error) {
    const fallbackId = uuidv4().split("-")[0]; // short UUID fallback
    return `BIL-${Date.now()}-${fallbackId}`;
  }
};


// ---------------------
// 🔧 Helper: Get Total Quantity from Batches (NEW)
// ---------------------
const getTotalQuantityFromBatches = (inventoryItem) => {
  if (!inventoryItem.batches || !Array.isArray(inventoryItem.batches)) {
    console.log('   ⚠️  NO_BATCHES_FOUND, returning 0');
    return 0;
  }
  
  const total = inventoryItem.batches.reduce((sum, batch) => {
    const batchQty = Number(batch.quantity) || 0;
    return sum + batchQty;
  }, 0);
  
  console.log(`   📦 TOTAL_QUANTITY_FROM_BATCHES: ${total} ${inventoryItem.unit} (from ${inventoryItem.batches.length} batches)`);
  return total;
};

// ---------------------
// 🔧 Helper: Deduct from Batches (NEW)
// ---------------------
const deductFromBatches = (inventoryItem, requiredQty) => {
  console.log(`   🔧 DEDUCTING_FROM_BATCHES: ${requiredQty} ${inventoryItem.unit}`);
  
  let remainingToDeduct = requiredQty;
  const updatedBatches = [];
  
  // Use FIFO (First In First Out) - deduct from oldest batches first
  const sortedBatches = [...inventoryItem.batches].sort((a, b) => 
    new Date(a.purchaseDate || a.createdAt) - new Date(b.purchaseDate || b.createdAt)
  );
  
  for (const batch of sortedBatches) {
    if (remainingToDeduct <= 0) break;
    
    const batchQty = Number(batch.quantity) || 0;
    console.log(`     🔍 BATCH: ${batch.batchNumber} - ${batchQty} ${inventoryItem.unit}`);
    
    if (batchQty > 0) {
      const deductFromThisBatch = Math.min(batchQty, remainingToDeduct);
      batch.quantity = batchQty - deductFromThisBatch;
      remainingToDeduct -= deductFromThisBatch;
      
      console.log(`     ➖ DEDUCTED: ${deductFromThisBatch} ${inventoryItem.unit} from ${batch.batchNumber}`);
      console.log(`     📊 BATCH_NEW_QTY: ${batch.quantity} ${inventoryItem.unit}`);
    }
    
    updatedBatches.push(batch);
  }
  
  if (remainingToDeduct > 0) {
    console.log(`     ❌ INSUFFICIENT_IN_BATCHES: Still need ${remainingToDeduct} ${inventoryItem.unit} after processing all batches`);
    throw new Error(`Insufficient inventory in batches. Still need ${remainingToDeduct} ${inventoryItem.unit}`);
  }
  
  // Remove batches with 0 quantity
  const finalBatches = updatedBatches.filter(batch => (Number(batch.quantity) || 0) > 0);
  console.log(`     ✅ FINAL_BATCHES: ${finalBatches.length} batches remaining`);
  
  return finalBatches;
};

// ---------------------
// 🔧 Helper: Sanitize & Calculate Cart
// ---------------------
const sanitizeCart = (cart = []) => {
  console.log('🔧 SANITIZE_CART - Input cart:', JSON.stringify(cart, null, 2));
  const sanitized = cart.map((item) => {
    const basePrice = Math.max(0, Number(item.basePrice || 0));
    const quantity = Math.max(1, Number(item.quantity || 1));
    
    const addonsTotal = (item.addons || []).reduce((sum, addon) => 
      sum + Math.max(0, Number(addon.price || 0)), 0);
    
    const total = (basePrice + addonsTotal) * quantity;

    return {
      ...item,
      basePrice,
      quantity,
      total: parseFloat(total.toFixed(2)),
      variation: item.variation ? {
        _id: item.variation._id,
        name: item.variation.name,
        extraPrice: Math.max(0, Number(item.variation.extraPrice || 0))
      } : null,
      addons: (item.addons || []).map(addon => ({
        _id: addon._id,
        name: addon.name,
        price: Math.max(0, Number(addon.price || 0))
      }))
    };
  });
  console.log('🔧 SANITIZE_CART - Output cart:', JSON.stringify(sanitized, null, 2));
  return sanitized;
};

// ---------------------
// 🔧 Helper: Unit Conversion
// ---------------------
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
  
  const result = (quantity * fromMultiplier) / toMultiplier;
  console.log(`📐 UNIT_CONVERSION: ${quantity} ${fromUnit} -> ${result} ${toUnit} (fromMultiplier: ${fromMultiplier}, toMultiplier: ${toMultiplier})`);
  return result;
};

// ---------------------
// 🔧 Helper: Deduct Inventory (FIXED FOR BATCHES)
// ---------------------
const deductInventory = async (cart) => {
  console.log('🛒 STARTING_INVENTORY_DEDUCTION for cart:', JSON.stringify(cart, null, 2));
  const inventoryUpdates = [];
  
  for (const [itemIndex, item] of cart.entries()) {
    console.log(`\n📦 PROCESSING_ITEM_${itemIndex + 1}: ${item.itemName} (ID: ${item.itemId})`);
    console.log(`   Quantity: ${item.quantity}, Variation: ${item.variation?._id || 'None'}`);
    
    const variationId = item.variation?._id || null;

    // Find recipe for this menu item & variation
    console.log(`   🔍 SEARCHING_RECIPE for menuId: ${item.itemId}, variationId: ${variationId}`);
    
    let recipe = await Recipe.findOne({ menuId: item.itemId, variationId });
    if (!recipe) {
      console.log(`   🔍 RECIPE_NOT_FOUND with variation, trying default recipe...`);
      recipe = await Recipe.findOne({ menuId: item.itemId, variationId: null });
    }
    
    if (!recipe) {
      console.log(`   ❌ NO_RECIPE_FOUND for menu item: ${item.itemName} (ID: ${item.itemId})`);
      continue;
    }

    console.log(`   ✅ RECIPE_FOUND: ${recipe.name} (ID: ${recipe._id})`);
    console.log(`   📋 RECIPE_INGREDIENTS:`, recipe.ingredients);

    if (!recipe.ingredients?.length) {
      console.log(`   ⚠️  NO_INGREDIENTS in recipe for: ${item.itemName}`);
      continue;
    }

    for (const [ingIndex, ing] of recipe.ingredients.entries()) {
      console.log(`\n   🧂 PROCESSING_INGREDIENT_${ingIndex + 1}: ${ing.name || 'Unnamed'} (Inventory ID: ${ing.inventoryId})`);
      console.log(`      Recipe requires: ${ing.quantity} ${ing.unit} per unit`);
      
      const inventoryItem = await Inventory.findById(ing.inventoryId);
      if (!inventoryItem) {
        console.log(`      ❌ INVENTORY_ITEM_NOT_FOUND for ID: ${ing.inventoryId}`);
        throw new Error(`Inventory item not found for ID: ${ing.inventoryId}`);
      }

      console.log(`      ✅ INVENTORY_ITEM_FOUND: ${inventoryItem.name} (Unit: ${inventoryItem.unit})`);
      console.log(`      📦 INVENTORY_BATCHES:`, inventoryItem.batches);

      // Get total quantity from batches
      const totalQuantity = getTotalQuantityFromBatches(inventoryItem);

      // Convert required quantity to inventory base unit
      const requiredQty = convertToBaseUnit(
        ing.quantity * item.quantity, 
        ing.unit, 
        inventoryItem.unit
      );

      console.log(`      📊 CALCULATION: ${ing.quantity} ${ing.unit} × ${item.quantity} items = ${ing.quantity * item.quantity} ${ing.unit}`);
      console.log(`      🔄 CONVERTED: ${ing.quantity * item.quantity} ${ing.unit} → ${requiredQty} ${inventoryItem.unit}`);
      console.log(`      💰 REQUIRED: ${requiredQty} ${inventoryItem.unit}, AVAILABLE: ${totalQuantity} ${inventoryItem.unit}`);

      if (totalQuantity < requiredQty) {
        console.log(`      ❌ INSUFFICIENT_STOCK: Required ${requiredQty} ${inventoryItem.unit}, but only ${totalQuantity} ${inventoryItem.unit} available`);
        throw new Error(`Insufficient inventory for ${inventoryItem.name}. Required: ${requiredQty} ${inventoryItem.unit}, Available: ${totalQuantity} ${inventoryItem.unit}`);
      }
      
      // Update inventory batches
      console.log(`      🔄 UPDATING_BATCHES...`);
      inventoryItem.batches = deductFromBatches(inventoryItem, requiredQty);
      
      console.log(`      ✅ BATCHES_UPDATED: ${inventoryItem.batches.length} batches remaining`);
      
      inventoryUpdates.push(inventoryItem.save());
    }
  }
  
  if (inventoryUpdates.length === 0) {
    console.log('⚠️  NO_INVENTORY_UPDATES - No ingredients found to deduct');
  } else {
    console.log(`\n💾 SAVING ${inventoryUpdates.length} INVENTORY_UPDATES...`);
    await Promise.all(inventoryUpdates);
    console.log('✅ ALL_INVENTORY_UPDATES_SAVED_SUCCESSFULLY');
  }
};

// ---------------------
// 🔧 Helper: Calculate Totals
// ---------------------
const calculateTotals = (cart = [], taxRate = 0, discount = 0, serviceCharge = 0) => {
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = parseFloat((subtotal * (taxRate / 100)).toFixed(2));
  const total = subtotal + taxAmount - discount + serviceCharge;
  
  return { 
    subtotal: parseFloat(subtotal.toFixed(2)), 
    taxAmount, 
    total: parseFloat(total.toFixed(2)),
    discount,
    serviceCharge
  };
};

// ---------------------
// 🔧 Helper: Calculate Payment
// ---------------------
const calculatePayment = (total, payment = {}) => {
  const cash = Math.max(0, Number(payment.cash || 0));
  const card = Math.max(0, Number(payment.card || 0));
  const upi = Math.max(0, Number(payment.upi || 0));
  
  const totalPaid = cash + card + upi;
  const due = Math.max(0, total - totalPaid);
  
  return { cash, card, upi, totalPaid, due };
};

// ---------------------
// 🔧 Helper: Normalize Order Type
// ---------------------
const normalizeOrderType = (orderType) => {
  const mapping = {
    dinein: "dine-in",
    "dine-in": "dine-in",
    takeaway: "takeaway",
    delivery: "delivery",
    online: "online",
  };
  const normalized = mapping[orderType?.toLowerCase()];
  if (!normalized) {
    throw new Error(`Invalid orderType: ${orderType}`);
  }
  return normalized;
};

// ---------------------
// 🔧 Helper: Validate Customer Info
// ---------------------
const validateCustomerInfo = (customer) => {
  if (!customer?.name || !customer.name.trim()) {
    throw new Error("Customer name is required");
  }
  
  if (!customer?.phone || !customer.phone.trim()) {
    throw new Error("Customer phone is required");
  }
  
  const phoneRegex = /^[0-9]{10,15}$/;
  if (!phoneRegex.test(customer.phone.replace(/[^0-9]/g, ''))) {
    throw new Error("Customer phone number is invalid");
  }
  
  if (customer.email && customer.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      throw new Error("Customer email is invalid");
    }
  }
  
  return {
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    email: customer.email ? customer.email.trim().toLowerCase() : undefined,
    tableNumber: customer.tableNumber ? customer.tableNumber.trim() : undefined,
    deliveryAddress: customer.deliveryAddress ? customer.deliveryAddress.trim() : undefined
  };
};

// ---------------------
// 📌 Create Bill (FIXED BILLING NUMBER)
// ---------------------
export const createBill = async (req, res) => {
  console.log('\n💰 CREATE_BILL_REQUEST:', {
    body: req.body,
    finalize: req.body.finalize,
    cartLength: req.body.cart?.length
  });

  try {
    const { 
      cart = [], 
      orderType, 
      customer, 
      paymentMethod, 
      payment = {}, 
      finalize = false,
      taxRate = 5,
      discount = 0,
      serviceCharge = 0
    } = req.body;

    // Validate required fields
    if (!cart || cart.length === 0) {
      console.log('❌ CREATE_BILL_ERROR: Empty cart');
      return res.status(400).json({ 
        success: false, 
        message: "Cart cannot be empty" 
      });
    }

    if (!orderType) {
      console.log('❌ CREATE_BILL_ERROR: No order type');
      return res.status(400).json({ 
        success: false, 
        message: "Order type is required" 
      });
    }

    if (!paymentMethod) {
      console.log('❌ CREATE_BILL_ERROR: No payment method');
      return res.status(400).json({ 
        success: false, 
        message: "Payment method is required" 
      });
    }

    // Generate billing number FIRST
    const billingNumber = await generateBillingNumber();
    console.log(`📄 GENERATED_BILLING_NUMBER: ${billingNumber}`);

    // Validate and normalize data
    let validOrderType;
    try {
      validOrderType = normalizeOrderType(orderType);
    } catch (err) {
      console.log('❌ CREATE_BILL_ERROR: Invalid order type:', err.message);
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    let validCustomer;
    try {
      validCustomer = validateCustomerInfo(customer);
    } catch (err) {
      console.log('❌ CREATE_BILL_ERROR: Invalid customer:', err.message);
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    // Sanitize and calculate cart totals
    const sanitizedCart = sanitizeCart(cart);
    const { subtotal, taxAmount, total } = calculateTotals(sanitizedCart, taxRate, discount, serviceCharge);
    const { cash, card, upi, totalPaid, due } = calculatePayment(total, payment);
    
    console.log(`💰 PAYMENT_CALCULATION: Total: ${total}, Paid: ${totalPaid}, Due: ${due}`);
    
    // Validate payment for non-draft bills
    if (finalize && paymentMethod !== 'due' && totalPaid < total) {
      console.log('❌ CREATE_BILL_ERROR: Insufficient payment');
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient payment. Total: ${total}, Paid: ${totalPaid}` 
      });
    }

    // Deduct inventory if finalizing
    if (finalize) {
      console.log('🚀 FINALIZE_BILL: Starting inventory deduction...');
      try {
        await deductInventory(sanitizedCart);
        console.log('✅ INVENTORY_DEDUCTION_COMPLETED');
      } catch (err) {
        console.log('❌ INVENTORY_DEDUCTION_ERROR:', err.message);
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }
    } else {
      console.log('📝 SAVING_AS_DRAFT: Skipping inventory deduction');
    }

    const orderStatus = finalize ? (due > 0 ? "pending" : "paid") : "draft";
    console.log(`📊 ORDER_STATUS: ${orderStatus} (finalize: ${finalize}, due: ${due})`);

    const newBill = new Billing({
      billingNumber,
      cart: sanitizedCart,
      orderType: validOrderType,
      customer: validCustomer,
      paymentMethod,
      payment: { 
        mode: paymentMethod,
        split: { cash, card, upi },
        totalPaid,
        due 
      },
      total,
      taxAmount,
      discountAmount: discount,
      serviceCharge,
      orderStatus,
    });

    console.log('💾 SAVING_BILL_TO_DATABASE...');
    await newBill.save();
    console.log('✅ BILL_SAVED_SUCCESSFULLY');

    res.status(201).json({ 
      success: true, 
      message: finalize ? "Bill created successfully" : "Draft saved successfully",
      bill: newBill 
    });
  } catch (err) {
    console.error("❌ CREATE_BILL_ERROR:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      console.log('❌ VALIDATION_ERROR:', errors);
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors 
      });
    }
    
    if (err.code === 11000) {
      console.log('❌ DUPLICATE_BILLING_NUMBER_ERROR:', err.message);
      return res.status(400).json({ 
        success: false, 
        message: "Duplicate billing number error. Please try again." 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to create bill", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};


// ---------------------
// ✏️ Update Bill
// ---------------------
export const updateBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { 
      cart = [], 
      orderType, 
      customer, 
      paymentMethod, 
      payment = {}, 
      finalize = false,
      taxRate = 5,
      discount = 0,
      serviceCharge = 0
    } = req.body;

    const existingBill = await Billing.findById(billId);
    if (!existingBill) {
      return res.status(404).json({ 
        success: false, 
        message: "Bill not found" 
      });
    }

    if (!cart || cart.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Cart cannot be empty" 
      });
    }

    if (!orderType) {
      return res.status(400).json({ 
        success: false, 
        message: "Order type is required" 
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment method is required" 
      });
    }

    let validOrderType;
    try {
      validOrderType = normalizeOrderType(orderType);
    } catch (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    let validCustomer;
    try {
      validCustomer = validateCustomerInfo(customer);
    } catch (err) {
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    const sanitizedCart = sanitizeCart(cart);
    const { subtotal, taxAmount, total } = calculateTotals(sanitizedCart, taxRate, discount, serviceCharge);
    const { cash, card, upi, totalPaid, due } = calculatePayment(total, payment);
    
    if (finalize && paymentMethod !== 'due' && totalPaid < total) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient payment. Total: ${total}, Paid: ${totalPaid}` 
      });
    }

    // Check if we need to adjust inventory
    if (existingBill.orderStatus === 'draft' && finalize) {
      try {
        await deductInventory(sanitizedCart);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: err.message 
        });
      }
    } else if (existingBill.orderStatus !== 'draft' && !finalize) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot convert finalized bill back to draft" 
      });
    }

    const orderStatus = finalize ? (due > 0 ? "pending" : "paid") : "draft";

    const updatedBill = await Billing.findByIdAndUpdate(
      billId,
      {
        cart: sanitizedCart,
        orderType: validOrderType,
        customer: validCustomer,
        paymentMethod,
        payment: { 
          mode: paymentMethod,
          split: { cash, card, upi },
          totalPaid,
          due 
        },
        total,
        taxAmount,
        discountAmount: discount,
        serviceCharge,
        orderStatus,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({ 
      success: true, 
      message: finalize ? "Bill updated successfully" : "Draft updated successfully",
      bill: updatedBill 
    });
  } catch (err) {
    console.error("Update Bill Error:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to update bill", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------------
// 📋 Get All Bills
// ---------------------
export const getAllBills = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      startDate, 
      endDate, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    const filter = {};
    if (status) filter.orderStatus = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const bills = await Billing.find(filter)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
    
    const total = await Billing.countDocuments(filter);

    res.status(200).json({ 
      success: true, 
      bills,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (err) {
    console.error("Get All Bills Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch bills", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------------
// 📄 Get Single Bill
// ---------------------
export const getBillById = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: "Bill not found" 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      bill 
    });
  } catch (err) {
    console.error("Get Bill By ID Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch bill", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------------
// ❌ Delete Bill / Cancel Draft
// ---------------------
export const deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: "Bill not found" 
      });
    }
    
    if (bill.orderStatus !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: "Only draft bills can be deleted" 
      });
    }
    
    await Billing.findByIdAndDelete(billId);
    
    res.status(200).json({ 
      success: true, 
      message: "Bill deleted successfully" 
    });
  } catch (err) {
    console.error("Delete Bill Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete bill", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};

// ---------------------
// 💰 Add Payment to Bill
// ---------------------
export const addPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { payment = {} } = req.body;
    
    const bill = await Billing.findById(billId);
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: "Bill not found" 
      });
    }
    
    if (bill.orderStatus === 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot add payment to draft bill" 
      });
    }
    
    const { cash, card, upi, totalPaid, due } = calculatePayment(bill.total, payment);
    
    bill.payment = {
      mode: bill.paymentMethod,
      split: { cash, card, upi },
      totalPaid,
      due
    };
    
    if (due <= 0) {
      bill.orderStatus = 'paid';
    }
    
    await bill.save();
    
    res.status(200).json({ 
      success: true, 
      message: "Payment added successfully",
      bill 
    });
  } catch (err) {
    console.error("Add Payment Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to add payment", 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};