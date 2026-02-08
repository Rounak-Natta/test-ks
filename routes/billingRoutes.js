import express from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  deleteBill,
  addPayment
} from "../controllers/billingController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Create a new bill
router.post("/", authMiddleware(), createBill);

// ✅ Get all bills
router.get("/", authMiddleware(), getAllBills);

// ✅ Get a specific bill by ID
router.get("/:billId", authMiddleware(), getBillById);

// ✅ Update a specific bill by ID
router.put("/:billId", authMiddleware(), updateBill);

// ✅ Delete a specific bill by ID
router.delete("/:billId", authMiddleware(), deleteBill);

// ✅ Add payment to a bill
router.post("/:billId/payment", authMiddleware(), addPayment);

export default router;