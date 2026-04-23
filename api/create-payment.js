// api/create-payment.js

export default async function handler(req, res) {
  // ========== 1. 手动设置 CORS 响应头（解决跨域问题） ==========
  const allowedOrigin = 'https://yourestore.specialtowinning.com'; // 你的前端域名
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理浏览器预检请求（OPTIONS）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // ========================================================

  // 2. 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, productName, clickId } = req.body;

  // 3. 从环境变量读取 Payera 密钥
  const PAYERA_API_KEY = process.env.PAYERA_API_KEY;
  const PAYERA_SECRET_KEY = process.env.PAYERA_SECRET_KEY;
  const CHECKOUT_ID = process.env.PAYERA_CHECKOUT_ID;

  if (!PAYERA_API_KEY || !PAYERA_SECRET_KEY || !CHECKOUT_ID) {
    console.error('Missing Payera credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. 准备请求 Payera 的数据
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

  // 5. 生成签名（请根据 Payera 文档确认算法，如有误请修改）
  const dataForSign = { ...requestBody, timestamp };
  const keys = Object.keys(dataForSign).sort();
  const signString = keys.map(k => String(dataForSign[k])).join(':') + ':' + PAYERA_SECRET_KEY;
  const signature = crypto.createHash('sha256').update(signString).digest('base64');

  // 6. 调用 Payera API
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

  // 7. 处理 Payera 响应
  if (!response.ok || !data.success) {
    console.error('Payera error:', data);
    return res.status(500).json({ error: data.message || 'Payment creation failed' });
  }

  // 8. 返回支付链接给前端
  return res.status(200).json({ paymentUrl: data.payment_url });
}
