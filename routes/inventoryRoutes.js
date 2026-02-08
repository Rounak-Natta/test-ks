import express from "express";
import {
  createInventory,
  getInventoryList,
  getInventoryById,
  updateInventory,
  deleteInventory,
  addNewBatchToInventory, // <-- new controller
} from "../controllers/inventoryController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Inventory Routes
router.get("/get-all", authMiddleware(), getInventoryList);
router.get("/get/:id", authMiddleware(), getInventoryById);
router.post("/add-item", authMiddleware("admin", "manager"), createInventory);
router.put("/update/:id", authMiddleware("admin", "manager"), updateInventory);
router.delete("/delete/:id", authMiddleware("admin"), deleteInventory);

// ✅ New route: Add batch to existing inventory
router.post("/add-batch/:id", authMiddleware("admin", "manager"), addNewBatchToInventory);

export default router;
