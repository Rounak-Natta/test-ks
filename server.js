import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/config.js';

// Routes
import authRoutes from './routes/AuthRoutes.js';
import categoryRoutes from './routes/CategoryRoutes.js';
import menuRoutes from './routes/MenuRoutes.js';
import variationRoutes from './routes/variationAddonRoutes.js';
import orderRoutes from "./routes/orderRoutes.js";
import billingRoutes from './routes/billingRoutes.js';
import restaurantRoutes from "./routes/restaurantRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";

dotenv.config();

const app = express();

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// Serve static uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --------------------
// API Routes
// --------------------
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/variation', variationRoutes);
app.use('/api/addon', variationRoutes); // combined variation/addon routes
app.use('/api/orders', orderRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipe', recipeRoutes); 
app.use('/api/analytics', analyticsRoutes);



// --------------------
// Start Server
// --------------------
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to database:", err);
    process.exit(1);
  });
