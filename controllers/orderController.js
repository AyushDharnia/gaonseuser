import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import { Inventory } from "../models/Inventory.js";

export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { items, address, total, type } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart empty",
      });
    }
    // CREATE ORDER
    const order = await Order.create({
      user: userId,
      items,
      address,
      total,
      type: "normal",
      status: "pending",
      date: new Date().toISOString(),
    });

    // Notify delivery backend for real-time socket emit
    try {
      fetch("http://localhost:4001/api/delivery/today-orders/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }).catch((err) => console.log("Notify delivery error:", err.message));
    } catch (err) {
      console.log("Failed to notify delivery backend:", err.message);
    }

    // UPDATE INVENTORY PRODUCT-WISE
    for (const item of items) {
      await Inventory.findOneAndUpdate(
        { productId: item._id },
        {
          $setOnInsert: {
            productId: item._id,
          },
          $set: {
            productName: item.name,
            lastOrderedAt: new Date(),
          },
          $inc: {
            totalDemand: Number(item.qty),
            todayDemand: Number(item.qty),
            soldToday: Number(item.qty),
          },
        },
        {
          upsert: true,
          new: true,
        }
      );
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Order creation failed",
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};
