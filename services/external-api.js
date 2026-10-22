// services/external-api.js
const axios = require("axios");

function isRetryable(error) {
  if (!error.response) return true;
  const status = error.response.status;
  return status === 429 || (status >= 500 && status < 600);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, timeoutMs = 3000, maxRetries = 2) {
  let attempt = 0;

  while (true) {
    try {
      const response = await axios.get(url, { timeout: timeoutMs });
      return response.data;
    } catch (error) {
      attempt += 1;
      const canRetry = attempt <= maxRetries && isRetryable(error);

      if (!canRetry) {
        throw error;
      }

      const baseBackoffMs = 2 ** (attempt - 1) * 1000;
      // Equal Jitter ตามหัวข้อ 3.3 ของ wk11.md เพื่อไม่ให้ client หลายตัว retry พร้อมกันเป๊ะ
      const backoffMs = baseBackoffMs / 2 + Math.random() * (baseBackoffMs / 2);
      console.warn(
        `[external-api] request to ${url} failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${Math.round(backoffMs)}ms`,
      );
      await delay(backoffMs);
    }
  }
}

module.exports = { fetchWithRetry, isRetryable };
