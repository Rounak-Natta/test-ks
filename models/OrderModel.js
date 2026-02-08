import mongoose from "mongoose";

const AddonSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
});

const VariationSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }, // Changed from extraPrice to price
});

const OrderItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  variation: VariationSchema,
  addons: [AddonSchema],
  total: { type: Number, required: true, min: 0 },
});

const PaymentSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["cash", "upi", "card", "split", "none"],
    default: "none",
  },
  amountPaid: { type: Number, default: 0, min: 0 },
  split: {
    cash: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
  },
  returnAmount: { type: Number, default: 0, min: 0 },
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["running", "completed", "cancelled"],
    default: "running",
  },
  orderType: {
    type: String,
    enum: ["dine-in", "takeaway", "delivery"],
    required: true,
  },
  tableNumber: { type: String },
  steward: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String },
  },
  items: { type: [OrderItemSchema], default: [] },
  subtotal: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  serviceCharge: { type: Number, default: 0, min: 0 },
  grandTotal: { type: Number, default: 0, min: 0 },
  kotCount: { type: Number, default: 0 },
  paymentDetails: { type: PaymentSchema, default: () => ({}) },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  isOffline: { type: Boolean, default: false },
  tempOrderId: { type: String },
  synced: { type: Boolean, default: false },
});

// Add index for better query performance
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });

export default mongoose.model("Order", OrderSchema);