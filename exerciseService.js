// exerciseService.js
const axios = require("axios");
const fs = require("fs");

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const EXERCISE_CACHE_FILE = "data/exercise_templates.json";
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

/**
 * Fetches all exercise templates from Hevy and saves them locally for reuse.
 */
async function fetchAllExercises() {
  const all = [];
  let page = 1;
  let done = false;

  while (!done) {
    const res = await axios.get(`${HEVY_API_BASE}/exercise_templates?page=${page}&pageSize=50`, {
      headers: { "api-key": HEVY_API_KEY }
    });

    const { exercise_templates, page_count } = res.data;
    all.push(...exercise_templates);

    if (page >= page_count) done = true;
    else page++;
  }

  fs.writeFileSync(EXERCISE_CACHE_FILE, JSON.stringify(all, null, 2));
  return all;
}

module.exports = { fetchAllExercises };
