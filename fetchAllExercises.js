const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

async function fetchAllExercises() {
  try {
    const allExercises = [];
    for (let page = 1; page <= 5; page++) {
      const url = `${HEVY_API_BASE}/exercise-templates?page=${page}&pageSize=100`;
      const response = await axios.get(url, {
        headers: {
          "api-key": HEVY_API_KEY,
          Accept: "application/json"
        }
      });

      const pageExercises = response.data.exercise_templates || [];
      if (pageExercises.length === 0) break;
      allExercises.push(...pageExercises);
    }

    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    const filePath = path.join(dataDir, "exercise_templates.json");
    fs.writeFileSync(filePath, JSON.stringify(allExercises, null, 2));

    console.log(`✅ Saved ${allExercises.length} exercises to ${filePath}`);
    return allExercises;
  } catch (err) {
    console.error("❌ Error fetching exercise templates:", err.message || err);
    throw err;
  }
}

module.exports = fetchAllExercises;
