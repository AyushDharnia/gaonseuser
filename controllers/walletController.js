import crypto from "crypto";
import axios from "axios";
import { Wallet } from "../models/walletModel.js";
import { Payment } from "../models/paymentModel.js";

/* ===================================
   GET WALLET
=================================== */
export const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id, balance: 0 });
    }
    res.json({ success: true, wallet });
  } catch (error) {
    console.log("GET WALLET ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================================
   CREATE ORDER (PhonePe)
=================================== */
export const createOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const merchantTransactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
    const saltKey = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const env = process.env.PHONEPE_ENV || 'UAT';

    const baseUrl = env === 'PROD' 
      ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';

    const payload = {
      merchantId: merchantId,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: req.user._id.toString(),
      amount: amount * 100, // in paise
      redirectUrl: 'https://success.phonepe/',
      redirectMode: 'REDIRECT',
      callbackUrl: 'https://success.phonepe/', // Optional S2S callback
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256 + '###' + saltIndex;

    const options = {
      method: 'POST',
      url: baseUrl,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      data: {
        request: base64Payload
      }
    };

    const response = await axios(options);

    if (response.data.success) {
      await Payment.create({
        user: req.user._id,
        amount,
        transactionId: merchantTransactionId,
        status: "created",
      });

      res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        transactionId: merchantTransactionId,
        amount,
      });
    } else {
      throw new Error(response.data.message || 'Error creating PhonePe order');
    }

  } catch (error) {
    console.log("CREATE ORDER ERROR:", error?.response?.data || error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================================
   VERIFY PAYMENT (PhonePe)
=================================== */
export const verifyPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: "transactionId is required" });
    }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "paid") {
      return res.json({ success: true, message: "Already processed" });
    }

    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
    const saltKey = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const env = process.env.PHONEPE_ENV || 'UAT';

    const baseUrl = env === 'PROD'
      ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${transactionId}`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${transactionId}`;

    const stringToHash = `/pg/v1/status/${merchantId}/${transactionId}` + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256 + '###' + saltIndex;

    const options = {
      method: 'GET',
      url: baseUrl,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId
      }
    };

    const response = await axios(options);

    if (response.data.success && response.data.code === 'PAYMENT_SUCCESS') {
      payment.status = "paid";
      await payment.save();

      let wallet = await Wallet.findOne({ user: payment.user });
      if (!wallet) {
        wallet = await Wallet.create({ user: payment.user, balance: 0 });
      }

      wallet.balance = Number(wallet.balance || 0) + Number(payment.amount);
      wallet.transactions.unshift({
        amount: Number(payment.amount),
        type: "credit",
        date: new Date(),
      });

      await wallet.save();

      res.json({ success: true, message: "Wallet credited successfully" });
    } else {
      res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.log("VERIFY PAYMENT ERROR:", error?.response?.data || error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================================
   WEBHOOK (PhonePe)
=================================== */
export const phonepeWebhook = async (req, res) => {
  try {
    let transactionId = null;

    // Handle different PhonePe Webhook payload formats
    if (req.body.response) {
      // Base64 encoded payload
      const decodedResponse = Buffer.from(req.body.response, "base64").toString("utf-8");
      const parsedData = JSON.parse(decodedResponse);
      transactionId = parsedData?.data?.merchantTransactionId;
    } else if (req.body.data && req.body.data.merchantTransactionId) {
      // Direct JSON payload
      transactionId = req.body.data.merchantTransactionId;
    } else if (req.body.merchantTransactionId) {
      // Flat JSON payload
      transactionId = req.body.merchantTransactionId;
    }

    if (!transactionId) {
      return res.status(400).send("Invalid payload");
    }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    if (payment.status === "paid") {
      return res.status(200).send("Already processed");
    }

    // Securely Verify Status directly with PhonePe
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const env = process.env.PHONEPE_ENV || 'UAT';

    const baseUrl = env === 'PROD'
      ? `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${transactionId}`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${transactionId}`;

    const stringToHash = `/pg/v1/status/${merchantId}/${transactionId}` + saltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256 + '###' + saltIndex;

    const options = {
      method: 'GET',
      url: baseUrl,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId
      }
    };

    const statusResponse = await axios(options);

    if (statusResponse.data.success && statusResponse.data.code === 'PAYMENT_SUCCESS') {
      payment.status = "paid";
      await payment.save();

      let wallet = await Wallet.findOne({ user: payment.user });
      if (!wallet) {
        wallet = await Wallet.create({ user: payment.user, balance: 0 });
      }

      wallet.balance = Number(wallet.balance || 0) + Number(payment.amount);
      wallet.transactions.unshift({
        amount: Number(payment.amount),
        type: "credit",
        date: new Date(),
      });

      await wallet.save();
    }

    // Always return 200 OK to PhonePe so they stop retrying the webhook
    res.status(200).send("OK");
  } catch (error) {
    console.log("WEBHOOK ERROR:", error?.message);
    // If our server crashed, return 500 so PhonePe retries later
    res.status(500).send("Webhook Error");
  }
};
