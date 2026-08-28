const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const URLS_FILE = path.join(__dirname, 'urls.json');

// Biến lưu trữ kết quả lần chạy gần nhất để hiển thị ra UI
let lastReport = {
  lastRun: 'Chưa có dữ liệu',
  total: 0,
  successCount: 0,
  results: []
};

// Hàm đọc URLs từ json
function getTargetUrls() {
  try {
    if (fs.existsSync(URLS_FILE)) {
      const data = fs.readFileSync(URLS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Lỗi đọc urls.json:', err.message);
  }
  return [];
}

// Hàm thực hiện gửi request ping
async function executePing() {
  const urls = getTargetUrls();
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  if (urls.length === 0) {
    lastReport = { lastRun: timestamp, total: 0, successCount: 0, results: [] };
    return lastReport;
  }

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const start = Date.now();
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { 'User-Agent': 'Cron-KeepAlive/1.0' }
        });
        return {
          url,
          status: res.status,
          success: true,
          duration: `${Date.now() - start}ms`,
          message: 'OK'
        };
      } catch (error) {
        return {
          url,
          status: error.response ? error.response.status : 500,
          success: false,
          duration: `${Date.now() - start}ms`,
          message: error.message
        };
      }
    })
  );

  const formattedResults = results.map(r => r.value || r.reason);
  lastReport = {
    lastRun: timestamp,
    total: urls.length,
    successCount: formattedResults.filter(r => r.success).length,
    results: formattedResults
  };

  console.log(`[${timestamp}] Đã hoàn tất ping: ${lastReport.successCount}/${lastReport.total} URL thành công.`);
  return lastReport;
}

// Cron job chạy mỗi 13 phút (chạy nền khi chạy local hoặc VPS)
cron.schedule('*/13 * * * *', () => {
  executePing();
});

// Endpoint API lấy data JSON hoặc trigger chạy
app.get('/api/ping', async (req, res) => {
  const data = await executePing();
  res.json(data);
});

// Giao diện Web hiển thị trạng thái
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>URL Monitor - Trạng thái Ping</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background-color: #f8fafc; color: #1e293b; padding: 24px 16px; margin: 0; }
        .box { max-width: 800px; margin: auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        h2 { margin: 0; font-size: 1.25rem; }
        .btn { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn:hover { background: #1d4ed8; }
        .btn:disabled { background: #94a3b8; cursor: not-allowed; }
        .status-bar { margin: 16px 0; font-size: 0.9rem; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
        th { background: #f8fafc; color: #475569; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-ok { background: #dcfce7; color: #15803d; }
        .badge-fail { background: #fee2e2; color: #b91c1c; }
        .url { word-break: break-all; max-width: 350px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="header">
          <h2>📡 Trạng thái Ping Cron (13 phút)</h2>
          <button class="btn" id="runBtn" onclick="runPing()">Gửi Ping Ngay</button>
        </div>
        
        <div class="status-bar" id="infoText">Đang lấy dữ liệu...</div>

        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Trạng thái</th>
              <th>Mã HTTP</th>
              <th>Thời gian phản hồi</th>
            </tr>
          </thead>
          <tbody id="rows">
            <tr><td colspan="4" style="text-align: center; color: #94a3b8;">Đang tải...</td></tr>
          </tbody>
        </table>
      </div>

      <script>
        async function runPing() {
          const btn = document.getElementById('runBtn');
          const info = document.getElementById('infoText');
          const rows = document.getElementById('rows');
          
          btn.disabled = true;
          info.innerText = '⏳ Đang gửi request tới danh sách URL...';

          try {
            const res = await fetch('/api/ping');
            const data = await res.json();

            info.innerHTML = 'Lần chạy gần nhất: <b>' + data.lastRun + '</b> | Thành công: <b>' + data.successCount + '/' + data.total + '</b>';
            
            rows.innerHTML = data.results.map(item => \`
              <tr>
                <td class="url">\${item.url}</td>
                <td><span class="badge \${item.success ? 'badge-ok' : 'badge-fail'}">\${item.success ? 'Thành công' : 'Thất bại'}</span></td>
                <td><b>\${item.status}</b></td>
                <td>\${item.duration} (\${item.message})</td>
              </tr>
            \`).join('');
          } catch (e) {
            info.innerText = 'Lỗi tải dữ liệu: ' + e.message;
          } finally {
            btn.disabled = false;
          }
        }
        window.onload = runPing;
      </script>
    </body>
    </html>
  `);
});

// Chạy server khi ở local / VPS
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại: http://localhost:${PORT}`);
    executePing();
  });
}

// Export app để tương thích Serverless trên Vercel
module.exports = app;
