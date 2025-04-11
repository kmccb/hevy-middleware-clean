// runDailySync.js
const autoplan = require("./autoplan");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const fetchAllExercises = require("./exerciseService");
const fetchAllRoutines = require("./fetchAllRoutines");
const fs = require("fs");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { getMacrosFromSheet, getAllMacrosFromSheet } = require("./sheetsService");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService");
const generateHtmlSummary = require("./generateEmail");
const transporter = require("./transporter");
const { analyzeWorkouts } = require("./trainerUtils");
const { analyzeTrends } = require("./analyzeTrends");
const { EMAIL_USER } = process.env;

async function runDailySync() {
  try {
    console.log("🔁 Running daily sync...");

    await fetchAllExercises();
    await fetchAllWorkouts();
    await fetchAllRoutines();

    const workouts = JSON.parse(fs.readFileSync("data/workouts-30days.json"));
    const templates = JSON.parse(fs.readFileSync("data/exercise_templates.json"));
    const routines = JSON.parse(fs.readFileSync("data/routines.json"));

    const autoplanResult = await autoplan({ workouts, templates, routines });
    const todaysWorkout = autoplanResult.routine.routine[0];

    const recentWorkouts = await getYesterdaysWorkouts();
    const macros = await getMacrosFromSheet();
    if (!macros) throw new Error("No macros found for yesterday.");

    const allMacros = await getAllMacrosFromSheet();

    const weightChart = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = recentWorkouts.length === 0 ? [] : analyzeWorkouts(recentWorkouts);
    const trendInsights = analyzeTrends();

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    const html = generateHtmlSummary(
      recentWorkouts,
      macros,
      allMacros,
      trainerInsights,
      todayDayNumber > 7 ? 1 : todayDayNumber,
      { weightChart, stepsChart, macrosChart, calorieChart },
      todaysWorkout,
      trendInsights
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
