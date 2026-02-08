import express from 'express';
import { addCategory, getAllCategories, updateCategory, deleteCategory } from '../controllers/CategoryController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Only admin and manager can add/update/delete
router.post('/add-category', authMiddleware("admin", "manager"), addCategory);
router.put('/update/:id', authMiddleware("admin", "manager"), updateCategory);
router.delete('/delete/:id', authMiddleware("admin", "manager"), deleteCategory);

// Anyone logged in can view categories
router.get('/get-all', authMiddleware(), getAllCategories);

export default router;
