import mongoose from "mongoose";

const VariationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true , minlength: 1},
  type: { type: String, enum: ["size", "portion", "quantity", "custom"], required: true },
  price: { type: Number, required: true, default: 0 }, // ← add this
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});


export default mongoose.model("Variation", VariationSchema);
