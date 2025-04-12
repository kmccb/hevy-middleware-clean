const autoplan = require("./autoplan");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const fetchAllExercises = require("./exerciseService");
const fetchAllRoutines = require("./fetchAllRoutines");

const fs = require("fs");
const axios = require("axios");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { getMacrosFromSheet, getAllMacrosFromSheet } = require("./sheetsService");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService");
const generateHtmlSummary = require("./generateEmail");
const transporter = require("./transporter");
const { analyzeWorkouts } = require("./trainerUtils");

const { Configuration, OpenAIApi } = require("openai");
const { EMAIL_USER, OPENAI_API_KEY } = process.env;

const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

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

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    // ✨ Generate GPT-Based Trainer Quote
    let quoteText = "“You are stronger than you think.” – CoachGPT";

    try {
      const split = recentWorkouts[0]?.title || "Push";
      const exerciseNames = recentWorkouts.flatMap(w => w.exercises.map(e => e.title)).join(", ");
      const feedbackSummary = trainerInsights.map(i =>
        `${i.title}: avg ${i.avgReps} reps @ ${i.avgWeightLbs} lbs – ${i.suggestion}`
      ).join("; ");

      const gptPrompt = `
You're a world-class personal trainer. Write a short motivational and insightful message (1–3 sentences max) to your 47-year-old male client who is trying to lose belly fat while retaining muscle. He just completed a ${split} workout including: ${exerciseNames}.
Here’s your analysis: ${feedbackSummary}.
Make it feel personal, encouraging, and intelligent.`;

      const chatRes = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [{ role: "user", content: gptPrompt }],
        temperature: 0.8
      });

      quoteText = chatRes.data.choices[0].message.content.trim();
    } catch (err) {
      console.warn("❌ GPT quote failed, falling back to ZenQuotes:", err.message);
      try {
        const res = await axios.get('https://zenquotes.io/api/today');
        const quote = res.data[0];
        quoteText = `“${quote.q}” – ${quote.a}`;
      } catch (fallbackErr) {
        console.warn("❌ ZenQuote fallback also failed:", fallbackErr.message);
      }
    }

    const html = generateHtmlSummary(
      recentWorkouts,
      macros,
      allMacros,
      trainerInsights,
      todayDayNumber > 7 ? 1 : todayDayNumber,
      {
        weightChart,
        stepsChart,
        macrosChart,
        calorieChart
      },
      todaysWorkout,
      quoteText
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
