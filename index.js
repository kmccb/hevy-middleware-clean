// 1. MODULE IMPORTS
const express = require("express"); // Web server framework
const axios = require("axios"); // For making HTTP requests (e.g., to Hevy API)
const fs = require("fs"); // File system access (reading/writing files)
const path = require("path"); // Helps build file paths across operating systems
const fetchAllExercises = require("./exerciseService"); // Custom function to fetch exercise templates
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts"); // Gets yesterday's workout data
const { generateWeightChart, generateStepsChart, generateMacrosChart, generateCaloriesChart } = require("./chartService"); // Chart generation functions
const fetchAllWorkouts = require("./fetchAllWorkouts"); // Fetches all workout history
const analyzeWorkoutHistory = require("./analyzeHistory"); // Analyzes workout trends
const runDailySync = require("./runDailySync"); // Generates Daily Email
const autoplan = require("./autoplan"); // Smart workout planner
const { sanitizeRoutine } = require("./trainerUtils");
const { getQuoteOfTheDay } = require("./quoteUtils");


// 2. CONSTANTS AND CONFIGURATION
const app = express(); // Creates an Express app instance
app.use(express.json()); // Middleware to parse JSON request bodies
const PORT = process.env.PORT || 10000; // Server port (defaults to 10000 if not set in environment)
const HEVY_API_KEY = process.env.HEVY_API_KEY; // API key for Hevy (stored in environment variables for security)
const HEVY_API_BASE = "https://api.hevyapp.com/v1"; // Base URL for Hevy API
const EMAIL_USER = "tomscott2340@gmail.com"; // Email address for sending reports
const EMAIL_PASS = process.env.EMAIL_PASS; // Email password (stored in environment variables)
const KG_TO_LBS = 2.20462; // Conversion factor from kilograms to pounds

// Startup Cache Loader Section
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

(async function startServer() {
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


// 9. API ENDPOINTS
app.get("/", (req, res) => res.send("🏋️ CoachGPT Middleware is LIVE on port 10000"));

app.get("/debug", (req, res) => {
  res.send(`🔐 Render sees HEVY_API_KEY as: ${process.env.HEVY_API_KEY || 'undefined'}`);
});

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
    res.type("json").send(contents);
  } else {
    res.status(404).json({ error: "exercise_templates.json not found" });
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

app.post("/fetch-all", async (req, res) => {
  try {
    const data = await fetchAllWorkouts();
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

app.post('/autoplan', async (req, res) => {
  try {
    console.log('⚡ /autoplan called from', new Date().toISOString());
    const workouts = await fetchWorkouts();
    const templates = await fetchExerciseTemplates();
    const routines = await fetchRoutines();
    console.log('🔁 Running autoplan...');
    const result = await autoplan({ workouts, templates, routines });
    if (result.success) {
      res.json({ message: `${result.message}`, workout: result.routine });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    console.error('❌ Error in /autoplan:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/daily", async (req, res) => {
  try {
    console.log("⚡ /daily called from", new Date().toISOString());
    await runDailySync();
    res.status(200).json({ message: "✅ Daily sync complete" });
  } catch (error) {
    console.error("Daily sync error:", error.message);
    res.status(500).json({ error: `Daily sync failed: ${error.message}` });
  }
});

// 10. SERVER START
(async () => {
  try {
    console.log("⏳ Priming cache...");
    await fetchAllExercises();
    await fetchAllWorkouts();
    await fetchAllRoutines();
    console.log("✅ All cache files ready.");

    // Optional: Run the daily sync immediately at startup
    await runDailySync();

    // Start server only after everything is ready
    app.listen(PORT, () => {
      console.log(`🏋️ CoachGPT Middleware is LIVE on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Startup failed:", err.message || err);
    process.exit(1); // Exit with failure so Render can restart if needed
  }
})();
