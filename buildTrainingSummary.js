// buildTrainingSummary.js
const fs = require("fs");
const path = require("path");
const moment = require("moment");

const WORKOUTS_FILE = path.join(__dirname, "data/workouts-30days.json");
const OUTPUT_FILE = path.join(__dirname, "data/training_summary.json");

async function buildTrainingSummary() {
  const workouts = JSON.parse(fs.readFileSync(WORKOUTS_FILE));

  const summary = {
    totalWorkouts: workouts.length,
    frequency: {},
    muscleVolume: {},
    muscleFrequency: {},
    topExercises: {},
    recentTypes: [],
    recentDates: []
  };

  workouts.forEach(w => {
    const date = moment(w.date || w.start_time);
    const type = w.title.split("–")[0].trim();
    summary.frequency[type] = (summary.frequency[type] || 0) + 1;
    summary.recentTypes.push(w.title);
    summary.recentDates.push(date.format("YYYY-MM-DD"));

    w.exercises.forEach(ex => {
      const muscle = ex.primary_muscle_group?.toLowerCase() || "unknown";
      summary.muscleVolume[muscle] = (summary.muscleVolume[muscle] || 0) + (ex.sets || 3);
      summary.muscleFrequency[muscle] = (summary.muscleFrequency[muscle] || 0) + 1;

      const key = ex.title;
      summary.topExercises[key] = (summary.topExercises[key] || 0) + 1;
    });
  });

  // Trim top exercises to top 25
  summary.topExercises = Object.entries(summary.topExercises)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([title, count]) => title);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(summary, null, 2));
  console.log("✅ Training summary saved to:", OUTPUT_FILE);
}

await buildTrainingSummary();

