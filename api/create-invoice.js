// api/create-invoice.js

// --- 请在这里填入你的TwinPay真实密钥 ---
const YOUR_TWINPAY_CLIENT_ID = '你的Client-Id';
const YOUR_TWINPAY_CLIENT_SECRET = '你的Client-Secret';
// -------------------------------------

export default async function handler(req, res) {
    // 1. 设置CORS响应头，这是修复跨域问题的关键
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. 处理浏览器自动发送的预检请求 (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 确保只接受POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 4. 处理来自前端的购买请求，并调用TwinPay
    const { amount, productName } = req.body;

    const twinpayPayload = {
        amount: Math.round(amount * 100), // 将金额转换为美分
        currency: 'USD',
        // 根据你的TwinPay配置选择支付选项，下面的配置仅为示例
        payment_option: 'TO_CARD',
        callback_url: `https://${req.headers.host}/api/twinpay-callback`,
    };

    try {
        const twinpayResponse = await fetch('https://lk.twinpay.cloud/api/v2/h2h/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Id': YOUR_TWINPAY_CLIENT_ID,
                'Client-Secret': YOUR_TWINPAY_CLIENT_SECRET,
            },
            body: JSON.stringify(twinpayPayload),
        });

        const data = await twinpayResponse.json();

        if (!twinpayResponse.ok) {
            console.error('TwinPay error:', data);
            return res.status(500).json({ error: 'Failed to create invoice' });
        }

        // 假设TwinPay返回的支付链接字段是 payment_url，请根据实际情况调整
        if (data.payment_url) {
            return res.status(200).json({ paymentUrl: data.payment_url });
        } else {
            // 如果返回的是 invoice id，可以构造支付页面链接
            return res.status(200).json({ paymentUrl: `https://lk.twinpay.cloud/pay/${data.id}` });
        }
    } catch (error) {
        console.error('Internal server error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
