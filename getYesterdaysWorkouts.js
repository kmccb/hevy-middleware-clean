// getYesterdaysWorkouts.js
const axios = require("axios");
const fs = require("fs");

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const HEVY_API_BASE = "https://api.hevyapp.com/v1";

/**
 * Fetches workouts from the Hevy API and filters only those from yesterday.
 * These are used to generate the daily report and training feedback.
 */
async function getYesterdaysWorkouts() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

  const res = await axios.get(`${HEVY_API_BASE}/workouts?limit=50`, {
    headers: { "api-key": HEVY_API_KEY }
  });

  const workouts = res.data.workouts || [];

  const filtered = workouts.filter(w => {
    return w.start_time >= startOfDay && w.start_time <= endOfDay;
  });

  // Optionally save for debugging or later use
  fs.writeFileSync("yesterdaysWorkouts.json", JSON.stringify(filtered, null, 2));

  return filtered;
}

module.exports = { getYesterdaysWorkouts };
