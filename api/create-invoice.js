// api/create-invoice.js
export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, productName } = req.body;

  // 验证金额
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // 1. 准备请求 TwinPay 的数据
  const twinpayPayload = {
    amount: Math.round(amount * 100), // 转换成美分（如果 TwinPay 要求整数美分，示例中 amount=512 表示 $5.12？具体看文档）
    currency: 'USD',                   // 根据你的业务需要修改
    card_to_crypto_option: 'kryptonim', // 从 Postman 示例中看到的，如果你不需要加密货币支付可以删掉或修改
    callback_url: `https://${req.headers.host}/api/twinpay-callback`, // 回调地址指向另一个函数
  };

  // 2. 调用 TwinPay 创建 invoice
  const response = await fetch('https://lk.twinpay.cloud/api/v2/h2h/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.TWINPAY_CLIENT_ID,
      'Client-Secret': process.env.TWINPAY_CLIENT_SECRET,
    },
    body: JSON.stringify(twinpayPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('TwinPay error:', data);
    return res.status(500).json({ error: 'Failed to create invoice' });
  }

  // 3. 返回支付链接（假设 TwinPay 返回的 invoice 对象中包含 payment_url 或类似字段）
  // 具体字段名请根据实际返回的 API 响应调整。文档没有给出响应示例，你需要先测试。
  // 常见格式：{ id: "xxx", payment_url: "https://..." }
  if (data.payment_url) {
    return res.status(200).json({ paymentUrl: data.payment_url });
  } else {
    // 如果返回的是 invoice id，可以构造支付页面链接，或让用户跳转到 TwinPay 的通用支付页面
    // 需要查阅文档确认
    return res.status(200).json({ invoiceId: data.id, paymentUrl: `https://lk.twinpay.cloud/pay/${data.id}` });
  }
}
