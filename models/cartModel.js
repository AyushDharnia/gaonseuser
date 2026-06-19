import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.ObjectId, ref: "User" },
  items: [
    {
      product: { type: mongoose.Schema.ObjectId, ref: "Product" },
      quantity: Number,
    },
  ],
});

export const Cart = mongoose.model("Cart", cartSchema);