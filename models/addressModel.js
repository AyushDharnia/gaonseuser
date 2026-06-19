import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.ObjectId, ref: "User" },
  zone: { type: mongoose.Schema.ObjectId, ref: "Zone" },

  addressLine: String,
  landmark: String,

  latitude: Number,
  longitude: Number,
});

export const Address = mongoose.model("Address", addressSchema);