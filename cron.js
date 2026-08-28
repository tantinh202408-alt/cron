const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Đường dẫn file urls.json chuẩn hoá cho môi trường Vercel / Local
const URLS_FILE = path.join(process.cwd(), 'urls.json');

// Hàm đọc URLs an toàn từ urls.json
function getTargetUrls() {
  try {
    if (fs.existsSync(URLS_FILE)) {
      const data = fs.readFileSync(URLS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.error('Lỗi đọc urls.json:', err.message);
  }
  return [];
}

// Hàm thực hiện gửi request ping đồng thời
async function executePing() {
  const urls = getTargetUrls();
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  if (urls.length === 0) {
    return {
      lastRun: timestamp,
      total: 0,
      successCount: 0,
      results: []
    };
  }

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const start = Date.now();
      try {
        const res = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'CronMonitor/1.0' }
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
          status: error.response ? error.response.status : (error.code || 500),
          success: false,
          duration: `${Date.now() - start}ms`,
          message: error.message
        };
      }
    })
  );

  const formattedResults = results.map(r => r.value || r.reason);
  const report = {
    lastRun: timestamp,
    total: urls.length,
    successCount: formattedResults.filter(r => r.success).length,
    results: formattedResults
  };

  console.log(`[${timestamp}] Đã ping xong: ${report.successCount}/${report.total} URL thành công.`);
  return report;
}

// Endpoint API lấy data và kích hoạt ping
app.get('/api/ping', async (req, res) => {
  const data = await executePing();
  res.status(200).json(data);
});

// Giao diện Web hiển thị trạng thái
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>URL Monitor - Trạng thái Ping</title>
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
        body { background-color: #0f172a; color: #f8fafc; padding: 24px 16px; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: flex-start; }
        .box { width: 100%; max-width: 800px; background: #1e293b; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); border: 1px solid #334155; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; }
        h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
        .btn { background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
        .btn:hover { background: #0369a1; }
        .btn:disabled { background: #475569; cursor: not-allowed; }
        .status-bar { margin: 16px 0; font-size: 0.9rem; color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #334155; font-size: 0.9rem; }
        th { background: #0f172a; color: #94a3b8; font-weight: 600; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-ok { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .badge-fail { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .url { word-break: break-all; max-width: 320px; color: #cbd5e1; }
        .code { font-weight: 600; }
        .code-200 { color: #4ade80; }
        .code-err { color: #f87171; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="header">
          <h2>⚡ URL Ping Monitor</h2>
          <button class="btn" id="runBtn" onclick="runPing()">Gửi Ping Ngay</button>
        </div>
        
        <div class="status-bar" id="infoText">Đang tải trạng thái...</div>

        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Trạng thái</th>
              <th>Mã HTTP</th>
              <th>Phản hồi</th>
            </tr>
          </thead>
          <tbody id="rows">
            <tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Đang lấy dữ liệu...</td></tr>
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

            info.innerHTML = 'Lần chạy: <b style="color:#f8fafc">' + data.lastRun + '</b> | Thành công: <b style="color:#38bdf8">' + data.successCount + '/' + data.total + '</b>';
            
            if (data.results.length === 0) {
              rows.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Không tìm thấy URL nào trong urls.json</td></tr>';
              return;
            }

            rows.innerHTML = data.results.map(item => \`
              <tr>
                <td class="url">\${item.url}</td>
                <td><span class="badge \${item.success ? 'badge-ok' : 'badge-fail'}">\${item.success ? 'Thành công' : 'Thất bại'}</span></td>
                <td class="code \${item.success ? 'code-200' : 'code-err'}">\${item.status}</td>
                <td>\${item.duration}</td>
              </tr>
            \`).join('');
          } catch (e) {
            info.innerText = '❌ Lỗi kết nối: ' + e.message;
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

// Chạy server khi chạy ở môi trường Local/VPS
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    executePing();
  });
}

// Xuất app để chạy tương thích Serverless Function trên Vercel
module.exports = app;
