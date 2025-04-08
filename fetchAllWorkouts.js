// fetchAllWorkouts.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

async function fetchAllWorkouts() {
  try {
    const allWorkouts = [];

    for (let page = 1; page <= 3; page++) {
      const url = `${HEVY_API_BASE}/workouts?page=${page}&pageSize=10`;
      const response = await axios.get(url, {
        headers: {
          "api-key": HEVY_API_KEY,
          Accept: "application/json"
        }
      });

      const workouts = response.data.workouts || [];
      if (workouts.length === 0) break;

      allWorkouts.push(...workouts);
    }

    // 🛠 Ensure the data directory exists
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }

    // 💾 Save to disk
    const filePath = path.join(dataDir, "workouts-30days.json");
    fs.writeFileSync(filePath, JSON.stringify(allWorkouts, null, 2));

    console.log(`✅ Saved ${allWorkouts.length} workouts to ${filePath}`);
    return allWorkouts;
  } catch (err) {
    console.error("❌ Error fetching workouts:", err.response?.data || err.message);
    return [];
  }
}

module.exports = fetchAllWorkouts;
