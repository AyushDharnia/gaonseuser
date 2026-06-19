import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  city: {
    type: mongoose.Schema.ObjectId,
    ref: "City",
    required: true,
  },

  center: {
    lat: Number,
    lng: Number,
  },

  radius: {
    type: Number, // in KM
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

export const Zone = mongoose.model("Zone", zoneSchema);
