// server.js
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ====== MIDDLEWARE ======
app.use(cors());
app.use(bodyParser.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html from /public
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== VISITOR COUNTER ======
let visitorCount = 0;
app.get("/api/visitors", (req, res) => {
  visitorCount++;
  res.json({ count: visitorCount });
});

// ====== M-PESA TOKEN GENERATOR ======
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Access Token Error:", error.response?.data || error.message);
    throw new Error("Failed to get access token");
  }
}

// ====== DARAJA STK PUSH ======
app.post("/api/pay", async (req, res) => {
  try {
    const { phone, amount, orderDetails, name } = req.body;
    if (!phone || !amount || !orderDetails || !name) {
      return res.status(400).json({ error: "Missing required payment info" });
    }

    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

    const password = Buffer.from(
      `${process.env.BUSINESS_SHORTCODE}${process.env.PASSKEY}${timestamp}`
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
          Authorization: `Bearer ${token}`,
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

// ====== CALLBACK FOR M-PESA ======
app.post("/api/callback", async (req, res) => {
  try {
    const callbackData = req.body;

    // Acknowledge Safaricom
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const result = callbackData.Body?.stkCallback;
    if (result?.ResultCode === 0) {
      const metadata = result.CallbackMetadata.Item.reduce((acc, item) => {
        acc[item.Name] = item.Value;
        return acc;
      }, {});

      const emailText = `
        Payment Successful!

        Amount: KES ${metadata.Amount}
        Receipt: ${metadata.MpesaReceiptNumber}
        Phone: ${metadata.PhoneNumber}
        Transaction Date: ${metadata.TransactionDate}
      `;

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

      console.log("📧 Payment notification email sent.");
    } else {
      console.log("❌ Payment failed/canceled:", result?.ResultDesc);
    }
  } catch (error) {
    console.error("Callback Error:", error);
  }
});

// ====== FALLBACK FOR 404s ======
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ====== GLOBAL ERROR HANDLER ======
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Server error" });
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
