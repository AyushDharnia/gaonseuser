import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },

    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      default: function () {
        return `Subscription - ${this.type}`;
      },
    },

    type: {
      type: String,
      enum: ["days", "dates"],
      required: true,
    },

    /* ---------------------------------- */
    /* 📅 DAYS */
    /* ---------------------------------- */
    days: [
      {
        type: String,
        enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      },
    ],

    /* ---------------------------------- */
    /* 📆 DATES */
    /* ---------------------------------- */
    dates: [
      {
        type: Number,
        min: 1,
        max: 31,
      },
    ],

    /* ---------------------------------- */
    /* 🌅 DELIVERY TIME */
    /* ---------------------------------- */
    deliveryTime: {
      type: String,
      enum: ["morning", "evening"],
      default: "morning",
    },

    /* ---------------------------------- */
    /* 🥛 QUANTITY */
    /* ---------------------------------- */
    quantity: {
      type: Number,
      default: 1,
    },

    /* ---------------------------------- */
    /* 📍 ADDRESS */
    /* ---------------------------------- */
    address: {
      city: Object,
      zone: Object,
      text: String,

      latitude: Number,
      longitude: Number,
    },

    /* ---------------------------------- */
    /* 🔄 STATUS */
    /* ---------------------------------- */
    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
    },

    /* ---------------------------------- */
    /* 📅 START DATE */
    /* ---------------------------------- */
    startDate: {
      type: Date,
      default: Date.now,
    },

    /* ---------------------------------- */
    /* 🛑 END DATE */
    /* ---------------------------------- */
    endDate: Date,

    /* ---------------------------------- */
    /* 🗑️ SOFT DELETE */
    /* ---------------------------------- */
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* ---------------------------------- */
/* 🔥 CUSTOM VALIDATION */
/* ---------------------------------- */
subscriptionSchema.pre("validate", function (next) {

  if (
    this.type === "days" &&
    (!this.days || this.days.length === 0)
  ) {
    return next(new Error("Please select days"));
  }

  if (
    this.type === "dates" &&
    (!this.dates || this.dates.length === 0)
  ) {
    return next(new Error("Please select dates"));
  }

  next();
});

export const Subscription = mongoose.model(
  "Subscription",
  subscriptionSchema
);
