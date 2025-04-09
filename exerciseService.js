const axios = require("axios");
const fs = require("fs");
const path = require("path");

const EXERCISES_FILE = path.join(__dirname, "data", "exercise_templates.json");

async function fetchExerciseTemplates() {
  try {
    const response = await axios.get("https://api.hevyapp.com/exercise-templates", {
      headers: {
        "api-key": process.env.HEVY_API_KEY,
      },
    });

    const templates = response.data;

    fs.writeFileSync(EXERCISES_FILE, JSON.stringify(templates, null, 2));
    console.log(`✅ Saved ${templates.length} exercise templates`);
    return templates;
  } catch (error) {
    console.error("❌ Error fetching exercise templates:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  fetchExerciseTemplates,
};
