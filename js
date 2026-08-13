const https = require('https');

// URL Web Render của bạn
const TARGET_URL = 'https://sangdev-bshop.onrender.com/';

// Thời gian giữa các lần gửi request: 5 phút = 300,000 miligiây
const INTERVAL = 5 * 60 * 1000; 

function keepAlive() {
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  
  https.get(TARGET_URL, (res) => {
    console.log(`[${now}] Ping thành công! Status code: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[${now}] Ping thất bại: ${err.message}`);
  });
}

// Chạy lệnh ping ngay lập tức khi khởi động script
console.log('--- Đã khởi chạy Cron Job Keep-Alive cho Render ---');
keepAlive();

// Lặp lại tự động mỗi 5 phút
setInterval(keepAlive, INTERVAL);
