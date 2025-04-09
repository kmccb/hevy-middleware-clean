// src/autoplan.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const WORKOUT_FILE = path.join(__dirname, 'data', 'workouts-30days.json');
const TEMPLATES_FILE = path.join(__dirname, 'data', 'exercise_templates.json');
const ROUTINES_FILE = path.join(__dirname, 'data', 'routines.json');

const HEVY_API_KEY = process.env.HEVY_API_KEY;

async function autoplan() {
  try {
    if (!HEVY_API_KEY) throw new Error("HEVY_API_KEY is not defined");

    const recentWorkouts = JSON.parse(fs.readFileSync(WORKOUT_FILE, 'utf-8'));
    const exercises = JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
    const routines = JSON.parse(fs.readFileSync(ROUTINES_FILE, 'utf-8'));

    const routineId = routines?.[0]?.id;
    if (!routineId) throw new Error("No routine ID found in cached routines");

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

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routineId}`,
      routinePayload,
      { headers: { 'api-key': HEVY_API_KEY } }
    );

    console.log("✅ Routine updated:", response.status);
  } catch (error) {
    console.error("❌ Error in autoplan:", error.message || error);
  }
}

if (require.main === module) autoplan();

module.exports = autoplan;
