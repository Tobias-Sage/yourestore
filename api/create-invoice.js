// api/create-invoice.js

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 获取环境变量
  const CLIENT_ID = process.env.TWINPAY_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWINPAY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing TwinPay credentials in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error: missing TwinPay credentials' 
    });
  }

  const { amount, productName } = req.body;

  // 根据 TwinPay Postman 示例调整请求参数
  // 注意：示例中 amount: 512 可能是 5.12 美元？这里保持传入的美元金额，不乘以100
  // 具体单位请向 TwinPay 确认。如果 TwinPay 要求整数美分，则改为 Math.round(amount * 100)
  const twinpayPayload = {
    amount: amount,          // 直接使用传入的金额（如 39.90）
    currency: 'USD',
    card_to_crypto_option: 'kryptonim',  // 从 Postman 示例中看到的
    callback_url: `https://${req.headers.host}/api/twinpay-callback`,
  };

  console.log('Calling TwinPay with payload:', twinpayPayload);

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
    console.log('TwinPay raw response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse TwinPay response as JSON');
      return res.status(500).json({ 
        error: 'TwinPay returned invalid response', 
        raw: responseText.substring(0, 200) 
      });
    }

    if (!twinpayResponse.ok) {
      console.error('TwinPay error response:', data);
      return res.status(500).json({ 
        error: `TwinPay API error: ${JSON.stringify(data)}` 
      });
    }

    // 根据实际返回调整字段名（常见可能是 payment_url 或 redirect_url）
    if (data.payment_url) {
      return res.status(200).json({ paymentUrl: data.payment_url });
    } else if (data.redirect_url) {
      return res.status(200).json({ paymentUrl: data.redirect_url });
    } else if (data.id) {
      // 如果返回的是 invoice id，尝试构造支付链接（需要确认 TwinPay 的支付页面格式）
      return res.status(200).json({ paymentUrl: `https://lk.twinpay.cloud/pay/${data.id}` });
    } else {
      return res.status(500).json({ 
        error: 'TwinPay response missing payment URL', 
        response: data 
      });
    }
  } catch (error) {
    console.error('Internal server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error: ' + error.message 
    });
  }
}
