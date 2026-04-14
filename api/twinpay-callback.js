// api/twinpay-callback.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 获取回调数据（可能是 JSON 或表单格式，文档未明确，需要测试）
  const payload = req.body;

  // 根据文档说明，数据会以某种方式包含 sign 字段
  const { sign, ...data } = payload;

  // 验证签名（文档给的示例是 PHP 的 $_POST，实际可能通过 JSON 发送）
  // 这里假设数据是按 timestamp|subtotal|percentage|charge_percentage|charge_fixed|total 拼接
  // 你需要根据 TwinPay 实际发送的字段调整
  const signString = `${data.timestamp}|${data.subtotal}|${data.percentage}|${data.charge_percentage}|${data.charge_fixed}|${data.total}`;
  const expectedSign = crypto
    .createHmac('sha256', process.env.TWINPAY_CLIENT_SECRET)
    .update(signString)
    .digest('hex');

  if (sign !== expectedSign) {
    console.error('Invalid signature');
    return res.status(400).send('Invalid signature');
  }

  // 签名验证通过，处理订单逻辑（例如更新数据库、记录日志等）
  // 这里可以调用一个无代码服务（如 Google Sheets、Webhook）来记录订单

  // 必须返回 HTTP 200，告诉 TwinPay 已经收到通知
  res.status(200).send('OK');
}
