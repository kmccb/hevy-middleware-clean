// runDailySync.js
const autoplan = require("./autoplan");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const { fetchExerciseTemplates } = require("./exerciseService");
const fetchAllRoutines = require("./fetchAllRoutines");

const fs = require("fs");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { getMacrosFromSheet, getAllMacrosFromSheet } = require("./sheetsService");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService");
const generateHtmlSummary = require("./generateEmail");
const transporter = require("./transporter");
const { analyzeWorkouts } = require("./trainerUtils");
const { EMAIL_USER } = process.env;

async function runDailySync() {
  try {
    console.log("🔁 Running daily sync...");

    // ✅ Move cache refresh into here
    await fetchExerciseTemplates();
    await fetchAllWorkouts();
    await fetchAllRoutines();
    await fetchExerciseTemplates();

    const workouts = JSON.parse(fs.readFileSync("data/workouts-30days.json"));
    const templates = JSON.parse(fs.readFileSync("data/exercise_templates.json"));
    const routines = JSON.parse(fs.readFileSync("data/routines.json"));

    const autoplanResult = await autoplan({ workouts, templates, routines });
    const todaysWorkout = autoplanResult.routine.routine[0];


    const recentWorkouts = await getYesterdaysWorkouts();
    const macros = await getMacrosFromSheet();
    if (!macros) throw new Error("No macros found for yesterday.");

    const allMacros = await getAllMacrosFromSheet();
    //console.log("🧪 allMacros sample:", allMacros?.slice?.(0, 2)); // add this line to verify
    

    const weightChart = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = recentWorkouts.length === 0 ? [] : analyzeWorkouts(recentWorkouts);

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    //console.log("🧪 todaysWorkout preview:", JSON.stringify(todaysWorkout, null, 2)); 

    const html = generateHtmlSummary(
        recentWorkouts,                         // 1
        macros,                                 // 2
        allMacros,                              // 3
        trainerInsights,                        // 4
        todayDayNumber > 7 ? 1 : todayDayNumber,// 5
        {                                       // 6
          weightChart,
          stepsChart,
          macrosChart,
          calorieChart
        },
        todaysWorkout                           // 7
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
