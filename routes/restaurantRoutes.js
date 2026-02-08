import express from "express";
import { getMyRestaurant, updateMyRestaurant } from "../controllers/restaurantController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import upload from "../utils/multerConfig.js";

const router = express.Router();

// GET logged-in user's restaurant info (all roles can view)
router.get("/me", authMiddleware(), getMyRestaurant);

// UPDATE logged-in user's restaurant info (admin only)
router.put(
  "/me",
  authMiddleware("admin"), // only admin can update
  upload.single("avatar"), // support logo/avatar upload
  updateMyRestaurant
);

export default router;
