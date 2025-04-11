// analyzeTrends.js
const fs = require("fs");
const path = require("path");

const KG_TO_LBS = 2.20462;

/**
 * Reads the last 30 workouts from cache and analyzes trends.
 * Returns smart callouts like top muscle group volume increase or most improved lift.
 */
function analyzeTrends() {
  const filePath = path.join(__dirname, "data", "workouts-30days.json");
  if (!fs.existsSync(filePath)) return [];

  const workouts = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(workouts) || workouts.length === 0) return [];

  const exerciseStats = {}; // title => { dates: [], weight: [], reps: [], volume: [] }

  workouts.forEach(workout => {
    const date = workout.start_time?.split("T")[0];
    if (!workout.exercises || !Array.isArray(workout.exercises)) return;

    workout.exercises.forEach(ex => {
      if (!exerciseStats[ex.title]) {
        exerciseStats[ex.title] = { dates: [], weight: [], reps: [], volume: [] };
      }
      ex.sets.forEach(set => {
        const kg = set.weight_kg;
        const reps = set.reps;
        if (typeof kg === "number" && typeof reps === "number") {
          const lbs = kg * KG_TO_LBS;
          exerciseStats[ex.title].dates.push(date);
          exerciseStats[ex.title].weight.push(lbs);
          exerciseStats[ex.title].reps.push(reps);
          exerciseStats[ex.title].volume.push(lbs * reps);
        }
      });
    });
  });

  const trends = [];

  Object.entries(exerciseStats).forEach(([title, stats]) => {
    if (stats.weight.length < 2) return;
    const firstWeight = stats.weight[0];
    const lastWeight = stats.weight.at(-1);
    const change = lastWeight - firstWeight;

    if (Math.abs(change) >= 5) {
      trends.push({
        type: "weight",
        title,
        change,
        message: `${title} – up ${change.toFixed(1)} lbs over time`
      });
    }

    const firstVol = stats.volume[0];
    const lastVol = stats.volume.at(-1);
    const deltaVol = lastVol - firstVol;
    const volPct = (deltaVol / firstVol) * 100;

    if (Math.abs(volPct) > 15) {
      const dir = volPct > 0 ? "↑" : "↓";
      trends.push({
        type: "volume",
        title,
        change: volPct,
        message: `${title} volume ${dir} ${Math.abs(volPct).toFixed(0)}% since start`
      });
    }
  });

  return trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
}

module.exports = { analyzeTrends };
