import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    items: [
      {
        _id: String,
        name: String,
        price: Number,
        qty: Number,
      },
    ],

    address: {
      city: Object,
      zone: Object,
      text: String,
      latitude: Number,
      longitude: Number,
    },

    total: Number,
    earning: {
      type: Number,
      default: 0,
    },

    type: {
      type: String,
      enum: ["cart", "subscription", "normal", "suborder"],
      default: "normal",
    },

    deliveryTime: {
      type: String,
      enum: ["morning", "evening"],
      default: "morning",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "expired",
      ],
      default: "pending",
    },

    otp: Number,
    otpExpire: Date,

    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      default: null,
    },
    deliveredAt: Date,
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    date: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { timestamps: true }
);

orderSchema.index({ "address.zone._id": 1, status: 1, deliveredBy: 1 });
orderSchema.index({ deliveredBy: 1, status: 1 });

export const Order = mongoose.model("Order", orderSchema);
