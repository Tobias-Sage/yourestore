// api/create-payment.js
import crypto from 'crypto';

// 递归排序对象的所有键（用于签名）
function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
}

// 将任意值转为字符串（用于签名拼接）
function stringifyValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // 嵌套对象：先排序键，再转为无空格 JSON 字符串
    const sorted = sortObjectKeys(value);
    return JSON.stringify(sorted);
  }
  return value.toString();
}

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
    const { amount, productName, clickId } = req.body;

    const PAYERA_API_KEY = process.env.PAYERA_API_KEY;
    const PAYERA_SECRET_KEY = process.env.PAYERA_SECRET_KEY;
    const CHECKOUT_ID = process.env.PAYERA_CHECKOUT_ID;

    if (!PAYERA_API_KEY || !PAYERA_SECRET_KEY || !CHECKOUT_ID) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const amountInCents = Math.round(amount * 100);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); // RFC3339

    // 请求体（注意 metadata 内部也需要后续排序）
    const requestBody = {
      checkout_id: CHECKOUT_ID,
      amount: amountInCents,
      currency: 'USD',
      customer_email: 'customer@example.com',
      redirect_url: 'https://yourestore.specialtowinning.com/payment-success.html',
      payment_id: `order_${Date.now()}`,
      metadata: {
        click_id: clickId || null
      }
    };

    // 1. 计算 secret key 的 SHA256 哈希（小写十六进制）
    const hashedSecret = crypto.createHash('sha256').update(PAYERA_SECRET_KEY).digest('hex');

    // 2. 构建签名数据：先复制请求体并加入 timestamp，然后递归排序所有键
    const dataForSign = { ...requestBody, timestamp };
    const sortedData = sortObjectKeys(dataForSign);

    // 3. 提取排序后的所有键（按字母顺序）
    const keys = Object.keys(sortedData).sort();

    // 4. 将每个键对应的值转为字符串，用冒号连接
    const signParts = keys.map(key => stringifyValue(sortedData[key]));
    const signString = signParts.join(':') + ':' + hashedSecret;

    // 5. 计算最终签名：SHA256 → Base64
    const signature = crypto.createHash('sha256').update(signString).digest('base64');

    // 调试日志（可选，部署后可删除）
    console.log('Timestamp:', timestamp);
    console.log('SignParts:', signParts);
    console.log('Signature:', signature);

    const response = await fetch('https://api.payera.global/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PAYERA_API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: JSON.stringify(requestBody),  // body 保持原始格式（不需要额外排序）
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
