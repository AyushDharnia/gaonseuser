import express from "express";
import mongoose from "mongoose";
import { Product } from "../models/productModel.js";
import { Category } from "../models/categorModel.js";

const router = express.Router();

/**
 * 🧠 GET PRODUCTS (ENRICHED WITH CATEGORY DATA)
 */
router.get("/", async (req, res) => {
  try {
    const { cityId } = req.query;

    if (!cityId) {
      return res.status(400).json({
        success: false,
        message: "City ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(cityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid City ID",
      });
    }

    const objectCityId = new mongoose.Types.ObjectId(cityId);

    /**
     * STEP 1: Get products
     */
    const products = await Product.find({
      city: objectCityId,
      isActive: true,
      currentStock: { $gt: 0 },
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        products: [],
      });
    }

    /**
     * STEP 2: Fetch all categories in one go
     */
    const categoryIds = [
      ...new Set(
        products.map((p) => p.category?.toString())
      ),
    ];

    const categories = await Category.find({
      _id: { $in: categoryIds },
    }).select("name isSubscriptionAllowed");

    /**
     * STEP 3: Create map for fast lookup
     */
    const categoryMap = new Map();

    categories.forEach((c) => {
      categoryMap.set(c._id.toString(), c);
    });

    /**
     * STEP 4: Enrich products
     */
    const enrichedProducts = products.map((p) => {
      const category = categoryMap.get(
        p.category?.toString()
      );

      return {
        _id: p._id,

        name: p.name,

        price: p.price,

        discount: p.discount || 0,

        img_url: p.img_url || "",

        stockLimit: p.stockLimit,

        currentStock: p.currentStock,

        city: p.city,

        categoryId: p.category,

        category: category || null,

        isActive: p.isActive,

        isSubscriptionAllowed:
          category?.isSubscriptionAllowed || false,
      };
    });

    return res.json({
      success: true,
      products: enrichedProducts,
    });
  } catch (err) {
    console.log("💥 SERVER ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;
