import mongoose from "mongoose";

const AddonSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
});

const VariationSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, required: true },
  extraPrice: { type: Number, default: 0, min: 0 },
});

const BillingItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  quantityUnit: { type: String, default: "unit" }, // kg, g, liter, piece
  variation: VariationSchema,
  addons: [AddonSchema],
  total: { type: Number, required: true, min: 0 },
  perServingProfit: { type: Number, default: 0, min: 0 }, 
  batchesUsed: [
    {
      batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
      quantityUsed: { type: Number, required: true, min: 0 },
    },
  ],
});

const PaymentSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["cash", "upi", "card", "split", "due"],
    default: "cash",
  },
  split: {
    cash: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
  },
  totalPaid: { type: Number, default: 0, min: 0 },
  due: { type: Number, default: 0, min: 0 },
});

const BillingSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

  // ✅ ADD THIS FIELD
  billingNumber: {
    type: String,
    required: true,
    unique: true,
  },

  cart: { 
    type: [BillingItemSchema], 
    default: [], 
    validate: {
      validator: function(cart) {
        return cart.length > 0;
      },
      message: "Cart cannot be empty"
    }
  },
  orderType: { 
    type: String, 
    enum: ["dine-in", "takeaway", "online"], 
    required: true 
  },
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    tableNumber: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
  },
  paymentMethod: { 
    type: String, 
    enum: ["cash", "card", "upi", "split", "due"], 
    required: true 
  },
  payment: { type: PaymentSchema, default: () => ({}) },
  total: { type: Number, required: true, min: 0 },
  orderStatus: { 
    type: String, 
    enum: ["draft", "pending", "paid", "cancelled"], 
    default: "draft" 
  },
  taxAmount: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  serviceCharge: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


// Add indexes
BillingSchema.index({ orderStatus: 1, createdAt: -1 });
BillingSchema.index({ "customer.phone": 1 });
BillingSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
BillingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Billing", BillingSchema);
