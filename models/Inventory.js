import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
{
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  productName: {
    type: String,
    required: true,
    trim: true,
  },

  totalDemand: {
    type: Number,
    default: 0,
    min: 0,
  },

  todayDemand: {
    type: Number,
    default: 0,
    min: 0,
  },

  availableStock: {
    type: Number,
    default: 0,
    min: 0,
  },

  soldToday: {
    type: Number,
    default: 0,
    min: 0,
  },

  reorderLevel: {
    type: Number,
    default: 10,
  },

  unit: {
    type: String,
    default: "pcs", // litre, kg, packet
  },

  lastOrderedAt: {
    type: Date,
    default: null,
  },
},
{ timestamps: true }
);

export const Inventory = mongoose.model("Inventory", inventorySchema);