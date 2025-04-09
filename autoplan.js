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
  const titles = workouts.map(w => w.title);
  for (let i = SPLIT_ROTATION.length - 1; i >= 0; i--) {
    if (titles.find(t => t.includes(SPLIT_ROTATION[i]))) {
      return SPLIT_ROTATION[(i + 1) % SPLIT_ROTATION.length];
    }
  }
  return "Push"; // fallback
}

function generateSetPlan(historySets) {
  const avgWeight = historySets.length
    ? historySets.reduce((sum, s) => sum + (s.weight_kg || 0), 0) / historySets.length
    : 30;

  const avgReps = historySets.length
    ? historySets.reduce((sum, s) => sum + (s.reps || 8), 0) / historySets.length
    : 8;

  return [
    { type: "warmup", weight_kg: 0, reps: 10 },
    { type: "normal", weight_kg: Math.round(avgWeight), reps: Math.round(avgReps) },
    { type: "normal", weight_kg: Math.round(avgWeight), reps: Math.round(avgReps) }
  ];
}

function pickExercises(splitType, templates, workouts) {
  const usedRecently = new Set();
  workouts.forEach(w =>
    w.exercises.forEach(e => usedRecently.add(e.title))
  );

  const targets = {
    Push: ["Chest", "Shoulders", "Triceps"],
    Pull: ["Back", "Biceps"],
    Legs: ["Quadriceps", "Hamstrings", "Glutes", "Calves"],
    Core: ["Abs", "Obliques"]
  };

  const chosen = [];
  const titlesSeen = new Set();
  const allTemplates = Object.values(templates);

  for (const group of targets[splitType]) {
    const groupTemplates = allTemplates.filter(t =>
      (t.primary_muscle_group || "").includes(group) &&
      !usedRecently.has(t.name) &&
      !titlesSeen.has(t.name)
    );

    const pick = groupTemplates[Math.floor(Math.random() * groupTemplates.length)];
    if (pick) {
      titlesSeen.add(pick.name);

      const history = [];
      workouts.forEach(w =>
        w.exercises.forEach(e => {
          if (e.title === pick.name) history.push(...e.sets);
        })
      );

      const sets = generateSetPlan(history);
      const note = history.length
        ? `Maintain form. Avg load: ${(sets[1].weight_kg * KG_TO_LBS).toFixed(1)} lbs for ${sets[1].reps} reps.`
        : "New movement – focus on control and mind-muscle connection.";

      console.log(`🧠 Selected: ${pick.name} (${group}) — Reason: ${note}`);

      chosen.push({
        exercise_template_id: pick.id,
        superset_id: null,
        rest_seconds: 90,
        notes: note,
        sets
      });
    }
  }

  // Fallback if empty
  if (chosen.length === 0) {
    const fallback = allTemplates.slice(0, 3).map((t) => ({
      exercise_template_id: t.id,
      superset_id: null,
      rest_seconds: 90,
      notes: "Fallback exercise due to insufficient matches",
      sets: generateSetPlan([])
    }));
    console.warn("⚠️ No valid exercises found for split. Using fallback.");
    return fallback;
  }

  return chosen;
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
    if (!exercises.length) throw new Error("No exercises selected for the routine.");

    const payload = {
      routine: {
        title: `CoachGPT – ${splitType} Day`,
        notes: `Trainer-selected ${splitType} workout based on recent volume, split rotation, and muscle balance.`,
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
    return { success: true, updated: payload.routine.title };
  } catch (err) {
    console.error("❌ Error in autoplan:", err.response?.data || err.message || err);
    return { success: false, error: err.message };
  }
}

if (require.main === module) autoplan();

module.exports = autoplan;
