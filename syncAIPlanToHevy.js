// syncAIPlanToHevy.js
const fs = require("fs");
const axios = require("axios");
const moment = require("moment");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const ROUTINES_FILE = "data/routines.json";
const EXERCISES_FILE = "data/exercise_templates.json";

function validatePlan(plan) {
  if (!plan || !plan.todayPlan || !plan.todayPlan.exercises || plan.todayPlan.exercises.length < 4) return false;
  const sets = plan.todayPlan.exercises.flatMap(e => e.sets || []);
  if (sets.length < 16) return false;
  for (const s of sets) {
    const isHold = s.tempo === "hold" || s.duration_sec;
    const valid =
      (typeof s.reps === "number" || isHold) &&
      (typeof s.weight_kg === "number") &&
      (typeof s.tempo === "string" || isHold) &&
      (typeof s.rest_sec === "number");
    if (!valid) return false;
  }
  return true;
}

async function syncAIPlanToHevy(todayPlan) {
  if (!todayPlan || !todayPlan.exercises || todayPlan.exercises.length === 0) {
    console.warn("❌ No valid AI plan received. Skipping sync.");
    return;
  }

  const routineTitle = `CoachGPT – ${todayPlan.type} + Abs`;

  const allRoutines = JSON.parse(fs.readFileSync(ROUTINES_FILE));
  const allTemplates = JSON.parse(fs.readFileSync(EXERCISES_FILE));

  const exercises = [];

  for (const ex of todayPlan.exercises) {
    const match = allTemplates.find(t =>
      t.title.toLowerCase() === ex.title.toLowerCase() ||
      t.title.toLowerCase().includes(ex.title.toLowerCase()) ||
      ex.title.toLowerCase().includes(t.title.toLowerCase())
    );

    if (!match) {
      console.warn(`⚠️ Could not find match for: ${ex.title}. Skipping.`);
      continue;
    }

    exercises.push({
      exercise_template_id: match.id,
      superset_id: null,
      rest_seconds: ex.sets[0]?.rest_sec || 60,
      notes: ex.notes || "",
      sets: ex.sets.map(set => ({
        type: "normal",
        weight_kg: typeof set.weight_kg === "number" ? set.weight_kg : 0,
        reps: typeof set.reps === "number" ? set.reps : 1,
        distance_meters: null,
        duration_seconds: set.duration_sec || null,
        custom_metric: null
      }))
    });
  }

  if (exercises.length < 1) {
    console.warn("❌ No valid exercises found to sync to Hevy.");
    return;
  }
  console.log("🧠 Looking for routine titled:", routineTitle);
  console.log("📋 All routine titles:", allRoutines.map(r => r.name));
  
  const existing = allRoutines.find(r => r.name === routineTitle);

  const payload = {
    routine: {
      title: routineTitle,
      notes: "Generated by CoachGPT",
      exercises
    }
  };

  if (existing) {
    const id = existing.id;
    console.log(`🔄 Found existing CoachGPT routine (ID: ${id}). Updating it.`);
    try {
      await axios.put(
        `https://api.hevyapp.com/v1/routines/${id}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "accept": "application/json",
            "api-key": HEVY_API_KEY
          }
        }
      );
      console.log(`✅ Routine updated: ${routineTitle}`);
    } catch (err) {
      console.error("❌ Failed to update routine:", err.response?.data || err.message);
    }
  } else {
    console.warn(`❌ No routine found with title '${routineTitle}'. Skipping update to avoid accidental creation.`);
    return;
  }
}

module.exports = syncAIPlanToHevy;
