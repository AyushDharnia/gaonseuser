import "./utils/env.js";
import express from "express";
import "./models/cityModel.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import { connection } from "./database/dbConnection.js";
import { errorMiddleware } from "./middlewares/error.js";

import userRouter from "./routes/userRouter.js";
import zoneRouter from "./routes/zoneRoutes.js";
import addressRouter from "./routes/addressRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import subscriptionRouter from "./routes/subscriptionRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import walletRouter from "./routes/walletRoutes.js";

import { removeUnverifiedAccounts } from "./automation/removeUnverifiedAccounts.js";

// 🔥 INIT APP
export const app = express();


// 🌐 CORS
app.use(
  cors({
    origin: true, // FIXED for mobile
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// 🍪 MIDDLEWARES
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔌 SOCKET SAFE ATTACH
app.use((req, res, next) => {
  if (global.io) {
    req.io = global.io;
  }
  next();
});

// 🧪 TEST ROUTE
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// 🚀 ROUTES
app.use("/api/v1/user", userRouter);
app.use("/api/v1/zones", zoneRouter);
app.use("/api/v1/address", addressRouter);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/subscription", subscriptionRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/wallet", walletRouter);

// 🧹 CRON
removeUnverifiedAccounts();

// 🛢 DB
connection();

// ❌ ERROR HANDLER
app.use(errorMiddleware);