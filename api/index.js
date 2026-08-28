const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getTargetUrls() {
  try {
    const filePath = path.join(process.cwd(), 'urls.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Lỗi đọc urls.json:', err.message);
  }
  return [];
}

async function pingAll() {
  const urls = getTargetUrls();
  const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  if (!urls || urls.length === 0) {
    return { lastRun: timestamp, total: 0, successCount: 0, results: [] };
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
          url: url,
          status: res.status,
          success: true,
          duration: (Date.now() - start) + 'ms'
        };
      } catch (error) {
        return {
          url: url,
          status: error.response ? error.response.status : (error.code || 500),
          success: false,
          duration: (Date.now() - start) + 'ms'
        };
      }
    })
  );

  const formatted = results.map(r => r.value || r.reason);
  return {
    lastRun: timestamp,
    total: urls.length,
    successCount: formatted.filter(r => r.success).length,
    results: formatted
  };
}

module.exports = async (req, res) => {
  // Nếu request yêu cầu API JSON
  if (req.url.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    const data = await pingAll();
    return res.status(200).json(data);
  }

  // Mặc định trả về giao diện HTML
  const report = await pingAll();

  const rowsHtml = report.results.length === 0
    ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 20px;">Không tìm thấy URL nào trong urls.json</td></tr>'
    : report.results.map(item => `
        <tr>
          <td style="word-break: break-all; max-width: 320px; color: #cbd5e1;">${item.url}</td>
          <td><span style="display:inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${item.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${item.success ? '#4ade80' : '#f87171'}; border: 1px solid ${item.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};">${item.success ? 'Thành công' : 'Thất bại'}</span></td>
          <td style="font-weight: 600; color: ${item.success ? '#4ade80' : '#f87171'};">${item.status}</td>
          <td>${item.duration}</td>
        </tr>
      `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>URL Ping Monitor</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { background-color: #0f172a; color: #f8fafc; padding: 24px 16px; margin: 0; min-height: 100vh; display: flex; justify-content: center; }
    .box { width: 100%; max-width: 800px; background: #1e293b; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); border: 1px solid #334155; height: fit-content; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; }
    h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: #38bdf8; }
    .btn { background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn:hover { background: #0369a1; }
    .status-bar { margin: 16px 0; font-size: 0.9rem; color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #334155; font-size: 0.9rem; }
    th { background: #0f172a; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="box">
    <div class="header">
      <h2>⚡ URL Ping Monitor</h2>
      <button class="btn" onclick="location.reload()">Ping Lại</button>
    </div>
    <div class="status-bar">
      Lần chạy: <b style="color:#f8fafc">${report.lastRun}</b> | Thành công: <b style="color:#38bdf8">${report.successCount}/${report.total}</b>
    </div>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Trạng thái</th>
          <th>Mã HTTP</th>
          <th>Thời gian</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
