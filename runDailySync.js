// runDailySync.js
const autoplan = require("./autoplan");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const fetchAllExercises = require("./exerciseService");
const fetchAllRoutines = require("./fetchAllRoutines");
const { generateFullAICoachPlan } = require("./fullAICoachService");
const buildTrainingSummary = require("./buildTrainingSummary");
const fs = require("fs");
const axios = require("axios");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { getMacrosFromSheet, getAllMacrosFromSheet } = require("./sheetsService");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService");
const generateHtmlSummary = require("./generateEmail");
const transporter = require("./transporter");
const { analyzeWorkouts } = require("./trainerUtils");
const routines = JSON.parse(fs.readFileSync('data/routines.json', 'utf8'));

const { EMAIL_USER } = process.env;

async function runDailySync() {
  try {
    console.log("🔁 Running daily sync...");

    await fetchAllExercises();
    await fetchAllWorkouts();
    await fetchAllRoutines();
    await buildTrainingSummary();

    const workouts = JSON.parse(fs.readFileSync("data/workouts-30days.json"));
    const templates = JSON.parse(fs.readFileSync("data/exercise_templates.json"));
    const routines = JSON.parse(fs.readFileSync("data/routines.json"));
    const trainingSummary = JSON.parse(fs.readFileSync("data/training_summary.json"));

    if (!trainingSummary || !trainingSummary.frequency) {
      throw new Error("❌ trainingSummary is missing or invalid.");
    }

    const autoplanResult = await autoplan({ workouts, templates, routines });

    if (!autoplanResult.success || !autoplanResult.routine || !autoplanResult.routine.exercises) {
      console.warn("❌ No valid routine generated. Skipping email composition.");
      return;
    }
    
    const todaysWorkout = autoplanResult.routine;

    const recentWorkouts = await getYesterdaysWorkouts();
    const macros = await getMacrosFromSheet();
    if (!macros) throw new Error("No macros found for yesterday.");
    const allMacros = await getAllMacrosFromSheet();

    const weightChart = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = recentWorkouts.length === 0 ? [] : analyzeWorkouts(recentWorkouts);
    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    let quoteText = "“You are stronger than you think.” – CoachGPT";
    try {
      const res = await axios.get('https://zenquotes.io/api/today');
      const quote = res.data[0];
      quoteText = `“${quote.q}” – ${quote.a}`;
    } catch (err) {
      console.warn("❌ ZenQuote fetch failed, using fallback:", err.message);
    }

    const aiCoach = await generateFullAICoachPlan({
      trainingSummary,
      macros,
      availableExercises: templates,
      goal: "Visible abs and lean muscle maintenance",
      constraints: ["No deadlifts", "Avoid back strain", "No spinal compression"]
    });
    const syncAIPlanToHevy = require("./syncAIPlanToHevy");
if (aiCoach.todayPlan) {
  await syncAIPlanToHevy(aiCoach.todayPlan);
}
if (aiPlan && aiPlan.todayPlan) {
  await syncAIPlanToHevy(aiPlan.todayPlan);
} else {
  console.warn("❌ No valid routine generated. Skipping Hevy sync.");
}


    let html = generateHtmlSummary(
      recentWorkouts,
      macros,
      allMacros,
      trainerInsights,
      todayDayNumber > 7 ? 1 : todayDayNumber,
      { weightChart, stepsChart, macrosChart, calorieChart },
      todaysWorkout,
      quoteText,
      aiCoach?.todayPlan,
      aiCoach?.coachMessage
    );

    console.log("📋 All routine titles:", routines.map(r => r.name));
    
    console.log("🧠 AI CoachGPT message:", aiCoach.coachMessage);

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
