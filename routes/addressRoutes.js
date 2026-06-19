import express from "express";
import {
  addAddress,
  getMyAddresses,
} from "../controllers/addressController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add", isAuthenticated, addAddress);
router.get("/me", isAuthenticated, getMyAddresses);

export default router;