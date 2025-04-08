// fetchAllExercises.js
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
      const allTemplates = [];
      let page = 1;
      let done = false;
  
      while (!done) {
        const url = `${HEVY_API_BASE}/exercise_templates?page=${page}&pageSize=50`;
        const response = await axios.get(url, {
          headers: {
            "api-key": HEVY_API_KEY,
            Accept: "application/json"
          }
        });
  
        const { exercise_templates, page_count } = response.data;
        allTemplates.push(...exercise_templates);
  
        if (page >= page_count) done = true;
        else page++;
      }
  
      const dataDir = path.join(__dirname, "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }
  
      const filePath = path.join(dataDir, "exercise_templates.json");
      fs.writeFileSync(filePath, JSON.stringify(allTemplates, null, 2));
  
      console.log(`✅ Saved ${allTemplates.length} exercise templates to ${filePath}`);
      return allTemplates;
    } catch (err) {
      console.error("❌ Error fetching exercises:", err.response?.data || err.message);
      return [];
    }
  }
  
  module.exports = fetchAllExercises;
  
  if (require.main === module) {
    fetchAllExercises().then(data => {
      console.log(`🎯 Done. Pulled ${data.length} templates.`);
    });
  }
  