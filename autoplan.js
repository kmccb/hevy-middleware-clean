// autoplan.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DAILY_ROUTINE_ID = 'YOUR_DAILY_ROUTINE_ID_HERE'; // Replace with your real ID
const WORKOUT_FILE = path.join(__dirname, 'data', 'workouts-30days.json');
const TEMPLATES_FILE = path.join(__dirname, 'data', 'exercise_templates.json');

async function autoplan() {
  try {
    const exercises = JSON.parse(fs.readFileSync(TEMPLATES_FILE));
    const recentWorkouts = JSON.parse(fs.readFileSync(WORKOUT_FILE));

    // Select 5 exercises randomly for now
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
      `https://api.hevyapp.com/v1/routines/${DAILY_ROUTINE_ID}`,
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
