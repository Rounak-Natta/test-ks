  import express from 'express';
  import upload from '../utils/multerConfig.js';
  import authMiddleware from '../middlewares/authMiddleware.js';
  import {
    addMenuModel,
    getAllMenuModels,
    getMenuModelById,
    updateMenuModel,
    deleteMenuModel
  } from '../controllers/MenuController.js';

  const router = express.Router();

  // Only admin & manager can modify
  router.post('/add-menu', authMiddleware("admin","manager"), upload.single('menuImg'), addMenuModel);
  router.put('/update/:id', authMiddleware("admin","manager"), upload.single('menuImg'), updateMenuModel);
  router.delete('/delete/:id', authMiddleware("admin","manager"), deleteMenuModel);

  // Any logged-in user can view
  router.get('/get-all', authMiddleware(), getAllMenuModels);
  router.get('/get/:id', authMiddleware(), getMenuModelById);

  export default router;
