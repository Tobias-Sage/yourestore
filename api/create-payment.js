// api/create-payment.js
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS 头
  const allowedOrigin = 'https://yourestore.specialtowinning.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount } = req.body;

    const PAYERA_API_KEY = process.env.PAYERA_API_KEY;
    const PAYERA_SECRET_KEY = process.env.PAYERA_SECRET_KEY;
    const CHECKOUT_ID = process.env.PAYERA_CHECKOUT_ID;

    if (!PAYERA_API_KEY || !PAYERA_SECRET_KEY || !CHECKOUT_ID) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const amountInCents = Math.round(amount * 100);
    const timestamp = new Date().toISOString();
    const requestBody = {
      checkout_id: CHECKOUT_ID,
      amount: amountInCents,
      currency: 'USD',
      customer_email: 'customer@example.com',
      redirect_url: 'https://yourestore.specialtowinning.com/payment-success.html',
      payment_id: `order_${Date.now()}`,
    };

    // 生成签名
    const dataForSign = { ...requestBody, timestamp };
    const keys = Object.keys(dataForSign).sort();
    const signString = keys.map(k => String(dataForSign[k])).join(':') + ':' + PAYERA_SECRET_KEY;
    const signature = crypto.createHash('sha256').update(signString).digest('base64');

    const response = await fetch('https://api.payera.global/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PAYERA_API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Payera error:', data);
      return res.status(500).json({ error: data.message || 'Payment creation failed' });
    }

    return res.status(200).json({ paymentUrl: data.payment_url });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
