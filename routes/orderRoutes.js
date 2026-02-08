import express from "express";
import {
  saveOrder,
  generateBill,
  cancelOrder,
  getRunningOrders,
  getOrderById,
} from "../controllers/orderController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Save a running order (supports offline temporary orders)
router.post("/save", authMiddleware(), saveOrder);

// ✅ Generate final bill for an order
router.post("/generate-bill", authMiddleware(), generateBill);

// ✅ Cancel an order
router.post("/:orderId/cancel", authMiddleware(), cancelOrder);

// ✅ Get all running orders
router.get("/running", authMiddleware(), getRunningOrders);

// ✅ Get order by ID
router.get("/:orderId", authMiddleware(), getOrderById);

export default router;
