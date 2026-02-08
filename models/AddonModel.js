import mongoose from "mongoose";

const AddonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["veg", "non-veg", "vegan"], required: true },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Addon", AddonSchema);
