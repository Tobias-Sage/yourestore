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
    // 生成 RFC3339 时间戳（无毫秒）
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const requestBody = {
      checkout_id: CHECKOUT_ID,
      amount: amountInCents,
      currency: 'USD',
      customer_email: 'customer@example.com',
      redirect_url: 'https://yourestore.specialtowinning.com/payment-success.html',
      payment_id: `order_${Date.now()}`,
    };

    // 1. 计算 secret key 的 SHA256 哈希（小写十六进制）
    const hashedSecret = crypto.createHash('sha256').update(PAYERA_SECRET_KEY).digest('hex');

    // 2. 合并请求体和 timestamp，按键排序
    const dataForSign = { ...requestBody, timestamp };
    const keys = Object.keys(dataForSign).sort();
    // 3. 拼接字符串：值用 : 连接，末尾加上 : + hashedSecret
    const signString = keys.map(k => String(dataForSign[k])).join(':') + ':' + hashedSecret;

    // 4. 对拼接后的字符串进行 SHA256 哈希，然后 Base64 编码
    const signature = crypto.createHash('sha256').update(signString).digest('base64');

    // 调试输出（可选，可在 Vercel 日志中查看）
    console.log('Timestamp:', timestamp);
    console.log('SignString:', signString);
    console.log('Signature:', signature);

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
      return res.status(500).json({ error: data.message || 'Payment creation failed', details: data });
    }

    return res.status(200).json({ paymentUrl: data.payment_url });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
