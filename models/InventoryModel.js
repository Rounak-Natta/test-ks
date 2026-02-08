import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: ["pending", "synced"],
      default: "pending",
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const wastageSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      default: "",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Item name cannot exceed 100 characters"],
    },
    type: {
      type: String,
      required: true,
      enum: [
        "spices",
        "meat",
        "vegetables",
        "dairy",
        "beverages",
        "grains",
        "packaged",
        "general",
      ],
      default: "general",
    },
    unit: {
      type: String,
      required: true,
      enum: [
        "kg",
        "g",
        "mg",
        "ltr",
        "ml",
        "pcs",
        "pack",
        "bottle",
        "dozen",
        "box",
      ],
      default: "pcs",
    },
    storageLocation: {
      type: String,
      required: true,
      enum: [
        "fridge",
        "freezer",
        "dry storage",
        "pantry",
        "cold storage",
        "cooler",
        "shelf",
        "default",
      ],
      default: "default",
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Supplier name cannot exceed 100 characters"],
      default: "Atanu Deb",
    },
    reorderLevel: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      default: null,
    },
    batches: [batchSchema],
    wastage: [wastageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
inventorySchema.index({ name: 1 });
inventorySchema.index({ type: 1 });
inventorySchema.index({ supplierName: 1 });
inventorySchema.index({ isActive: 1 });
inventorySchema.index({ "batches.expiryDate": 1 });
inventorySchema.index({ createdAt: -1 });

// Virtual for total quantity
inventorySchema.virtual("totalQuantity").get(function () {
  return this.batches.reduce((total, batch) => total + batch.quantity, 0);
});

// Virtual for current stock value
inventorySchema.virtual("stockValue").get(function () {
  return this.batches.reduce((total, batch) => {
    return total + batch.quantity * batch.costPrice;
  }, 0);
});

// Method to check if item needs reordering
inventorySchema.methods.needsReorder = function () {
  return this.totalQuantity <= this.reorderLevel;
};

// Pre-save middleware to validate data
inventorySchema.pre("save", function (next) {
  if (this.batches.length > 0) {
    const latestBatch = this.batches[this.batches.length - 1];
    if (latestBatch.expiryDate && latestBatch.expiryDate < new Date()) {
      console.warn(`Warning: Batch ${latestBatch.batchNumber} has expired`);
    }
  }
  next();
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
