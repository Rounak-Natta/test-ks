import mongoose from "mongoose";
// ===== ENUMS =====
const CategoryTypeEnum = Object.freeze({
  FOOD: 'FOOD',
  BEVERAGE: 'BEVERAGE',
  COMBO: 'COMBO',
  DESSERT: 'DESSERT',
  SNACK: 'SNACK',
  ALCOHOL: 'ALCOHOL',
  NON_ALCOHOLIC: 'NON_ALCOHOLIC',
  SPECIAL: 'SPECIAL',
  SEASONAL: 'SEASONAL',
  CUSTOM: 'CUSTOM',
  ADDON: 'ADDON',
  INGREDIENT: 'INGREDIENT',
  SERVICE: 'SERVICE',
});


// ===== SCHEMA =====
const CategorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    categoryDescription: {
      type: String,
      default: '',
    },
    categoryType: {
      type: String,
      enum: Object.values(CategoryTypeEnum),
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// ===== ENUM EXPORTS =====
Object.assign(CategorySchema.statics, {
  CategoryTypeEnum,
});

const Category = mongoose.model('Category', CategorySchema);

export default Category;

