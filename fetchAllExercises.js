const fs = require("fs");
const path = require("path");
const axios = require("axios");

const { HEVY_API_KEY } = process.env;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

async function fetchAllExercises() {
  try {
    console.log("🔁 Starting fetchAllExercises");

    const response = await axios.get(`${HEVY_API_BASE}/exercises`, {
      headers: { "api-key": HEVY_API_KEY },
    });

    console.log("✅ Exercise data received");
    const exercises = response.data.exercises;

    const filePath = path.join(__dirname, "data", "exercise_templates.json");
    fs.writeFileSync(filePath, JSON.stringify(exercises, null, 2));

    console.log(`✅ Wrote ${exercises.length} exercises to ${filePath}`);
  } catch (error) {
    console.error("❌ Failed to fetch exercises", error.message);
    throw error;
  }
}

module.exports = fetchAllExercises;
