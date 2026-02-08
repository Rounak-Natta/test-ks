// routes/variationAddonRoutes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createAddon,
  getAllAddons,
  updateAddon,
  deleteAddon,
} from "../controllers/AddonController.js";

import {
  createVariation,
  getAllVariations,
  updateVariation,
  deleteVariation,
} from "../controllers/VariationController.js";

const router = express.Router();

// Addon Routes
router.post("/create-addon",authMiddleware("admin","manager"), createAddon);
router.get("/addons", getAllAddons);
router.put("/addon/:id", authMiddleware("admin","manager"), updateAddon);
router.delete("/addon/:id",authMiddleware("admin","manager"), deleteAddon);

// Variation Routes
router.post("/create-variation",authMiddleware("admin","manager"), createVariation);
router.get("/variations", getAllVariations);
router.delete("/variation/:id",authMiddleware("admin","manager"), deleteVariation);
router.put("/variation/:id", authMiddleware("admin","manager"), updateVariation);

export default router;
