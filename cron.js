// File: api/index.js
const https = require('https');

const TARGET_URLS = [
  'https://sangdev-bshop.onrender.com/',
  'https://cron-sage.vercel.app/'
];

// Hàm ping chuẩn Promise hỗ trợ Timeout 8s và User-Agent
function ping(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = https.get(
      url,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeepAliveBot/2.0)' },
        timeout: 8000
      },
      (res) => {
        const duration = `${Date.now() - startTime}ms`;
        resolve({ url, status: 'SUCCESS', statusCode: res.statusCode, duration });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'TIMEOUT', error: 'Request timed out after 8s' });
    });

    req.on('error', (err) => {
      resolve({ url, status: 'FAILED', error: err.message });
    });
  });
}

// Handler duy nhất xử lý cho Serverless Vercel
module.exports = async (req, res) => {
  const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Ping song song tất cả các URL cùng lúc
  const results = await Promise.all(TARGET_URLS.map(ping));

  console.log(`[${time}] Cron Ping Results:`, results);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    timestamp: time,
    summary: 'Ping completed',
    data: results
  });
};
