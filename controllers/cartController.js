import { Cart } from "../models/cartModel.js";

export const addToCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  cart.items.push(req.body);
  await cart.save();

  res.json({ success: true, cart });
};

export const getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

  res.json({ success: true, cart });
};