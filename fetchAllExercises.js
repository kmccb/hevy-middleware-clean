const axios = require("axios");
const fs = require("fs");
const path = require("path");

const EXERCISES_FILE = path.join(__dirname, "data", "exercise_templates.json");

async function fetchExerciseTemplates() {
  try {
    const response = await axios.get("https://api.hevyapp.com/v1/exercise-templates", {
      headers: {
        "api-key": process.env.HEVY_API_KEY,
      },
    });

    const templates = response.data;
    if (!Array.isArray(templates)) {
      console.error("❌ API response is not an array:", templates);
      throw new Error("Expected an array of exercise templates");
    }

    fs.writeFileSync(EXERCISES_FILE, JSON.stringify(templates, null, 2));
    console.log(`✅ Saved ${templates.length} exercise templates`);
    return templates;
  } catch (error) {
    console.error("❌ Error fetching exercise templates:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (fs.existsSync(EXERCISES_FILE)) {
      console.log("🔄 Falling back to cached exercise templates");
      return JSON.parse(fs.readFileSync(EXERCISES_FILE, "utf-8"));
    }

    throw error;
  }
}

module.exports = { fetchExerciseTemplates };