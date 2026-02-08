import mongoose from "mongoose";

const DietaryEnum = ["veg", "non-veg", "vegan"];

const MenuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },

  dietary: { type: String, enum: DietaryEnum, required: true },
  menuImg: { type: String, default: null },

  variations: {
    type: [
      {
        variationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variation",
          required: true,
        },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    default: [],
  },

  // ✅ Ref-based Add-ons (use price from AddonModel)
  addOns: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AddOn",
      },
    ],
    default: [],
  },

  extraCharge: { type: Number, default: 0, min: 0 },
  description: { type: String, default: "" },
  tags: { type: [String], default: [] },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

export default mongoose.model("MenuItem", MenuItemSchema);
