import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  createSubscription,
  getMySubscriptions,
  getSingleSubscription,
  updateSubscription,
  deleteSubscription,
  toggleSubscriptionStatus,
} from "../controllers/subscriptionController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createSubscription);
router.get("/me", isAuthenticated, getMySubscriptions);
router.get("/:id", isAuthenticated, getSingleSubscription);
router.put("/update/:id", isAuthenticated, updateSubscription);
router.delete("/delete/:id", isAuthenticated, deleteSubscription);
router.put("/toggle/:id", isAuthenticated, toggleSubscriptionStatus);

export default router;