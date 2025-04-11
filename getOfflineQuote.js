// getOfflineQuote.js
const fs = require("fs");
const path = require("path");

function getOfflineQuote() {
  const filePath = path.join(__dirname, "quotes.json");
  const quotes = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // Get day of year (1–365)
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  return quotes[dayOfYear % quotes.length];
}

module.exports = getOfflineQuote;
