if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
  }
  
  const axios = require("axios");
  const fs = require("fs");
  const path = require("path");
  
  const HEVY_API_KEY = process.env.HEVY_API_KEY;
  const HEVY_API_BASE = "https://api.hevyapp.com/v1";
  
  async function fetchAllExercises() {
    try {
      const url = `${HEVY_API_BASE}/exercises`;
      const response = await axios.get(url, {
        headers: {
          "api-key": HEVY_API_KEY,
          Accept: "application/json"
        }
      });
  
      const exercises = response.data.exercises || [];
  
      const dataDir = path.join(__dirname, "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }
  
      const filePath = path.join(dataDir, "exercise_templates.json");
      fs.writeFileSync(filePath, JSON.stringify(exercises, null, 2));
  
      console.log(`✅ Saved ${exercises.length} exercises to ${filePath}`);
      return exercises;
    } catch (err) {
      console.error("❌ Error fetching exercises:", err.response?.data || err.message);
      return [];
    }
  }
  
  module.exports = fetchAllExercises;
  
  if (require.main === module) {
    fetchAllExercises().then(data => {
      console.log(`🎯 Done. Pulled ${data.length} exercises.`);
    });
  }
  