import Category from '../models/CategoryModel.js';

const categoryImages = {
  breakfast: "https://cdn.example.com/breakfast.png",
  lunch: "https://cdn.example.com/lunch.png",
  dinner: "https://cdn.example.com/dinner.png",
};

// Add category
export const addCategory = async (req, res) => {
  try {
    const { categoryName, categoryDescription, categoryType, createdBy } = req.body;

    const existing = await Category.findOne({ categoryName });
    if (existing)
      return res.status(400).json({ success: false, message: 'Category already exists' });

    const newCategory = new Category({
      categoryName,
      categoryDescription,
      categoryType,
      createdBy,
      image: categoryTypeImages[categoryType] || categoryTypeImages.CUSTOM,
    });

    await newCategory.save();
    return res.status(201).json({ success: true, message: 'Category added successfully', category: newCategory });
  } catch (error) {
    console.error('Add Category Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryName, categoryDescription, categoryType, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    if (categoryName && categoryName !== category.categoryName) {
      const existing = await Category.findOne({ categoryName });
      if (existing) return res.status(400).json({ success: false, message: 'Category name already exists' });
    }

    category.categoryName = categoryName || category.categoryName;
    category.categoryDescription = categoryDescription || category.categoryDescription;

    if (categoryType && categoryType !== category.categoryType) {
      category.categoryType = categoryType;
      category.image = categoryTypeImages[categoryType] || categoryTypeImages.CUSTOM;
    }

    if (typeof isActive === 'boolean') category.isActive = isActive;

    await category.save();
    return res.status(200).json({ success: true, message: 'Category updated successfully', category });
  } catch (error) {
    console.error('Update Category Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating category' });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1, createdAt: -1 });
    return res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Get All Categories Error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching categories" });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await category.deleteOne();
    return res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting category' });
  }
};

