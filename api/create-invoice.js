// api/create-invoice.js

export default async function handler(req, res) {
  // 设置 CORS 头，允许跨域请求（你的前端在 specialtowinning.com）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理浏览器预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 从环境变量读取 TwinPay 密钥（在 Vercel 项目中配置）
  const CLIENT_ID = process.env.TWINPAY_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWINPAY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing TwinPay credentials');
    return res.status(500).json({ error: 'Server configuration error: missing TwinPay credentials' });
  }

  const { amount, productName } = req.body;

  // 金额单位转换：TwinPay 要求以“美分”为单位（例如 39.90 美元 → 3990 美分）
  const amountInCents = Math.round(amount * 100);

  // 构造 TwinPay 请求体（按照 Postman Collection 中的正确格式）
  const twinpayPayload = {
    amount: amountInCents,
    currency: 'USD',
    card_to_crypto_option: 'kryptonim',   // 重要！必须使用这个方法
    callback_url: `https://${req.headers.host}/api/twinpay-callback`,
  };

  console.log('Calling TwinPay with payload:', twinpayPayload);

  try {
    const twinpayResponse = await fetch('https://lk.twinpay.cloud/api/v2/h2h/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Client-Id': CLIENT_ID,
        'Client-Secret': CLIENT_SECRET,
      },
      body: JSON.stringify(twinpayPayload),
    });

    const responseText = await twinpayResponse.text();
    console.log('TwinPay raw response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse TwinPay response as JSON');
      return res.status(500).json({
        error: 'TwinPay returned invalid response',
        raw: responseText.substring(0, 200),
      });
    }

    if (!twinpayResponse.ok) {
      console.error('TwinPay error response:', data);
      return res.status(500).json({
        error: `TwinPay API error: ${JSON.stringify(data)}`,
      });
    }

    // 根据 TwinPay 实际返回的字段提取支付链接（常见为 payment_url 或 redirect_url）
    if (data.payment_url) {
      return res.status(200).json({ paymentUrl: data.payment_url });
    } else if (data.redirect_url) {
      return res.status(200).json({ paymentUrl: data.redirect_url });
    } else if (data.id) {
      // 如果只返回了 invoice id，尝试构造支付链接（请根据 TwinPay 文档确认格式）
      return res.status(200).json({ paymentUrl: `https://lk.twinpay.cloud/pay/${data.id}` });
    } else {
      return res.status(500).json({
        error: 'TwinPay response missing payment URL',
        response: data,
      });
    }
  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({
      error: 'Internal server error: ' + error.message,
    });
  }
}
