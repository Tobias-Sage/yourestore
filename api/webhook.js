// api/webhook.js
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // 必须禁用，以便获取原始请求体用于签名验证
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 读取原始请求体
  const buffers = [];
  for await (const chunk of req) {
    buffers.push(chunk);
  }
  const rawBody = Buffer.concat(buffers).toString();

  const signature = req.headers['x-payera-signature'];
  const timestamp = req.headers['x-payera-timestamp'];
  const eventType = req.headers['x-payera-event'];

  // 验证签名（如果提供了 webhook secret）
  const webhookSecret = process.env.PAYERA_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    // 移除 whsec_ 前缀
    const secret = webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret;
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('Webhook secret not configured, skipping signature verification');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Invalid JSON payload');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`Webhook received: ${event.type}`, event.data);

  // 处理支付成功事件
  if (event.type === 'payment.succeeded') {
    const paymentData = event.data;
    const merchantPaymentId = paymentData.merchant_payment_id; // 你传入的 payment_id
    const clickId = paymentData.metadata?.click_id; // 从元数据中取出 click_id
    const amount = paymentData.amount / 100; // 金额单位是分，转为元
    const currency = paymentData.currency;

    console.log(`Payment succeeded: ${merchantPaymentId}, clickId: ${clickId}, amount: ${amount} ${currency}`);

    // 发送 affiliate postback（如果存在 clickId）
    if (clickId) {
      // 请将下面的 URL 替换为你的联盟平台提供的 postback 地址模板
      // 注意：不同平台参数格式不同，请根据实际情况修改
      const postbackUrl = `https://tracker.affiliate.com/postback?clickid=${clickId}&amount=${amount}&currency=${currency}`;
      try {
        const postbackRes = await fetch(postbackUrl, { method: 'GET' }); // 有些平台要求 GET，有些要求 POST
        if (postbackRes.ok) {
          console.log(`Postback sent for clickId ${clickId}`);
        } else {
          console.error(`Postback failed with status ${postbackRes.status}`);
        }
      } catch (err) {
        console.error(`Error sending postback: ${err.message}`);
      }
    }

    // 这里你可以根据 merchantPaymentId 更新你的订单数据库（如果需要）
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }

  // 必须返回 200 状态码，表示已成功接收
  res.status(200).json({ received: true });
}
