// 1. MODULE IMPORTS
// These are external libraries and local files we need to run the app
const express = require("express"); // Web server framework
const axios = require("axios"); // For making HTTP requests (e.g., to Hevy API)
const nodemailer = require("nodemailer"); // For sending emails
const { google } = require("googleapis"); // Google APIs (for Sheets)
const fs = require("fs"); // File system access (reading/writing files)
const path = require("path"); // Helps build file paths across operating systems
const fetchAllExercises = require("./exerciseService"); // Custom function to fetch exercise templates
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts"); // Gets yesterday's workout data
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService"); // Chart generation functions
const fetchAllWorkouts = require("./fetchAllWorkouts"); // Fetches all workout history
const analyzeWorkoutHistory = require("./analyzeHistory"); // Analyzes workout trends
const { runDailySync } = require("./daily"); // Daily sync logic
const autoplan = require("./autoplan"); // Smart workout planner
autoplan(); 

// 2. CONSTANTS AND CONFIGURATION
// Setting up the app and defining constants used throughout
const app = express(); // Creates an Express app instance
app.use(express.json()); // Middleware to parse JSON request bodies
const PORT = process.env.PORT || 10000; // Server port (defaults to 10000 if not set in environment)
const HEVY_API_KEY = process.env.HEVY_API_KEY; // API key for Hevy (stored in environment variables for security)
const HEVY_API_BASE = "https://api.hevyapp.com/v1"; // Base URL for Hevy API
const SHEET_ID = "1iKwRgzsqwukqSQsb4WJ_S-ULeVn41VAFQlKduima9xk"; // Google Sheets ID for data storage
const EMAIL_USER = "tomscott2340@gmail.com"; // Email address for sending reports
const EMAIL_PASS = process.env.EMAIL_PASS; // Email password (stored in environment variables)
const KG_TO_LBS = 2.20462; // Conversion factor from kilograms to pounds



// Startup Cache Loader Section Only)


const cacheFiles = {
  workouts: "data/workouts-30days.json",
  templates: "data/exercise_templates.json",
  routines: "data/routines.json",
};

function ensureCacheFilesExist() {
  for (const [label, filepath] of Object.entries(cacheFiles)) {
    const fullPath = path.join(__dirname, filepath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Cache file missing: ${filepath}. Creating empty file...`);
      fs.writeFileSync(fullPath, JSON.stringify({}));
    } else {
      console.log(`✅ Cache file loaded: ${filepath}`);
    }
  }
}

ensureCacheFilesExist();




// 3. GOOGLE SHEETS AUTHENTICATION
// Setting up authentication to read data from Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS), // Credentials from environment (JSON format)
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] // Permission to read Sheets
});
const sheets = google.sheets({ version: "v4", auth }); // Creates a Sheets API client

// 4. EMAIL SETUP
// Configuring Nodemailer to send emails via Gmail
const transporter = nodemailer.createTransport({
  service: "gmail", // Using Gmail as the email service
  auth: { user: EMAIL_USER, pass: EMAIL_PASS } // Login credentials
});

// 5. MEAL PLANNING SECTION
// Defines meal plans and generates HTML for meal suggestions
const MEAL_BANK = [
  {
    name: "Plan A",
    meals: {
      breakfast: ["4 egg whites + 2 whole eggs scrambled", "1/2 cup black beans", "1 tsp olive oil for sautéing spinach"],
      lunch: ["6 oz grilled chicken breast", "1/2 cup lentils", "1 cup steamed broccoli", "1 tbsp vinaigrette"],
      dinner: ["6 oz lean sirloin steak", "1/2 cup roasted sweet potatoes", "1 cup green beans"],
      snack: ["1 scoop whey protein isolate", "1 tbsp almond butter"]
    },
    totals: { protein: 185, fat: 56, carbs: 110, calories: 1760 }, // Nutritional totals for the day
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

// Generates a random meal plan as an HTML string for email
function generateMealPlan() {
  const random = MEAL_BANK[Math.floor(Math.random() * MEAL_BANK.length)]; // Picks a random plan
  const { meals, totals, grocery } = random;
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
    - Fat: ${totals.fat}g<br>
    - Carbs: ${totals.carbs}g<br>
    - Calories: ~${totals.calories} kcal<br><br>
    🛒 <strong>Grocery List:</strong><br>
    ${grocery.map(item => `- ${item}`).join("<br>")}
  `.trim(); // Returns formatted HTML
}

// 6. GOOGLE SHEETS DATA FETCHING
// Functions to pull data (macros, weight, etc.) from Google Sheets
async function getAllMacrosFromSheet() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Macros!A2:I" // Fetches rows from A2 to column I in "Macros" tab
  });
  const rows = result.data.values || []; // Gets the data or empty array if none
  return rows.map(([date, protein, fat, carbs, calories, weight, steps, sleep, energy]) => ({
    date, protein, fat, carbs, calories, weight, steps, sleep, energy // Maps each row to an object
  })).filter(row => row.date && row.weight); // Filters out incomplete rows
}

async function getMacrosFromSheet() {
  const today = new Date();
  today.setDate(today.getDate() - 1); // Sets date to yesterday
  const targetDate = today.toISOString().split("T")[0]; // Formats as YYYY-MM-DD
  console.log("📅 Looking for macros dated:", targetDate);

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Macros!A2:I"
  });
  const rows = result.data.values || [];
  const row = rows.find(r => r[0]?.startsWith(targetDate)); // Finds yesterday's row
  return row ? { date: row[0], protein: row[1], fat: row[2], carbs: row[3], calories: row[4], weight: row[5], steps: row[6], sleep: row[7], energy: row[8] } : null;
}

// 7. WORKOUT PROCESSING AND ANALYSIS
// Functions to clean and analyze workout data
function sanitizeRoutine(routine) {
  // Cleans up routine data by removing unnecessary fields
  const cleanExercises = routine.exercises.map(({ index, title, created_at, id, user_id, ...rest }) => ({
    ...rest,
    sets: rest.sets.map(({ index, ...set }) => set) // Keeps only essential set data
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
        if (s.weight_kg != null && s.reps != null) exerciseMap[e.title].push(s); // Groups sets by exercise
      });
    });
  });

  const analysis = [];
  for (const [title, sets] of Object.entries(exerciseMap)) {
    const last3 = sets.slice(-3); // Takes last 3 sets for trend analysis
    const avgWeightKg = last3.reduce((sum, s) => sum + s.weight_kg, 0) / last3.length;
    const avgReps = last3.reduce((sum, s) => sum + s.reps, 0) / last3.length;
    const lastVolume = last3.map(s => s.weight_kg * s.reps); // Calculates volume (weight x reps)
    const suggestion = lastVolume.length >= 2 && lastVolume.at(-1) > lastVolume.at(-2)
      ? "⬆️ Increase weight slightly" // Suggests progression if volume increased
      : "➡️ Maintain weight / reps";
    analysis.push({ title, avgWeightLbs: (avgWeightKg * KG_TO_LBS).toFixed(1), avgReps: avgReps.toFixed(1), suggestion });
  }
  return analysis;
}

// 8. UTILITY FUNCTIONS
// Small helper functions for quotes and HTML generation
function getQuoteOfTheDay() {
  const quotes = [
    "You don’t have to be extreme, just consistent.",
    "Discipline is choosing between what you want now and what you want most.",
    "The only bad workout is the one that didn’t happen.",
    "Progress, not perfection.",
    "Sweat now, shine later."
  ];
  return quotes[new Date().getDate() % quotes.length]; // Picks a quote based on day of month
}

function generateHtmlSummary(workouts, macros, trainerInsights, todayTargetDay, quote) {
  // Builds the full HTML email content
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

// 9. API ENDPOINTS
// Routes for the Express server to handle requests
app.get("/", (req, res) => res.send("🏋️ CoachGPT Middleware is LIVE on port 10000")); // Root route (health check)

app.get("/debug", (req, res) => {
  res.send(`🔐 Render sees HEVY_API_KEY as: ${process.env.HEVY_API_KEY || 'undefined'}`); // Debug route for API key
});

app.get("/debug-workouts", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "workouts-30days.json"); // Path to workout data file
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "No workout data file found." });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ count: data.length, sample: data.slice(0, 2) }); // Returns workout count and sample
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const fetchAllRoutines = require('./fetchAllRoutines');

app.post('/refresh-routines', async (req, res) => {
  const result = await fetchAllRoutines();
  if (result.success) {
    res.json({ message: `✅ Routines refreshed (${result.count})` });
  } else {
    res.status(500).json({ error: 'Failed to refresh routines' });
  }
});


app.get("/debug-exercises", (req, res) => {
  const filePath = path.join(__dirname, "data", "exercise_templates.json");
  if (fs.existsSync(filePath)) {
    const contents = fs.readFileSync(filePath, "utf-8");
    res.type("json").send(contents); // Sends exercise templates as JSON
  } else {
    res.status(404).json({ error: "exercise_templates.json not found" });
  }
});

app.get("/refresh-exercises", async (req, res) => {
  try {
    const exercises = await fetchAllExercises(); // Fetches and updates exercise templates
    res.json({ success: true, count: exercises.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/fetch-all", async (req, res) => {
  try {
    const data = await fetchAllWorkouts(); // Fetches all workout data
    res.json({ message: "✅ Workouts fetched", count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/refresh-exercises", async (req, res) => {
  try {
    await fetchAllExercises();
    res.json({ message: "✅ Exercise templates refreshed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to refresh exercises" });
  }
});

app.post("/autoplan", async (req, res) => {
  try {
    const result = await autoplan(); // Runs the smart workout planner
    res.json(result);
  } catch (err) {
    console.error("Error in /autoplan:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/daily", async (req, res) => {
  try {
    console.log("⚡ /daily called from", new Date().toISOString());
    await fetchAllExercises(); // Syncs exercise data
    const recentWorkouts = await getYesterdaysWorkouts(); // Gets yesterday's workouts
    const isRestDay = recentWorkouts.length === 0;

    const macros = await getMacrosFromSheet(); // Fetches yesterday's macros
    if (!macros) return res.status(204).send(); // No data = no content

    const allMacros = await getAllMacrosFromSheet(); // Fetches all macro data for charts
    const chartBuffer = await generateWeightChart(allMacros);
    const stepsChart = await generateStepsChart(allMacros);
    const macrosChart = await generateMacrosChart(allMacros);
    const calorieChart = await generateCaloriesChart(allMacros);

    const trainerInsights = isRestDay ? [] : analyzeWorkouts(recentWorkouts); // Analyzes workouts if not a rest day

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
      updatedRoutines.push(routine.title); // Tracks updated routines
    }

    const lastDay = recentWorkouts.find(w => w.title.includes("Day"))?.title.match(/Day (\d+)/);
    const todayDayNumber = lastDay ? parseInt(lastDay[1]) + 1 : 1; // Advances day number

    const html = generateHtmlSummary(recentWorkouts, macros, trainerInsights, todayDayNumber > 7 ? 1 : todayDayNumber, getQuoteOfTheDay());

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

// 10. SERVER START
// Starts the Express server
(async () => {
  try {
    console.log("⏳ Priming cache...");
    await fetchAllExercises();
    await fetchAllWorkouts();
    await fetchAllRoutines();
    console.log("✅ All cache files ready.");
  } catch (err) {
    console.error("❌ Failed to initialize cache:", err.message || err);
  }
})();
app.listen(PORT, () => console.log("🏋️ CoachGPT Middleware is LIVE on port 10000"));
