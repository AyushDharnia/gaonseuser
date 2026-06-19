import express from "express";
import { createOrder, getMyOrders } from "../controllers/orderController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/create", isAuthenticated, createOrder);
router.get("/me", isAuthenticated, getMyOrders);

export default router;