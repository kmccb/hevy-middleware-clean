// autoplan.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const WORKOUT_FILE = path.join(__dirname, 'data', 'workouts-30days.json');
const TEMPLATES_FILE = path.join(__dirname, 'data', 'exercise_templates.json');
const ROUTINE_FILE = path.join(__dirname, 'data', 'routines.json');

const HEVY_API_KEY = process.env.HEVY_API_KEY;

async function autoplan() {
  try {
    if (!HEVY_API_KEY) throw new Error("HEVY_API_KEY is not defined");

    const [exercises, recentWorkouts, routines] = [
      JSON.parse(fs.readFileSync(TEMPLATES_FILE)),
      JSON.parse(fs.readFileSync(WORKOUT_FILE)),
      JSON.parse(fs.readFileSync(ROUTINE_FILE))
    ];

    const allExercises = Object.values(exercises);
    const selectedExercises = allExercises.sort(() => 0.5 - Math.random()).slice(0, 5);

    // Find the routine ID by name (or fallback to first)
    const dailyRoutine = routines.find(r => r.name === "Daily Workout from CoachGPT") || routines[0];
    if (!dailyRoutine || !dailyRoutine.id) throw new Error("No valid routine ID found");

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
              { type: "working", weight: 50, reps: 8 }
            ]
          }))
        }
      ]
    };

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${dailyRoutine.id}`,
      routinePayload,
      { headers: { 'api-key': HEVY_API_KEY } }
    );

    console.log(`✅ Updated routine "${dailyRoutine.name}" (ID: ${dailyRoutine.id}) - Status:`, response.status);
  } catch (error) {
    console.error("❌ Error in autoplan:", error.message || error);
  }
}

if (require.main === module) autoplan();
module.exports = autoplan;
