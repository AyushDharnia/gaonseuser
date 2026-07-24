import axios from "axios";
import qs from "qs";
import { Wallet } from "../models/walletModel.js";
import { Payment } from "../models/paymentModel.js";

// ===================================
// HELPER: GET PHONEPE OAUTH TOKEN
// ===================================
const getPhonePeToken = async () => {
  const env = process.env.PHONEPE_ENV || 'UAT';
  const url = env === 'PROD' 
    ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

  const data = qs.stringify({
    client_id: process.env.PHONEPE_CLIENT_ID,
    client_secret: process.env.PHONEPE_CLIENT_SECRET,
    client_version: process.env.PHONEPE_CLIENT_VERSION || '1',
    grant_type: 'client_credentials'
  });

  const response = await axios.post(url, data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  return response.data.access_token;
};

// ===================================
// GET WALLET
// ===================================
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

// ===================================
// CREATE ORDER (PhonePe V2)
// ===================================
export const createOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 1) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const merchantOrderId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    
    // Get V2 Auth Token
    const accessToken = await getPhonePeToken();

    const env = process.env.PHONEPE_ENV || 'UAT';
    const baseUrl = env === 'PROD' 
      ? 'https://api.phonepe.com/apis/pg/checkout/v2/pay'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay';

    const payload = {
      merchantOrderId: merchantOrderId,
      amount: amount * 100, // in paise
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: 'Wallet Topup',
        merchantUrls: {
          redirectUrl: `https://gaonse.in/payment-success?id=${merchantOrderId}` // Default redirect to website root if no deep link
        }
      }
    };

    // Note: The V2 API does not require merchantId in the payload root in the same way, 
    // but some implementations require it inside a metaInfo or it's just tracked by the token.
    // The official V2 payload only requires merchantOrderId, amount, paymentFlow.

    const options = {
      method: 'POST',
      url: baseUrl,
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CALLBACK-URL': 'https://api.gaonse.in/api/v1/wallet/webhook'
      },
      data: payload
    };

    console.log("CREATE ORDER PAYLOAD:", JSON.stringify(payload, null, 2));

    const response = await axios(options);
    
    console.log("CREATE ORDER RESPONSE DATA:\n", JSON.stringify(response.data, null, 2));

    // Save payment record to DB
    await Payment.create({
      user: req.user._id,
      amount,
      transactionId: merchantOrderId,
      status: "created",
    });

    // The redirect URL is typically located in response.data.redirectUrl
    const redirectUrl = response.data.redirectUrl || response.data?.instrumentResponse?.redirectInfo?.url;

    if (redirectUrl) {
      res.json({
        success: true,
        redirectUrl: redirectUrl,
        transactionId: merchantOrderId
      });
    } else {
      res.status(500).json({ success: false, message: "Failed to generate payment link" });
    }
  } catch (error) {
    console.log("CREATE ORDER ERROR STATUS:", error?.response?.status);
    console.log("CREATE ORDER ERROR HEADERS:", error?.response?.headers);
    console.log("CREATE ORDER ERROR DATA:", error?.response?.data);
    console.log("CREATE ORDER REQUEST URL:", error?.config?.url);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

// ===================================
// VERIFY PAYMENT (PhonePe V2)
// ===================================
export const verifyPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ success: false, message: "Transaction ID is required" });
    }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // If already processed
    if (payment.status === "completed") {
      return res.json({ success: true, message: "Payment already verified", payment });
    }
    if (payment.status === "failed") {
      return res.json({ success: false, message: "Payment was failed", payment });
    }

    // Get V2 Auth Token
    const accessToken = await getPhonePeToken();

    const env = process.env.PHONEPE_ENV || 'UAT';
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    
    // Status Check API V2 URL
    const baseUrl = env === 'PROD'
      ? `https://api.phonepe.com/apis/pg/checkout/v2/order/${transactionId}/status`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${transactionId}/status`;

    const options = {
      method: 'GET',
      url: baseUrl,
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios(options);
    
    // V2 status response typically has state 'COMPLETED', 'FAILED', 'PENDING'
    const status = response.data.state || response.data.status; 

    if (status === 'COMPLETED' || status === 'PAYMENT_SUCCESS') {
      payment.status = "completed";
      payment.paymentId = response.data.transactionId || transactionId;
      await payment.save();

      // Update wallet
      let wallet = await Wallet.findOne({ user: payment.user });
      if (!wallet) {
        wallet = await Wallet.create({ user: payment.user, balance: 0 });
      }
      wallet.balance += payment.amount;
      wallet.transactions.push({
        type: "credit",
        amount: payment.amount,
        description: "Wallet Top-up via PhonePe",
        date: new Date()
      });
      await wallet.save();

      return res.json({ success: true, message: "Payment verified successfully", payment });
    } else if (status === 'FAILED' || status === 'PAYMENT_ERROR') {
      payment.status = "failed";
      await payment.save();
      return res.json({ success: false, message: "Payment failed", payment });
    } else {
      return res.json({ success: false, message: `Payment status is ${status}`, payment });
    }
  } catch (error) {
    console.log("VERIFY PAYMENT ERROR STATUS:", error?.response?.status);
    console.log("VERIFY PAYMENT ERROR HEADERS:", error?.response?.headers);
    console.log("VERIFY PAYMENT ERROR DATA:", error?.response?.data);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

// ===================================
// PHONEPE WEBHOOK (V2)
// ===================================
export const phonepeWebhook = async (req, res) => {
  try {
    // PhonePe V2 webhook payload is typically a JSON body
    const payload = req.body;
    
    console.log("WEBHOOK RECEIVED PAYLOAD:\n", JSON.stringify(payload, null, 2));
    
    // Acknowledge receipt immediately
    res.status(200).send("OK");
    
    // Webhook often contains merchantOrderId in payload body
    let transactionId;
    if (payload && payload.payload && payload.payload.merchantOrderId) {
      transactionId = payload.payload.merchantOrderId;
    } else if (payload && payload.merchantOrderId) {
      transactionId = payload.merchantOrderId;
    }
    
    if (!transactionId) {
      console.log("Invalid webhook payload structure, no transaction ID found");
      return;
    }

    // Check payment status locally
    const payment = await Payment.findOne({ transactionId });
    if (!payment || payment.status === 'completed' || payment.status === 'failed') {
      // Already processed or not found
      return;
    }

    // Call verifyPayment directly using our secure Server-to-Server flow to ensure the webhook isn't spoofed
    // This is safer than relying solely on webhook HMAC signatures
    
    const accessToken = await getPhonePeToken();
    const env = process.env.PHONEPE_ENV || 'UAT';
    const baseUrl = env === 'PROD'
      ? `https://api.phonepe.com/apis/pg/checkout/v2/order/${transactionId}/status`
      : `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${transactionId}/status`;

    const options = {
      method: 'GET',
      url: baseUrl,
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios(options);
    const status = response.data.state || response.data.status;

    if (status === 'COMPLETED' || status === 'PAYMENT_SUCCESS') {
      payment.status = "completed";
      payment.paymentId = response.data.transactionId || transactionId;
      await payment.save();

      let wallet = await Wallet.findOne({ user: payment.user });
      if (!wallet) {
        wallet = await Wallet.create({ user: payment.user, balance: 0 });
      }
      wallet.balance += payment.amount;
      wallet.transactions.push({
        type: "credit",
        amount: payment.amount,
        description: "Wallet Top-up via PhonePe (Webhook)",
        date: new Date()
      });
      await wallet.save();
      console.log(`Payment ${transactionId} verified successfully via webhook`);
    } else if (status === 'FAILED' || status === 'PAYMENT_ERROR') {
      payment.status = "failed";
      await payment.save();
      console.log(`Payment ${transactionId} marked as failed via webhook`);
    }
  } catch (error) {
    console.log("WEBHOOK ERROR (V2):", error?.response?.data || error.message);
  }
};
