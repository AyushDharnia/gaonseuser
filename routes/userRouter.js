import express from "express";
import {
  register,
  verifyOTP,
  login,
  logout,
  getUser,
  forgotPassword,
  resetPassword,
  updateCity,
  updateRequest,
  updateVerify,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/otp-verification", verifyOTP);
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, getUser);
router.post("/password/forgot", forgotPassword);
router.put("/password/reset", resetPassword);
router.put("/update-city", isAuthenticated, updateCity);
router.post("/update-request", isAuthenticated, updateRequest);
router.post("/update-verify", isAuthenticated, updateVerify);

export default router;