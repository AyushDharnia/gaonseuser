import crypto from "crypto";
import { Wallet } from "../models/walletModel.js";
import { razorpay } from "../utils/razorpay.js";
import { Payment } from "../models/paymentModel.js";

/* ===================================
   GET WALLET
=================================== */
export const getWallet = async (
  req,
  res
) => {
  try {
    let wallet =
      await Wallet.findOne({
        user: req.user._id,
      });

    if (!wallet) {
      wallet =
        await Wallet.create({
          user: req.user._id,
          balance: 0,
        });
    }

    res.json({
      success: true,
      wallet,
    });
  } catch (error) {
    console.log(
      "GET WALLET ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===================================
   CREATE ORDER
=================================== */
export const createOrder =
  async (req, res) => {
    try {
      const amount = Number(
        req.body.amount
      );

      if (
        !amount ||
        amount < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid amount",
        });
      }

      const order =
        await razorpay.orders.create(
          {
            amount:
              amount * 100,
            currency: "INR",
          }
        );

      await Payment.create({
        user: req.user._id,

        amount,

        razorpayOrderId:
          order.id,

        status:
          "created",
      });

      res.json({
        success: true,

        key:
          process.env
            .RAZORPAY_KEY_ID,

        orderId:
          order.id,

        amount,
      });
    } catch (error) {
      console.log(
        "CREATE ORDER ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/* ===================================
   VERIFY PAYMENT
=================================== */
export const verifyPayment =
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env
              .RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      if (
        generatedSignature !==
        razorpay_signature
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed",
        });
      }

      const payment =
        await Payment.findOne({
          razorpayOrderId:
            razorpay_order_id,
        });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message:
            "Payment not found",
        });
      }

      if (
        payment.status ===
        "paid"
      ) {
        return res.json({
          success: true,
          message:
            "Already processed",
        });
      }

      payment.status = "paid";

      payment.razorpayPaymentId =
        razorpay_payment_id;

      await payment.save();

      let wallet =
        await Wallet.findOne({
          user:
            payment.user,
        });

      if (!wallet) {
        wallet =
          await Wallet.create({
            user:
              payment.user,
            balance: 0,
          });
      }

      wallet.balance =
        Number(
          wallet.balance || 0
        ) +
        Number(
          payment.amount
        );

      wallet.transactions.unshift(
        {
          amount:
            Number(
              payment.amount
            ),

          type:
            "credit",

          date:
            new Date(),
        }
      );

      await wallet.save();

      res.json({
        success: true,
        message:
          "Wallet credited successfully",
      });
    } catch (error) {
      console.log(
        "VERIFY PAYMENT ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };
