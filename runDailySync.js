// runDailySync.js
const fs = require("fs");
const axios = require("axios");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService");
const { getMacrosFromSheet, getAllMacrosFromSheet } = require("./index"); // Adjust if needed
const { analyzeWorkouts } = require("./index");
const { sanitizeRoutine } = require("./index");
const transporter = require("./transporter"); // Create a separate transporter.js if needed
const generateHtmlSummary = require("./generateEmail"); // Move HTML logic there
const { HEVY_API_KEY, HEVY_API_BASE, EMAIL_USER } = process.env;

async function runDailySync() {
  try {
    console.log("🔁 Running daily sync...");

    const recentWorkouts = await getYesterdaysWorkouts();
    const macros = await getMacrosFromSheet();
    if (!macros) throw new Error("No macros found for yesterday.");

    const allMacros = await getAllMacrosFromSheet();

    const weightChart = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = recentWorkouts.length === 0 ? [] : analyzeWorkouts(recentWorkouts);

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    const html = generateHtmlSummary(
      recentWorkouts,
      macros,
      trainerInsights,
      todayDayNumber > 7 ? 1 : todayDayNumber,
      "You’ve got this 💪",
      { weightChart, stepsChart, macrosChart, calorieChart }
    );

    await transporter.sendMail({
      from: EMAIL_USER,
      to: EMAIL_USER,
      subject: `🎯 Hevy Daily Summary (${macros.date})`,
      html,
      attachments: [
        { filename: "weight.png", content: weightChart.buffer, cid: "weightChart" },
        { filename: "steps.png", content: stepsChart.buffer, cid: "stepsChart" },
        { filename: "macros.png", content: macrosChart.buffer, cid: "macrosChart" },
        { filename: "calories.png", content: calorieChart.buffer, cid: "caloriesChart" }
      ]
    });

    console.log("✅ Daily summary sent!");
  } catch (err) {
    console.error("❌ Daily sync failed:", err.message || err);
  }
}

module.exports = runDailySync;
