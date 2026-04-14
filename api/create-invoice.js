// api/create-invoice.js

export default async function handler(req, res) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 读取环境变量（请确保在 Vercel 中已配置）
  const CLIENT_ID = process.env.TWINPAY_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWINPAY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing TwinPay credentials');
    return res.status(500).json({ error: 'Missing TwinPay credentials' });
  }

  const { amount, productName } = req.body;

  // 将金额转换为美分（整数）
  const amountInCents = Math.round(amount * 100);

  // 构建请求参数（参考 Postman 示例和文档）
  const twinpayPayload = {
    amount: amountInCents,          // 整数美分，例如 3990
    currency: 'USD',
    card_to_crypto_option: 'kryptonim',  // 来自 Postman
    payment_option: 'TO_CARD',           // 来自文档，可选
    callback_url: `https://${req.headers.host}/api/twinpay-callback`,
  };

  console.log('Calling TwinPay with:', JSON.stringify(twinpayPayload));

  try {
    const twinpayResponse = await fetch('https://lk.twinpay.cloud/api/v2/h2h/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': CLIENT_ID,
        'Client-Secret': CLIENT_SECRET,
      },
      body: JSON.stringify(twinpayPayload),
    });

    const responseText = await twinpayResponse.text();
    console.log('TwinPay response status:', twinpayResponse.status);
    console.log('TwinPay response body:', responseText.substring(0, 500));

    // 如果响应不是 JSON，返回错误
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({
        error: 'TwinPay returned non-JSON response',
        raw: responseText.substring(0, 200),
      });
    }

    if (!twinpayResponse.ok) {
      return res.status(500).json({
        error: `TwinPay API error: ${JSON.stringify(data)}`,
      });
    }

    // 尝试获取支付链接（根据实际返回调整）
    const paymentUrl = data.payment_url || data.redirect_url || (data.id ? `https://lk.twinpay.cloud/pay/${data.id}` : null);
    if (paymentUrl) {
      return res.status(200).json({ paymentUrl });
    } else {
      return res.status(500).json({
        error: 'No payment URL in TwinPay response',
        response: data,
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
