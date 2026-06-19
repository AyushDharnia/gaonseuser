import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.ObjectId, ref: "User" },
  balance: { type: Number, default: 0 },
  transactions: [
    {
      amount: Number,
      type: { type: String },
      date: Date,
    },
  ],
});

export const Wallet = mongoose.model("Wallet", walletSchema);