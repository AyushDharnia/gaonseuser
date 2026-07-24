import express from "express";
import {
  getWallet,
  createOrder,
  verifyPayment,
  phonepeWebhook,
} from "../controllers/walletController.js";

import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

/* ===================================
   GET WALLET
=================================== */
router.get(
  "/me",
  isAuthenticated,
  getWallet
);

/* ===================================
   CREATE ORDER
=================================== */
router.post(
  "/create-order",
  isAuthenticated,
  createOrder
);

/* ===================================
   VERIFY PAYMENT
=================================== */
router.post(
  "/verify-payment",
   isAuthenticated,
  verifyPayment
);

/* ===================================
   WEBHOOK
=================================== */
router.post(
  "/webhook",
  phonepeWebhook
);

export default router;
