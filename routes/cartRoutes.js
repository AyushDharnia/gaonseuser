import express from "express";
import { addToCart, getCart } from "../controllers/cartController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add", isAuthenticated, addToCart);
router.get("/me", isAuthenticated, getCart);

export default router;