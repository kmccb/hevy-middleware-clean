
// autoplan.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { HEVY_API_KEY } = process.env;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

// Load exercise templates from local cache
const exerciseTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "exercise_templates.json"), "utf-8"));

// Helper to load 30-day workouts
function loadWorkoutHistory() {
  const filePath = path.join(__dirname, "data", "workouts-30days.json");
  if (!fs.existsSync(filePath)) throw new Error("Workout history file not found.");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Helper to build a muscle group map from past workouts
function analyzeMuscleGroups(workouts) {
  const map = {};
  workouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      const title = ex.title.toLowerCase();
      if (title.includes("chest") || title.includes("shoulder") || title.includes("triceps")) {
        map["push"] = (map["push"] || 0) + 1;
      } else if (title.includes("back") || title.includes("biceps") || title.includes("row")) {
        map["pull"] = (map["pull"] || 0) + 1;
      } else if (title.includes("quad") || title.includes("hamstring") || title.includes("glute")) {
        map["legs"] = (map["legs"] || 0) + 1;
      } else if (title.includes("abs") || title.includes("core")) {
        map["core"] = (map["core"] || 0) + 1;
      }
    });
  });
  return map;
}

// Helper to select exercises intelligently
function selectExercises(group) {
  const groupMap = {
    push: ["Dumbbell Bench Press", "Overhead Press", "Incline Press", "Cable Triceps Pushdown"],
    pull: ["Lat Pulldown", "Seated Row", "Barbell Curl", "Face Pulls"],
    legs: ["Leg Press", "Walking Lunges", "Hamstring Curl", "Calf Raise"],
    core: ["Cable Crunch", "Plank", "Hanging Leg Raise"]
  };

  const selected = groupMap[group] || [];
  return selected
    .map(name => {
      const match = exerciseTemplates.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!match) return null;
      return {
        exercise_template_id: match.id,
        title: match.name,
        sets: [
          { weight_kg: 0, reps: 10 },
          { weight_kg: 0, reps: 10 },
          { weight_kg: 0, reps: 10 }
        ]
      };
    })
    .filter(Boolean);
}

async function autoplan() {
  const workouts = loadWorkoutHistory();
  const analysis = analyzeMuscleGroups(workouts);

  const fatigueSorted = Object.entries(analysis).sort((a, b) => a[1] - b[1]);
  const todayFocus = fatigueSorted[0][0]; // Least hit group
  const todayExercises = selectExercises(todayFocus);

  const routinePayload = {
    title: "Daily Workout from CoachGPT",
    exercises: todayExercises
  };

  // Upsert this as a routine in Hevy
  const allRoutines = await axios.get(`${HEVY_API_BASE}/routines`, {
    headers: { "api-key": HEVY_API_KEY }
  });

  const existing = allRoutines.data.routines.find(r => r.title === "Daily Workout from CoachGPT");
  if (existing) {
    await axios.put(`${HEVY_API_BASE}/routines/${existing.id}`, { routine: routinePayload }, {
      headers: {
        "api-key": HEVY_API_KEY,
        "Content-Type": "application/json"
      }
    });
  } else {
    await axios.post(`${HEVY_API_BASE}/routines`, { routine: routinePayload }, {
      headers: {
        "api-key": HEVY_API_KEY,
        "Content-Type": "application/json"
      }
    });
  }

  return {
    message: `✅ Generated new workout targeting ${todayFocus.toUpperCase()}`,
    title: routinePayload.title,
    focus: todayFocus,
    exerciseCount: todayExercises.length
  };
}

module.exports = autoplan;
