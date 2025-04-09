const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const WORKOUTS_FILE = path.join(__dirname, "data", "workouts-30days.json");
const TEMPLATES_FILE = path.join(__dirname, "data", "exercise_templates.json");
const ROUTINES_FILE = path.join(__dirname, "data", "routines.json");
const KG_TO_LBS = 2.20462;

// Define split rotation
const SPLIT_ROTATION = ["Push", "Pull", "Legs", "Core"];

function getNextSplit(workouts) {
  const titles = workouts.map(w => w.title);
  for (let i = SPLIT_ROTATION.length - 1; i >= 0; i--) {
    if (titles.find(t => t.includes(SPLIT_ROTATION[i]))) {
      return SPLIT_ROTATION[(i + 1) % SPLIT_ROTATION.length];
    }
  }
  return "Push";
}

function groupUsage(workouts) {
  const usage = {};
  workouts.forEach(w => {
    w.exercises.forEach(e => {
      const group = e.primary_muscle_group || "Unknown";
      usage[group] = (usage[group] || 0) + 1;
    });
  });
  return usage;
}

function findHistoricalSets(workouts, name) {
  const sets = [];
  workouts.forEach(w =>
    w.exercises.forEach(e => {
      if (e.title === name) sets.push(...e.sets);
    })
  );
  return sets;
}

function generateSetPlan(historySets) {
  if (!historySets.length) {
    return [
      { type: "warmup", weight_kg: 0, reps: 10 },
      { type: "normal", weight_kg: 30, reps: 8 },
      { type: "normal", weight_kg: 30, reps: 8 },
    ];
  }

  const avgWeight = historySets.reduce((sum, s) => sum + (s.weight_kg || 0), 0) / historySets.length;
  const avgReps = historySets.reduce((sum, s) => sum + (s.reps || 8), 0) / historySets.length;
  const latest = historySets.slice(-3);
  const volumes = latest.map(s => s.weight_kg * s.reps);
  const trendingUp = volumes.length >= 2 && volumes[2] > volumes[1];

  return [
    { type: "warmup", weight_kg: 0, reps: 10 },
    {
      type: "normal",
      weight_kg: Math.round(trendingUp ? avgWeight + 2.5 : avgWeight),
      reps: Math.round(avgReps),
    },
    {
      type: "normal",
      weight_kg: Math.round(trendingUp ? avgWeight + 2.5 : avgWeight),
      reps: Math.round(avgReps),
    },
  ];
}

function pickExercises(splitType, templates, workouts) {
  const usedRecently = new Set();
  workouts.forEach(w => w.exercises.forEach(e => usedRecently.add(e.title)));

  const splitTargets = {
    Push: ["Chest", "Shoulders", "Triceps"],
    Pull: ["Back", "Biceps"],
    Legs: ["Quadriceps", "Hamstrings", "Glutes", "Calves"],
    Core: ["Abs", "Obliques"],
  };

  const groupPriority = groupUsage(workouts);
  const templatesList = Object.values(templates);

  const selected = [];

  for (const target of splitTargets[splitType]) {
    const options = templatesList.filter(t =>
      (t.primary_muscle_group || "").includes(target) &&
      !usedRecently.has(t.name)
    );

    const sorted = options.sort((a, b) => {
      const aFreq = groupPriority[a.primary_muscle_group] || 0;
      const bFreq = groupPriority[b.primary_muscle_group] || 0;
      return aFreq - bFreq;
    });

    const chosen = sorted[0] || templatesList[Math.floor(Math.random() * templatesList.length)];
    const history = findHistoricalSets(workouts, chosen.name);
    const sets = generateSetPlan(history);
    const note = history.length
      ? "Trainer selected based on recovery window and progression trend."
      : "New movement introduced — build foundational control.";

    selected.push({
      exercise_template_id: chosen.id,
      superset_id: null,
      rest_seconds: 90,
      notes: history.length ? note : "Fallback exercise due to insufficient matches",
      sets,
    });
  }

  return selected.length ? selected : fallbackExercises(templatesList);
}

function fallbackExercises(templatesList) {
  const picks = templatesList.sort(() => 0.5 - Math.random()).slice(0, 3);
  return picks.map(ex => ({
    exercise_template_id: ex.id,
    superset_id: null,
    rest_seconds: 90,
    notes: "Fallback exercise due to insufficient matches",
    sets: [
      { type: "warmup", weight_kg: 0, reps: 10 },
      { type: "normal", weight_kg: 30, reps: 8 },
      { type: "normal", weight_kg: 30, reps: 8 },
    ],
  }));
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
    if (!exercises.length) throw new Error("❌ No valid exercises selected for this split.");

    const payload = {
      routine: {
        title: `CoachGPT – ${splitType} Day`,
        notes: `Trainer-selected ${splitType} workout. Optimized using AI based on usage, fatigue, and muscle priority.`,
        exercises,
      },
    };

    console.log("📦 Sending payload to Hevy:", JSON.stringify(payload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${coachRoutine.id}`,
      payload,
      {
        headers: {
          "api-key": HEVY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Routine "${payload.routine.title}" updated successfully!`);
    return { success: true, updated: payload.routine.title };
  } catch (err) {
    console.error("❌ Error in autoplan:", err.response?.data || err.message || err);
    return { success: false, error: err.message };
  }
}

if (require.main === module) autoplan();
module.exports = autoplan;
