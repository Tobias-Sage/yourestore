// api/create-payment.js

export default async function handler(req, res) {
  // 1. 只允许 POST 请求，其他请求返回方法不允许的错误
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 从请求体中解构出需要的参数
  const { amount, currency, orderId, customerEmail } = req.body;

  // 3. 从Vercel环境变量中安全地获取Payera密钥
  const PAYERA_API_KEY = process.env.PAYERA_API_KEY;     // 公钥，以 pk_live_ 开头
  const PAYERA_SECRET_KEY = process.env.PAYERA_SECRET_KEY; // 私钥，以 sk_live_ 开头
  const CHECKOUT_ID = process.env.PAYERA_CHECKOUT_ID;     // 你在Payera后台的结账配置ID

  // 4. 检查密钥是否都已配置，如果没有则返回服务器配置错误
  if (!PAYERA_API_KEY || !PAYERA_SECRET_KEY || !CHECKOUT_ID) {
    console.error('Missing Payera credentials');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 5. 准备请求数据
  // Payera金额单位是分，需要将美元金额乘以100并取整
  const amountInCents = Math.round(amount * 100);
  // 生成当前ISO时间戳
  const timestamp = new Date().toISOString();
  const requestBody = {
    checkout_id: CHECKOUT_ID,
    amount: amountInCents,
    currency: currency || 'USD',
    customer_email: customerEmail || 'customer@example.com',
    redirect_url: 'https://yourestore.specialtowinning.com/payment-success.html',
    payment_id: orderId || `order_${Date.now()}`,
  };

  // 6. 生成签名（这是Payera API的安全要求）
  // 签名生成规则: 将请求体参数按字母排序，用':'连接，再加上':'和你的私钥哈希值，最后进行SHA256哈希和Base64编码
  const dataForSign = { ...requestBody, timestamp };
  const keys = Object.keys(dataForSign).sort();
  const signString = keys.map(k => String(dataForSign[k])).join(':') + ':' + PAYERA_SECRET_KEY;
  const signature = crypto.createHash('sha256').update(signString).digest('base64');

  // 7. 调用Payera API
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

  // 8. 解析Payera返回的数据
  const data = await response.json();

  // 9. 如果调用失败，记录错误并返回失败信息
  if (!response.ok || !data.success) {
    console.error('Payera error:', data);
    return res.status(500).json({ error: data.message || 'Payment creation failed' });
  }

  // 10. 成功：将支付URL返回给前端
  return res.status(200).json({ paymentUrl: data.payment_url });
}
