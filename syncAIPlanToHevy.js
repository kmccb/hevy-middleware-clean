// syncAIPlanToHevy.js
const fs = require("fs");
const axios = require("axios");
const { default: moment } = require("moment");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const ROUTINES_FILE = "data/routines.json";
const EXERCISES_FILE = "data/exercise_templates.json";

async function syncAIPlanToHevy(todayPlan) {
  const allRoutines = JSON.parse(fs.readFileSync(ROUTINES_FILE));
  const allTemplates = JSON.parse(fs.readFileSync(EXERCISES_FILE));

  const routineTitle = `CoachGPT – ${todayPlan.type}`;

  // Match exercises to Hevy template IDs
  const exercisePayload = [];

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

    exercisePayload.push({
      exercise_id: match.id,
      title: match.title,
      sets: ex.sets.map(set => ({
        weight_kg: set.weight_kg,
        reps: set.reps,
        tempo: set.tempo,
        rest_sec: set.rest_sec
      })),
      note: ex.notes || ""
    });
  }

  if (exercisePayload.length < 1) {
    console.warn("❌ No valid exercises found to sync to Hevy.");
    return;
  }

  const existing = allRoutines.find(r => r.title === routineTitle);

  const payload = {
    title: routineTitle,
    updated_at: moment().toISOString(),
    routine: exercisePayload
  };

  if (existing) {
    const id = existing.id;
    console.log(`🔄 Found existing CoachGPT routine (ID: ${id}). Updating it.`);
    await axios.put(
      `https://publicapi.hevy.com/v1/routines/${id}`,
      payload,
      { headers: { Authorization: `Bearer ${HEVY_API_KEY}` } }
    );
    console.log(`✅ Routine updated: ${routineTitle}`);
  } else {
    console.log(`🆕 Creating new routine: ${routineTitle}`);
    const res = await axios.post(
      `https://publicapi.hevy.com/v1/routines`,
      payload,
      { headers: { Authorization: `Bearer ${HEVY_API_KEY}` } }
    );
    console.log(`✅ Routine created: ${res.data.title}`);
  }
}

module.exports = syncAIPlanToHevy;
