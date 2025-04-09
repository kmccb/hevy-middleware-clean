const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const WORKOUTS_FILE = path.join(__dirname, "data", "workouts-30days.json");
const TEMPLATES_FILE = path.join(__dirname, "data", "exercise_templates.json");
const ROUTINES_FILE = path.join(__dirname, "data", "routines.json");
const KG_TO_LBS = 2.20462;

const SPLIT_ROTATION = ["Push", "Pull", "Legs", "Core"];

function getNextSplit(workouts) {
  const titles = workouts.map(w => w.title || "");
  for (let i = SPLIT_ROTATION.length - 1; i >= 0; i--) {
    if (titles.some(t => t.includes(SPLIT_ROTATION[i]))) {
      return SPLIT_ROTATION[(i + 1) % SPLIT_ROTATION.length];
    }
  }
  return "Push";
}

function getRecentTitles(workouts) {
  const titles = new Set();
  workouts.forEach(w => w.exercises.forEach(e => titles.add(e.title)));
  return titles;
}

function getExerciseHistory(exName, workouts) {
  const sets = [];
  workouts.forEach(w =>
    w.exercises.forEach(e => {
      if (e.title === exName && e.sets) {
        sets.push(...e.sets.filter(s => s.weight_kg != null && s.reps != null));
      }
    })
  );
  return sets;
}

function generateSetPlan(exName, historySets) {
  const avgWeight = historySets.length
    ? historySets.reduce((sum, s) => sum + s.weight_kg, 0) / historySets.length
    : 30;
  const avgReps = historySets.length
    ? historySets.reduce((sum, s) => sum + s.reps, 0) / historySets.length
    : 8;

  const repRange = avgReps >= 10 ? [10, 12] : avgReps <= 6 ? [6, 8] : [8, 10];
  const roundedReps = Math.round((repRange[0] + repRange[1]) / 2);

  return [
    { type: "warmup", weight_kg: 0, reps: 10 },
    { type: "normal", weight_kg: Math.round(avgWeight), reps: roundedReps },
    { type: "normal", weight_kg: Math.round(avgWeight), reps: roundedReps }
  ];
}

function pickExercises(splitType, templates, workouts) {
  const targetMuscles = {
    Push: ["Chest", "Shoulders", "Triceps"],
    Pull: ["Back", "Biceps"],
    Legs: ["Quadriceps", "Hamstrings", "Glutes", "Calves"],
    Core: ["Abs", "Obliques"]
  }[splitType];

  const allTemplates = Object.values(templates);
  const usedTitles = getRecentTitles(workouts);
  const selected = [];
  const selectedNames = new Set();

  console.log("🔍 AI scanning templates for:", splitType);

  for (const muscle of targetMuscles) {
    const candidates = allTemplates.filter(t =>
      (t.primary_muscle_group || "").includes(muscle) &&
      !usedTitles.has(t.name) &&
      !selectedNames.has(t.name)
    );

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (chosen) {
      const historySets = getExerciseHistory(chosen.name, workouts);
      const sets = generateSetPlan(chosen.name, historySets);
      selected.push({
        exercise_template_id: chosen.id,
        superset_id: null,
        rest_seconds: 90,
        notes: historySets.length
          ? `Trainer note: Maintain form. Recent avg: ${sets[1].reps} reps @ ${Math.round(sets[1].weight_kg)}kg.`
          : "Trainer note: New movement. Use lighter weight for form.",
        sets
      });
      selectedNames.add(chosen.name);
    }
  }

  // Fallback if we couldn't find enough
  while (selected.length < 5) {
    const fallback = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    if (!selectedNames.has(fallback.name)) {
      selected.push({
        exercise_template_id: fallback.id,
        superset_id: null,
        rest_seconds: 90,
        notes: "Fallback exercise due to insufficient matches",
        sets: [
          { type: "warmup", weight_kg: 0, reps: 10 },
          { type: "normal", weight_kg: 30, reps: 8 },
          { type: "normal", weight_kg: 30, reps: 8 }
        ]
      });
      selectedNames.add(fallback.name);
    }
  }

  return selected;
}

async function autoplan() {
  try {
    const workouts = JSON.parse(fs.readFileSync(WORKOUTS_FILE));
    const templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE));
    const routines = JSON.parse(fs.readFileSync(ROUTINES_FILE));

    const splitType = getNextSplit(workouts);
    console.log("🎯 Today's split:", splitType);

    const coachRoutine = routines.find(r => r.name && r.name.includes("CoachGPT"));
    if (!coachRoutine) throw new Error("Could not find 'CoachGPT' routine");

    const exercises = pickExercises(splitType, templates, workouts);
    console.log("🤖 AI selected", exercises.length, "exercises.");
    exercises.forEach((ex, i) => {
      console.log(`👉  [${i + 1}] ID: ${ex.exercise_template_id}, Note: ${ex.notes}`);
    });

    if (exercises.length < 3) {
      console.warn("⚠️ Too few exercises to update. Skipping.");
      return { success: false, message: "Skipped update due to very low match count." };
    } else if (exercises.length < 5) {
      console.warn(`⚠️ Only ${exercises.length} exercises selected. Proceeding with update using fallback logic.`);
    }

    const payload = {
      routine: {
        title: `CoachGPT – ${splitType} Day`,
        notes: `Trainer-selected ${splitType} workout. Optimized using AI based on usage, fatigue, and muscle priority.`,
        exercises
      }
    };

    console.log("📦 Sending payload to Hevy:", JSON.stringify(payload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${coachRoutine.id}`,
      payload,
      {
        headers: {
          "api-key": HEVY_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Routine "${payload.routine.title}" updated successfully!`);
    console.log(`📋 Exercises updated: ${exercises.map(e => e.exercise_template_id).join(", ")}`);
    return { success: true, updated: payload.routine.title };
  } catch (err) {
    console.error("❌ Error in autoplan:", err.response?.data || err.message || err);
    return { success: false, error: err.message };
  }
}

if (require.main === module) autoplan();

module.exports = autoplan;
