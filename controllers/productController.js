import { Product } from "../models/productModel.js";

export const getProducts = async (req, res) => {
  try {
    const { cityId } = req.query;

    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: "City required",
      });
    }

    const products = await Product.find({
      city: cityId,
      isActive: true,
      currentStock: { $gt: 0 },
    }).populate("category");

    res.json({
      success: true,
      products,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
