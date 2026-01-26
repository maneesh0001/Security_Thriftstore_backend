import express from "express";
import { addToCart, clearCart, getCart } from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router
  .route("/")
  .get(protect, getCart)
  .post(protect, addToCart)
  .delete(protect, clearCart);

export default router;

