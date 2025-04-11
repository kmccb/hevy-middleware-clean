// sheetsService.js
const { google } = require("googleapis");

const SHEET_ID = "1iKwRgzsqwukqSQsb4WJ_S-ULeVn41VAFQlKduima9xk"; // Or move to env

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

async function getAllMacrosFromSheet() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Macros!A2:I"
  });
  const rows = result.data.values || [];
  return rows.map(([date, protein, fat, carbs, calories, weight, steps, sleep, energy]) => ({
    date, protein, fat, carbs, calories, weight, steps, sleep, energy
  })).filter(row => row.date && row.weight);
}

async function getMacrosFromSheet() {
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const targetDate = today.toISOString().split("T")[0];

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Macros!A2:I"
  });
  const rows = result.data.values || [];
  const row = rows.find(r => r[0]?.startsWith(targetDate));

  return row
    ? {
        date: row[0],
        protein: row[1],
        fat: row[2],
        carbs: row[3],
        calories: row[4],
        weight: row[5],
        steps: row[6],
        sleep: row[7],
        energy: row[8]
      }
    : null;
}

module.exports = { getAllMacrosFromSheet, getMacrosFromSheet };