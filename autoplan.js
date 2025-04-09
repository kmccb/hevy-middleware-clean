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
    const exercises = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
    const recentWorkouts = JSON.parse(fs.readFileSync(WORKOUT_FILE, 'utf8'));
    const routines = JSON.parse(fs.readFileSync(ROUTINES_FILE, 'utf8'));

    const allExercises = Object.values(exercises);
    const selectedExercises = allExercises.sort(() => 0.5 - Math.random()).slice(0, 5);

    const routinePayload = {
      name: "Daily Workout from CoachGPT",
      days: [
        {
          name: "Today",
          exercises: selectedExercises.map((ex) => ({
            exercise_template_id: ex.id,
            sets: [
              { type: "warmup", weight: 0, reps: 10 },
              { type: "working", weight: 50, reps: 8 },
              { type: "working", weight: 50, reps: 8 },
            ],
          })),
        },
      ],
    };

    const routineId =
      DAILY_ROUTINE_ID ||
      Object.values(routines).find((r) => typeof r.name === "string" && r.name.includes("CoachGPT"))?.id;

    if (!routineId) throw new Error("No routine ID found");

    console.log("➡️ Routine ID:", routineId);
    console.log("📦 Payload:", JSON.stringify(routinePayload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routineId}`,
      routinePayload,
      { headers: { 'api-key': HEVY_API_KEY } }
    );

    console.log("✅ Routine updated:", response.status);
  } catch (error) {
    console.error("❌ Error in autoplan:", error.response?.data || error.message || error);
  }
}

if (require.main === module) autoplan();

module.exports = autoplan;
