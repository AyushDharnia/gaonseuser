import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

export const City = mongoose.model("City", citySchema);
