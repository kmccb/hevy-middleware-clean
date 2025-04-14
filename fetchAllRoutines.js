// fetchAllRoutines.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const ROUTINE_FILE = path.join(__dirname, "data", "routines.json");

const fetchAllRoutines = async () => {
  try {
    const response = await axios.get("https://api.hevyapp.com/v1/routines", {
      headers: {
        "api-key": HEVY_API_KEY,
        "accept": "application/json",
      },
    });

    const rawRoutines = response.data.routines;

    const cleanRoutines = rawRoutines.map((r) => ({
      id: r.id,
      name: r.title || "Unnamed",
    }));

    fs.writeFileSync(ROUTINE_FILE, JSON.stringify(cleanRoutines, null, 2));
    console.log(`✅ Routines saved to routines.json (${cleanRoutines.length} total)`);

    return { success: true, count: cleanRoutines.length };
  } catch (err) {
    console.error("❌ Failed to fetch routines:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = fetchAllRoutines;
