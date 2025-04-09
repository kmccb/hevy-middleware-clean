const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const DAILY_ROUTINE_ID = process.env.DAILY_ROUTINE_ID;

const WORKOUT_FILE = path.join(__dirname, 'data', 'workouts-30days.json');
const TEMPLATES_FILE = path.join(__dirname, 'data', 'exercise_templates.json');
const ROUTINES_FILE = path.join(__dirname, 'data', 'routines.json');

async function autoplan() {
  try {
    console.log("🔁 Running autoplan..."); process.stdout.write('\n');

    // Check API key first
    if (!HEVY_API_KEY) throw new Error("HEVY_API_KEY is not defined");

    // Load and log cache
    const exercises = JSON.parse(fs.readFileSync(TEMPLATES_FILE));
    const routines = JSON.parse(fs.readFileSync(ROUTINES_FILE));
    const workouts = JSON.parse(fs.readFileSync(WORKOUT_FILE));

    console.log(`📦 Loaded ${Object.keys(exercises).length} exercises`);
    console.log(`📦 Loaded ${routines.length} routines`);
    console.log(`📦 Loaded ${workouts.length} recent workouts`);

    // Pick 5 random exercises
    const selectedExercises = Object.values(exercises)
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    console.log("🎯 Selected exercises:");
    selectedExercises.forEach(e => console.log(`- ${e.name}`));

    // Build sets
    const exerciseBlocks = selectedExercises.map((ex) => ({
      exercise_template_id: ex.id,
      supersets: [],
      rest_period: null,
      notes: null,
      sets: [
        { type: "warmup", weight: 0, reps: 10 },
        { type: "working", weight: 50, reps: 8 },
        { type: "working", weight: 50, reps: 8 },
      ],
    }));

    // Try matching a routine
    const routineId = DAILY_ROUTINE_ID || routines.find(r => r.title?.toLowerCase().includes("coachgpt"))?.id;
    if (!routineId) {
      console.error("❌ No routine ID found. Aborting.");
      return;
    }

    console.log("✅ Updating routine ID:", routineId);

    const payload = {
      routine: {
        title: "CoachGPT",
        notes: "Auto-generated from workout history 💪",
        exercises: exerciseBlocks,
      }
    };

    console.log("📤 Sending payload to Hevy API...");
    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routineId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': HEVY_API_KEY,
        }
      }
    );

    console.log("✅ Routine updated! Status:", response.status);
  } catch (error) {
    console.error("❌ Error in autoplan:", error.response?.data || error.message || error);
  }
}

if (require.main === module) autoplan();
module.exports = autoplan;
