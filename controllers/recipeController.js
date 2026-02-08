import Recipe from "../models/RecipeModel.js";

// --------------------
// Get all active recipes
// --------------------
export const getRecipeList = async (req, res) => {
  try {
    const recipes = await Recipe.find({ isActive: true })
      .populate("menuId")
      .populate("ingredients.inventoryId")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, recipes });
  } catch (err) {
    console.error("getRecipeList error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------
// GET recipe by menuId (optionally variationId)
// --------------------
export const getRecipeByMenuId = async (req, res) => {
  try {
    const { menuId } = req.params;
    const { variationId } = req.query;

    let recipe = null;

    if (variationId) {
      recipe = await Recipe.findOne({ menuId, variationId })
        .populate("ingredients.inventoryId");
    }

    if (!recipe) {
      recipe = await Recipe.findOne({ menuId, variationId: null })
        .populate("ingredients.inventoryId");
    }

    if (!recipe) {
      return res.status(404).json({ success: false, message: "No recipe found for this menu item." });
    }

    res.status(200).json({ success: true, recipe });
  } catch (error) {
    console.error("getRecipeByMenuId error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// --------------------
// Get recipe by ID
// --------------------
export const getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate("menuId")
      .populate("ingredients.inventoryId");

    if (!recipe || !recipe.isActive) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }

    res.status(200).json({ success: true, recipe });
  } catch (err) {
    console.error("getRecipeById error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------
// Create a new recipe
// --------------------
export const createRecipe = async (req, res) => {
  try {
    const {
      name,
      description,
      menuId,
      category,
      variationId,
      ingredients,
      vegType,
      notes,
      perServingCost // 🔽 NEW FIELD
    } = req.body;

    if (!name || !menuId || !category || !ingredients?.length || !vegType) {
      return res.status(400).json({
        success: false,
        message: "Name, menuId, category, vegType and ingredients are required",
      });
    }

    const newRecipe = new Recipe({
      name,
      description: description || "",
      menuId,
      category,
      variationId: variationId || null,
      ingredients,
      vegType,
      notes: notes || "",
      perServingCost: perServingCost || 0, // 🔽 NEW FIELD
      lastUpdatedBy: req.user._id,
    });

    await newRecipe.save();

    const populatedRecipe = await Recipe.findById(newRecipe._id)
      .populate("menuId")
      .populate("ingredients.inventoryId");

    res.status(201).json({ success: true, recipe: populatedRecipe });
  } catch (err) {
    console.error("createRecipe error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------
// Update an existing recipe
// --------------------
export const updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe || !recipe.isActive) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }

    const updatableFields = [
      "name",
      "description",
      "menuId",
      "category",
      "variationId",
      "ingredients",
      "vegType",
      "notes",
      "perServingCost", // 🔽 NEW FIELD
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        recipe[field] = req.body[field];
      }
    });

    recipe.lastUpdatedBy = req.user._id;
    await recipe.save();

    const populatedRecipe = await Recipe.findById(recipe._id)
      .populate("menuId")
      .populate("ingredients.inventoryId");

    res.status(200).json({ success: true, recipe: populatedRecipe });
  } catch (err) {
    console.error("updateRecipe error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// --------------------
// Soft delete recipe
// --------------------
export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe || !recipe.isActive) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }

    recipe.isActive = false;
    await recipe.save();

    res.status(200).json({ success: true, message: "Recipe deleted successfully" });
  } catch (err) {
    console.error("deleteRecipe error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
