// cacheService.js
const fs = require("fs");
const path = require("path");

const cacheFiles = {
  workouts: "data/workouts-30days.json",
  templates: "data/exercise_templates.json",
  routines: "data/routines.json"
};

function ensureCacheFilesExist() {
  for (const [label, filepath] of Object.entries(cacheFiles)) {
    const fullPath = path.join(__dirname, filepath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Cache file missing: ${filepath}. Creating empty file...`);
      fs.writeFileSync(fullPath, JSON.stringify({}));
    } else {
      console.log(`✅ Cache file loaded: ${filepath}`);
    }
  }
}

module.exports = { ensureCacheFilesExist };
