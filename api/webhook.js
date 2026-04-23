// api/webhook.js
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
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

  // 验证签名（如果你配置了 webhook secret）
  const webhookSecret = process.env.PAYERA_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    const secret = webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret;
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
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
    const clickId = paymentData.metadata?.click_id;   // 从 metadata 中取出 clickid
    const amountInCents = paymentData.amount;         // 金额单位是分
    const amountInDollars = (amountInCents / 100).toFixed(2); // 转为美元，保留两位小数

    if (clickId) {
      // 构建 affiliate postback URL
      const postbackUrl = `http://newmobi.fuse-cloud.com/pb?tid=${encodeURIComponent(clickId)}&adv_sid=${amountInDollars}`;
      console.log('Sending affiliate postback:', postbackUrl);

      try {
        const postbackRes = await fetch(postbackUrl, { method: 'GET' });
        if (postbackRes.ok) {
          console.log(`Affiliate postback sent successfully for clickId ${clickId}`);
        } else {
          console.error(`Affiliate postback failed with status ${postbackRes.status}`);
        }
      } catch (err) {
        console.error(`Error sending affiliate postback: ${err.message}`);
      }
    } else {
      console.log('No click_id found in metadata, skipping affiliate postback');
    }

    // 可选：根据 paymentData.merchant_payment_id 更新你的订单数据库
    // ...

  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }

  // 必须返回 200 确认收到
  res.status(200).json({ received: true });
}
