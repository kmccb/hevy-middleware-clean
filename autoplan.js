const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const TEMPLATES_FILE = path.join(__dirname, "data", "exercise_templates.json");
const ROUTINES_FILE = path.join(__dirname, "data", "routines.json");
const WORKOUTS_FILE = path.join(__dirname, "data", "workouts-30days.json");

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

function generateSetPlan(historySets) {
  if (!historySets.length) {
    return [
      { type: "warmup", weight_kg: 0, reps: 10 },
      { type: "normal", weight_kg: 30, reps: 8 },
      { type: "normal", weight_kg: 30, reps: 8 }
    ];
  }

  const lastSet = historySets.at(-1);
  const priorSet = historySets.length > 1 ? historySets.at(-2) : lastSet;

  const volLast = lastSet.weight_kg * lastSet.reps;
  const volPrior = priorSet.weight_kg * priorSet.reps;
  const overload = volLast > volPrior;

  const newWeight = overload ? lastSet.weight_kg + 2.5 : lastSet.weight_kg;
  const newReps = overload ? lastSet.reps : Math.max(6, Math.min(12, lastSet.reps));

  return [
    { type: "warmup", weight_kg: 0, reps: 10 },
    { type: "normal", weight_kg: Math.round(newWeight), reps: newReps },
    { type: "normal", weight_kg: Math.round(newWeight), reps: newReps }
  ];
}

function pickExercises(split, templates, workouts) {
  // ✅ LOG: Starting trainer logic
  console.log("🧠 Trainer logic activated for split:", split);

  const recentTitles = getRecentTitles(workouts);
  const usedNames = new Set();

  const muscleTargets = {
    Push: ["Chest", "Shoulders", "Triceps"],
    Pull: ["Back", "Biceps"],
    Legs: ["Quadriceps", "Hamstrings", "Glutes", "Calves"],
    Core: ["Abs", "Obliques"]
  };

  const selected = [];
  const allTemplates = Object.values(templates);

  for (const muscle of muscleTargets[split]) {
    // ✅ LOG: Muscle group being evaluated
    console.log(`🔍 Evaluating templates for muscle: ${muscle}`);

    const groupMatches = allTemplates.filter(t =>
      (t.primary_muscle_group || "").includes(muscle) &&
      !recentTitles.has(t.name) &&
      !usedNames.has(t.name)
    );

    // ✅ LOG: How many matches found for the muscle group
    console.log(`📊 Found ${groupMatches.length} available templates for ${muscle}`);

    const pick = groupMatches[Math.floor(Math.random() * groupMatches.length)];
    if (pick) {
      usedNames.add(pick.name);

      const history = getExerciseHistory(pick.name, workouts);
      const sets = generateSetPlan(history);
      const note = history.length
        ? `Trainer: Progressive load based on past ${history.length} sets.`
        : `Trainer: New movement, start moderate and build.`;

      // ✅ LOG: What was selected and why
      console.log(`✅ Selected: ${pick.name} (Muscle: ${muscle}) | History sets: ${history.length}`);

      selected.push({
        exercise_template_id: pick.id,
        superset_id: null,
        rest_seconds: 90,
        notes: note,
        sets
      });
    } else {
      // ✅ LOG: No match for this muscle group
      console.warn(`⚠️ No suitable template found for muscle: ${muscle}`);
    }
  }

  // ✅ LOG: Summary of selection
  console.log(`🏁 Trainer logic complete. Total selected: ${selected.length} exercises.`);

  return selected;
}

  // Fallback
  while (selected.length < 5) {
    const fallback = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    if (!usedNames.has(fallback.name)) {
      selected.push({
        exercise_template_id: fallback.id,
        superset_id: null,
        rest_seconds: 90,
        notes: "Fallback exercise due to insufficient history",
        sets: [
          { type: "warmup", weight_kg: 0, reps: 10 },
          { type: "normal", weight_kg: 30, reps: 8 },
          { type: "normal", weight_kg: 30, reps: 8 }
        ]
      });
      usedNames.add(fallback.name);
    }
  }

  return selected;
}

async function autoplan() {
  try {
    const workouts = JSON.parse(fs.readFileSync(WORKOUTS_FILE));
    const templates = JSON.parse(fs.readFileSync(TEMPLATES_FILE));
    const routines = JSON.parse(fs.readFileSync(ROUTINES_FILE));

const split = getNextSplit(workouts);
console.log("🎯 Next split:", split);

// Add debug BEFORE
console.log("🔍 Calling pickExercises with:", split);

const selected = pickExercises(split, templates, workouts);

// Add debug AFTER
console.log("✅ pickExercises returned", selected.length, "exercises");

if (!selected.length) {
  console.warn("⚠️ No exercises selected. Skipping update.");
  return;
}

    const routine = routines.find(r => r.name && r.name.toLowerCase().includes("coachgpt"));
    if (!routine) throw new Error("Routine 'CoachGPT' not found");

    const payload = {
      routine: {
        title: `CoachGPT – ${split} Day`,
        notes: `Trainer-crafted ${split} day with progressive overload and fatigue-aware targeting.`,
        exercises: selected
      }
    };

    console.log("📦 Final payload:", JSON.stringify(payload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routine.id}`,
      payload,
      {
        headers: {
          "api-key": HEVY_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Routine updated successfully!", response.status);
    return { success: true };
  } catch (err) {
    console.error("❌ Autoplan failed:", err.response?.data || err.message);
    return { success: false };
  }
}


if (require.main === module) autoplan();
module.exports = autoplan;
