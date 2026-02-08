// routes/recipeRoutes.js
import express from "express";
import {
  createRecipe,
  getRecipeList,
  getRecipeById,
  updateRecipe,
  getRecipeByMenuId,
  deleteRecipe,
} from "../controllers/recipeController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// --------------------
// Recipe Routes
// --------------------

// Anyone logged in can view recipes
router.get("/get-all", authMiddleware(), getRecipeList);
router.get("/get/:id", authMiddleware(), getRecipeById);
router.get("/by-menu/:menuId", authMiddleware(), getRecipeByMenuId);


// Only admin/manager can create/update
router.post("/add-recipe", authMiddleware("admin", "manager"), createRecipe);
router.put("/update/:id", authMiddleware("admin", "manager"), updateRecipe);

// Only admin can delete
router.delete("/delete/:id", authMiddleware("admin"), deleteRecipe);

export default router;
