import mongoose from "mongoose";

const paymentSchema =
  new mongoose.Schema(
    {
      user: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      amount: {
        type: Number,
        required: true,
      },

      transactionId: {
        type: String,
        required: true,
        unique: true,
      },

      status: {
        type: String,
        enum: [
          "created",
          "paid",
          "failed",
        ],
        default: "created",
      },
    },
    { timestamps: true }
  );

export const Payment =
  mongoose.model(
    "Payment",
    paymentSchema
  );
