// server.js
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

let visitorCount = 0;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Visitor counter endpoint
app.get("/api/visitors", (req, res) => {
  visitorCount++;
  res.json({ count: visitorCount });
});

// Generate M-Pesa access token
async function getAccessToken() {
  const auth = Buffer.from(
    process.env.CONSUMER_KEY + ":" + process.env.CONSUMER_SECRET
  ).toString("base64");

  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: "Basic " + auth } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Access Token Error:", error.response?.data || error.message);
    throw new Error("Failed to get access token");
  }
}

// Initiate STK Push payment request
app.post("/api/pay", async (req, res) => {
  try {
    const { phone, amount, orderDetails, name } = req.body;
    if (!phone || !amount || !orderDetails || !name) {
      return res.status(400).json({ error: "Missing required payment info" });
    }

    const token = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(
      process.env.BUSINESS_SHORTCODE + process.env.PASSKEY + timestamp
    ).toString("base64");

    const stkPushPayload = {
      BusinessShortCode: process.env.BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.BUSINESS_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "FoodHub Order",
      TransactionDesc: `Order for ${name}`,
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkPushPayload,
      {
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Handle Daraja payment callback
app.post("/api/callback", async (req, res) => {
  try {
    const callbackData = req.body;

    // Acknowledge callback immediately
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const result = callbackData.Body.stkCallback;
    if (result.ResultCode === 0) {
      // Payment success
      const metadata = result.CallbackMetadata.Item.reduce((acc, item) => {
        acc[item.Name] = item.Value;
        return acc;
      }, {});

      // Compose email content
      const emailText = `
        Payment Successful!

        Amount: KES ${metadata.Amount}
        Receipt: ${metadata.MpesaReceiptNumber}
        Phone: ${metadata.PhoneNumber}
        Transaction Date: ${metadata.TransactionDate}
      `;

      // Send Gmail notification
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `FoodHub <${process.env.EMAIL_USER}>`,
        to: process.env.NOTIFY_EMAIL,
        subject: "New Payment Received - FoodHub",
        text: emailText,
      });

      console.log("Payment notification email sent.");
    } else {
      console.log("Payment failed or canceled:", result.ResultDesc);
    }
  } catch (error) {
    console.error("Callback error:", error);
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
