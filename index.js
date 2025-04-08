// Full updated index.js with working HTML meal plan in email

const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const fs = require("fs");
const { fetchAllExercises } = require("./exerciseService");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart} = require("./chartService");


// Constants and Configuration
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;
const HEVY_API_KEY = process.env.HEVY_API_KEY;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";
const SHEET_ID = "1iKwRgzsqwukqSQsb4WJ_S-ULeVn41VAFQlKduima9xk";
const EMAIL_USER = "tomscott2340@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS;
const KG_TO_LBS = 2.20462;

// Google Sheets Authentication
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({ version: "v4", auth });

// Email Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

/**
 * MEAL PLANNING SECTION
 * This section defines meal plans and generates HTML-formatted meal suggestions.
 * MEAL_BANK contains predefined meal plans with nutritional totals and grocery lists.
 */
const MEAL_BANK = [
  {
    name: "Plan A",
    meals: {
      breakfast: ["4 egg whites + 2 whole eggs scrambled", "1/2 cup black beans", "1 tsp olive oil for sautéing spinach"],
      lunch: ["6 oz grilled chicken breast", "1/2 cup lentils", "1 cup steamed broccoli", "1 tbsp vinaigrette"],
      dinner: ["6 oz lean sirloin steak", "1/2 cup roasted sweet potatoes", "1 cup green beans"],
      snack: ["1 scoop whey protein isolate", "1 tbsp almond butter"]
    },
    totals: { protein: 185, fat: 56, carbs: 110, calories: 1760 },
    grocery: ["Eggs (6)", "Egg whites", "Black beans", "Spinach", "Olive oil", "Chicken breast", "Lentils", "Broccoli", "Vinaigrette", "Sirloin steak", "Sweet potatoes", "Green beans", "Whey protein isolate", "Almond butter"]
  },
  {
    name: "Plan B",
    meals: {
      breakfast: ["Protein oatmeal: 1/3 cup oats + 1 scoop whey + 1 tbsp peanut butter"],
      lunch: ["5 oz grilled salmon", "1/2 cup quinoa", "1 cup sautéed zucchini"],
      dinner: ["6 oz turkey breast", "1/2 cup black beans", "1 cup roasted cauliflower"],
      snack: ["2 boiled eggs", "1 scoop whey protein isolate"]
    },
    totals: { protein: 186, fat: 55, carbs: 112, calories: 1785 },
    grocery: ["Oats", "Whey protein", "Peanut butter", "Salmon", "Quinoa", "Zucchini", "Turkey breast", "Black beans", "Cauliflower", "Eggs (2)"]
  }
];

function generateMealPlan() {
  const random = MEAL_BANK[Math.floor(Math.random() * MEAL_BANK.length)];
  const { meals, totals, grocery } = random;
  // Returns an HTML string for email with meal details
  return `
    🍽️ Suggested Meal Plan<br>
    <strong>Meal 1 – Breakfast</strong><br>
    • ${meals.breakfast.join("<br>• ")}<br><br>
    <strong>Meal 2 – Lunch</strong><br>
    • ${meals.lunch.join("<br>• ")}<br><br>
    <strong>Meal 3 – Dinner</strong><br>
    • ${meals.dinner.join("<br>• ")}<br><br>
    <strong>Snack</strong><br>
    • ${meals.snack.join("<br>• ")}<br><br>
    📈 <strong>Daily Totals:</strong><br>
    - Protein: ${totals.protein}g<br>
    - Fat: ${totals.fat}g<br W
    - Carbs: ${totals.carbs}g<br>
    - Calories: ~${totals.calories} kcal<br><br>
    🛒 <strong>Grocery List:</strong><br>
    ${grocery.map(item => `- ${item}`).join("<br>")}
  `.trim();
}

/**
 * GOOGLE SHEETS DATA FETCHING
 * Functions to retrieve macro and weight data from Google Sheets.
 */
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
  today.setDate(today.getDate() - 1); // Look for yesterday's data
  const targetDate = today.toISOString().split("T")[0];
  console.log("📅 Looking for macros dated:", targetDate);

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Macros!A2:I"
  });
  const rows = result.data.values || [];
  const row = rows.find(r => r[0]?.startsWith(targetDate));
  return row ? { date: row[0], protein: row[1], fat: row[2], carbs: row[3], calories: row[4], weight: row[5], steps: row[6], sleep: row[7], energy: row[8] } : null;
}

/**
 * WORKOUT PROCESSING AND ANALYSIS
 * Functions to clean workout data and provide training insights.
 */
function sanitizeRoutine(routine) {
  // Removes unnecessary fields from routine and exercise data
  const cleanExercises = routine.exercises.map(({ index, title, created_at, id, user_id, ...rest }) => ({
    ...rest,
    sets: rest.sets.map(({ index, ...set }) => set)
  }));
  const { created_at, id, user_id, folder_id, updated_at, ...restRoutine } = routine;
  return { ...restRoutine, exercises: cleanExercises };
}

function analyzeWorkouts(workouts) {
  const exerciseMap = {};
  workouts.forEach(w => {
    w.exercises.forEach(e => {
      if (!exerciseMap[e.title]) exerciseMap[e.title] = [];
      e.sets.forEach(s => {
        if (s.weight_kg != null && s.reps != null) exerciseMap[e.title].push(s);
      });
    });
  });

  const analysis = [];
  for (const [title, sets] of Object.entries(exerciseMap)) {
    const last3 = sets.slice(-3); // Analyze last 3 sets for trends
    const avgWeightKg = last3.reduce((sum, s) => sum + s.weight_kg, 0) / last3.length;
    const avgReps = last3.reduce((sum, s) => sum + s.reps, 0) / last3.length;
    const lastVolume = last3.map(s => s.weight_kg * s.reps);
    const suggestion = lastVolume.length >= 2 && lastVolume.at(-1) > lastVolume.at(-2)
      ? "⬆️ Increase weight slightly"
      : "➡️ Maintain weight / reps";
    analysis.push({ title, avgWeightLbs: (avgWeightKg * KG_TO_LBS).toFixed(1), avgReps: avgReps.toFixed(1), suggestion });
  }
  return analysis;
}

/**
 * UTILITY FUNCTIONS
 * Small helpers for quotes and HTML generation.
 */
function getQuoteOfTheDay() {
  const quotes = [
    "You don’t have to be extreme, just consistent.",
    "Discipline is choosing between what you want now and what you want most.",
    "The only bad workout is the one that didn’t happen.",
    "Progress, not perfection.",
    "Sweat now, shine later."
  ];
  return quotes[new Date().getDate() % quotes.length];
}

function generateHtmlSummary(workouts, macros, trainerInsights, todayTargetDay, quote) {
  // Generates the full HTML email content with workout summary, macros, and meal plan
  const workoutBlock = workouts.map(w => {
    const exBlocks = w.exercises.map(e => {
      const validSets = e.sets.filter(s => s.weight_kg != null && s.reps != null);
      if (!validSets.length) return null;
      const setSummary = validSets.map(s => `${(s.weight_kg * KG_TO_LBS).toFixed(1)} lbs x ${s.reps}`).join(", ");
      const note = trainerInsights.find(i => i.title === e.title)?.suggestion || "Maintain form and consistency";
      return `<strong>${e.title}</strong><br>Sets: ${setSummary}<br>Note: ${note}`;
    }).filter(Boolean).join("<br><br>");
    return `<h4>Workout: ${w.title}</h4>${exBlocks}`;
  }).join("<br><br>");

  const feedback = trainerInsights.length > 0
    ? trainerInsights.map(i => `• <strong>${i.title}</strong>: ${i.suggestion} (avg ${i.avgReps} reps @ ${i.avgWeightLbs} lbs)`).join("<br>")
    : "Rest day — no exercise trends to analyze. Use today to prepare for tomorrow’s push.";

  return `
    <h3>💪 Workout Summary</h3>${workoutBlock}<br><br>
    <h3>🥗 Macros – ${macros.date}</h3>
    <ul><li><strong>Calories:</strong> ${macros.calories} kcal</li><li><strong>Protein:</strong> ${macros.protein}g</li><li><strong>Carbs:</strong> ${macros.carbs}g</li><li><strong>Fat:</strong> ${macros.fat}g</li><li><strong>Weight:</strong> ${macros.weight} lbs</li><li><strong>Steps:</strong> ${macros.steps}</li></ul>
    <h3>📉 Weight Trend (Last 30 Days)</h3><img src="cid:weightChart" alt="Weight chart"><br><br>
    <h3>🚶 Steps Trend (Last 30 Days)</h3><img src="cid:stepsChart" alt="Steps chart"><br><br>
    <h3>🍳 Macro Trend (Last 30 Days)</h3><img src="cid:macrosChart" alt="Macros chart"><br><br>
    <h3>🔥 Calorie Trend (Last 30 Days)</h3><img src="cid:caloriesChart" alt="Calories chart"><br><br>
    <h3>🧠 Trainer Feedback</h3>${feedback}<br>
    <h3>📅 What’s Next</h3>Today is <strong>Day ${todayTargetDay}</strong>. Focus on:<br>- Intentional form<br>- Progressive overload<br>- Core tension & recovery<br><br>
    <h3>💡 Meal Plan for the Day</h3>${generateMealPlan()}<br><br>
    <h3>💡 Quote of the Day</h3><em>${quote}</em><br><br>
    Keep it up — I’ve got your back.<br>– CoachGPT
  `;
}

/**
 * API ENDPOINTS
 * Main routes for the Express server.
 * 
 * 
 */
const path = require("path");
const fs = require("fs");

app.get("/debug-workouts", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "workouts-30days.json");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "No workout data file found." });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ count: data.length, sample: data.slice(0, 2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




const fetchAllWorkouts = require("./fetchAllWorkouts");

app.post("/fetch-all", async (req, res) => {
  try {
    const data = await fetchAllWorkouts();
    res.json({ message: "✅ Workouts fetched", count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



const { runDailySync } = require("./daily");

app.get("/debug", (req, res) => {
  res.send(`🔐 Render sees HEVY_API_KEY as: ${process.env.HEVY_API_KEY || 'undefined'}`);
});


app.post("/daily", async (req, res) => {
  try {
    console.log("⚡ /daily called from", new Date().toISOString());

    console.log("📨 /daily route hit");
    console.log("🔑 HEVY_API_KEY =", HEVY_API_KEY);

    await fetchAllExercises(); // Syncs exercise data from Hevy API
    const recentWorkouts = await getYesterdaysWorkouts();
    const isRestDay = recentWorkouts.length === 0;

    const macros = await getMacrosFromSheet();
    if (!macros) return res.status(204).send();

    const allMacros = await getAllMacrosFromSheet();
    const chartBuffer = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = isRestDay ? [] : analyzeWorkouts(recentWorkouts);

    const routineResp = await axios.get(`${HEVY_API_BASE}/routines`, { headers: { "api-key": HEVY_API_KEY } });
    const updatedRoutines = [];

    for (const routine of routineResp.data.routines) {
      const cleanRoutine = sanitizeRoutine(routine);
      cleanRoutine.exercises = cleanRoutine.exercises.map(ex => {
        const insight = trainerInsights.find(i => i.title === ex.title);
        if (insight) {
          ex.sets = ex.sets.map(set => ({
            ...set,
            weight_kg: parseFloat(insight.avgWeightLbs) / KG_TO_LBS,
            reps: parseInt(insight.avgReps)
          }));
        }
        return ex;
      });

      await axios.put(`${HEVY_API_BASE}/routines/${routine.id}`, { routine: cleanRoutine }, {
        headers: { "api-key": HEVY_API_KEY, "Content-Type": "application/json" }
      });

      updatedRoutines.push(routine.title);
    }

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1;

    const html = generateHtmlSummary(
      recentWorkouts,
      macros,
      trainerInsights,
      todayDayNumber > 7 ? 1 : todayDayNumber,
      getQuoteOfTheDay()
    );

    await transporter.sendMail({
      from: EMAIL_USER,
      to: EMAIL_USER,
      subject: `🎯 Hevy Daily Summary (${macros.date})`,
      html,
      attachments: [
        { filename: 'weight-trend.png', content: chartBuffer, cid: 'weightChart' },
        { filename: 'steps.png', content: stepsChart, cid: 'stepsChart' },
        { filename: 'macros.png', content: macrosChart, cid: 'macrosChart' },
        { filename: 'calories.png', content: calorieChart, cid: 'caloriesChart' }
      ]
    });

    res.status(200).json({ message: "Daily sync complete", updated: updatedRoutines });

  } catch (error) {
    console.error("Daily sync error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});


app.get("/refresh-exercises", async (req, res) => {
  try {
    const exercises = await fetchAllExercises();
    res.json({ success: true, count: exercises.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// index.js – Route handler to manually trigger the smart daily workout planner

// Import the autoplan logic (analyzes workout history and builds today's optimal routine)
const autoplan = require('./autoplan');

// Define the POST route at /autoplan
app.post("/autoplan", async (req, res) => {
  try {
    // Run the autoplan function to decide today’s workout and create the routine
    const result = await autoplan();

    // Respond with success and routine details
    res.json({ success: true, result });
  } catch (err) {
    // Log any errors and return a 500 error response
    console.error("Error in /autoplan:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



app.get("/", (req, res) => res.send("🏋️ CoachGPT Middleware is LIVE on port 10000"));

app.listen(PORT, () => console.log("🏋️ CoachGPT Middleware is LIVE on port 10000"));
console.log("4/8/25 - 1:47");

