import mongoose from "mongoose";

const DietaryEnum = ["veg", "non-veg", "vegan"];
const UnitEnum = ["kg", "liter", "pcs", "pack", "bottle", "dozen", "g", "ml", "box"];
const CategoryEnum = ["spices", "meat", "vegetables", "dairy", "beverages", "grains", "packaged"];

// Ingredient schema
const ingredientSchema = new mongoose.Schema({
  inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: UnitEnum, required: true },
  baseQuantity: { type: Number, default: null },
});

// Recipe schema
const RecipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    menuId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: false },
    variationId: { type: mongoose.Schema.Types.ObjectId, required: false },

    category: { type: String, enum: CategoryEnum, required: true },

    ingredients: { type: [ingredientSchema], default: [] },

    vegType: { type: String, enum: DietaryEnum, required: true },

    perServingCost: { type: Number, required: false, default: 0, min: 0 },

    notes: { type: String, default: "" },

    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Recipe", RecipeSchema);
