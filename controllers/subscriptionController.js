import { Subscription } from "../models/subscriptionModel.js";
import { Product } from "../models/productModel.js";
import { Wallet } from "../models/walletModel.js";

// ---------------- CREATE ----------------
export const createSubscription = async (req, res) => {
  try {

    const {
      product,
      type,
      days,
      dates,
      quantity,
      address,
      name,

      /* 🌅 NEW */
      deliveryTime,

    } = req.body;

    // 🔴 BASIC VALIDATION
    if (!product || !type) {
      return res.status(400).json({
        message: "Product and type are required",
      });
    }

    // 🔴 ADDRESS VALIDATION
    // 🔴 ADDRESS VALIDATION
if (
  !address ||
  !address.text ||
  !address.zone ||
  !address.city ||
  address.latitude == null ||
address.longitude == null
) {
  return res.status(400).json({
    message:
      "Valid delivery address with location is required",
  });
}

    // 🌅 DELIVERY TIME VALIDATION
    if (
      !deliveryTime ||
      !["morning", "evening"].includes(deliveryTime)
    ) {
      return res.status(400).json({
        message: "Please select delivery time",
      });
    }

    // 🔁 TYPE VALIDATION
    if (
      type === "days" &&
      (!days || days.length === 0)
    ) {
      return res.status(400).json({
        message: "Please select at least one day",
      });
    }

    if (
      type === "dates" &&
      (!dates || dates.length === 0)
    ) {
      return res.status(400).json({
        message: "Please select at least one date",
      });
    }

    // 🔴 RESTRICT DUPLICATE ACTIVE SUBSCRIPTION
    const existingSubscription = await Subscription.findOne({
      user: req.user._id,
      product,
      deliveryTime,
      status: "active",
      isDeleted: false,
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription for this product with the same delivery time. Please modify your existing subscription instead.",
      });
    }

    // 🪙 WALLET BALANCE VALIDATION
    const prod = await Product.findById(product);
    if (!prod) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found",
      });
    }

    const reqBalance = (prod.price || 0) * (quantity || 1);
    if (wallet.balance < reqBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. You need at least ₹${reqBalance.toFixed(2)} to subscribe to this product.`,
      });
    }

    const subscription = await Subscription.create({

      user: req.user._id,

      product,

      type,

      days: type === "days" ? days : [],

      dates: type === "dates" ? dates : [],

      quantity: quantity || 1,

      /* 🌅 SAVE DELIVERY TIME */
      deliveryTime,

      address,

      name: name || "My Subscription",

      startDate: new Date(),

    });

    res.status(201).json({
      success: true,
      subscription,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};

// ---------------- GET MY SUBSCRIPTIONS ----------------
export const getMySubscriptions = async (req, res) => {
  try {

    const subs = await Subscription.find({
      user: req.user._id,
      isDeleted: false,
    })
      .populate("product")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      subscriptions: subs,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};

// ---------------- GET SINGLE ----------------
export const getSingleSubscription = async (req, res) => {
  try {

    const sub = await Subscription.findById(req.params.id)
      .populate("product");

    if (!sub || sub.isDeleted) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    if (
      sub.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    res.json({
      success: true,
      subscription: sub,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};

// ---------------- UPDATE ----------------
export const updateSubscription = async (req, res) => {
  try {

    const sub = await Subscription.findById(req.params.id);

    if (!sub || sub.isDeleted) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    if (
      sub.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    const {
  type,
  days,
  dates,
  deliveryTime,
  address,
} = req.body;

    // 🌅 VALIDATE DELIVERY TIME
    if (
      deliveryTime &&
      !["morning", "evening"].includes(deliveryTime)
    ) {
      return res.status(400).json({
        message: "Invalid delivery time",
      });
    }

    // 📍 ADDRESS VALIDATION
if (address) {
  if (
    !address.text ||
    !address.zone ||
    !address.city ||
    address.latitude == null ||
address.longitude == null
  ) {
    return res.status(400).json({
      message:
        "Invalid delivery address",
    });
  }
}

    // 🔁 VALIDATE TYPE CHANGE
    if (type) {

      if (
        type === "days" &&
        (!days || days.length === 0)
      ) {
        return res.status(400).json({
          message: "Please select at least one day",
        });
      }

      if (
        type === "dates" &&
        (!dates || dates.length === 0)
      ) {
        return res.status(400).json({
          message: "Please select at least one date",
        });
      }
    }

    // 🔴 RESTRICT DUPLICATE ACTIVE SUBSCRIPTION ON UPDATE
    const targetStatus = req.body.status || sub.status;
    const targetDeliveryTime = deliveryTime || sub.deliveryTime;
    const targetProduct = req.body.product || sub.product;

    if (targetStatus === "active") {
      const existingSubscription = await Subscription.findOne({
        user: req.user._id,
        product: targetProduct,
        deliveryTime: targetDeliveryTime,
        status: "active",
        isDeleted: false,
        _id: { $ne: sub._id },
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: "You already have another active subscription for this product with the same delivery time.",
        });
      }
    }

    const updated = await Subscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({
      success: true,
      subscription: updated,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};

// ---------------- DELETE (SOFT DELETE) ----------------
export const deleteSubscription = async (req, res) => {
  try {

    const sub = await Subscription.findById(req.params.id);

    if (!sub || sub.isDeleted) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    if (
      sub.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    sub.isDeleted = true;

    await sub.save();

    res.json({
      success: true,
      message: "Subscription deleted",
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};

// ---------------- PAUSE / RESUME ----------------
export const toggleSubscriptionStatus = async (req, res) => {
  try {

    const sub = await Subscription.findById(req.params.id);

    if (!sub || sub.isDeleted) {
      return res.status(404).json({
        message: "Subscription not found",
      });
    }

    if (
      sub.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    if (sub.status === "paused") {
      const existingSubscription = await Subscription.findOne({
        user: req.user._id,
        product: sub.product,
        deliveryTime: sub.deliveryTime,
        status: "active",
        isDeleted: false,
        _id: { $ne: sub._id }
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: "You already have another active subscription for this product with the same delivery time. Cannot resume this subscription.",
        });
      }
    }

    sub.status =
      sub.status === "active"
        ? "paused"
        : "active";

    await sub.save();

    res.json({
      success: true,
      subscription: sub,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });

  }
};
