import express from "express";
import { getAnalytics } from "../controllers/analyticsController.js";
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get("/", authMiddleware("admin","manager"), getAnalytics);

export default router;
