import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  city: {
    type: mongoose.Schema.ObjectId,
    ref: "City",
    required: true,
  },

  isSubscriptionAllowed: {
    type: Boolean,
    default: false,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

export const Category = mongoose.model("Category", categorySchema);