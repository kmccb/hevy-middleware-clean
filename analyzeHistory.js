// analyzeHistory.js
const fs = require("fs");
const path = require("path");

/**
 * Load and analyze past 30 days of workouts from file.
 * Returns an object per exercise with avg weight, reps, and recent trends.
 */
function analyzeWorkoutHistory() {
  const filePath = path.join(__dirname, "data", "workouts-30days.json");

  if (!fs.existsSync(filePath)) {
    console.error("❌ Workout history file not found.");
    return [];
  }

  const workouts = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const exerciseMap = {};

  workouts.forEach(workout => {
    workout.exercises.forEach(ex => {
      const name = ex.title;
      if (!exerciseMap[name]) {
        exerciseMap[name] = { weights: [], reps: [], sets: 0, count: 0 };
      }

      ex.sets.forEach(set => {
        if (set.weight_kg && set.reps) {
          const lbs = parseFloat(set.weight_kg) * 2.20462;
          exerciseMap[name].weights.push(lbs);
          exerciseMap[name].reps.push(set.reps);
          exerciseMap[name].sets++;
        }
      });

      exerciseMap[name].count++;
    });
  });

  const insights = Object.entries(exerciseMap).map(([title, data]) => {
    const avgWeight = average(data.weights);
    const avgReps = average(data.reps);
    return {
      title,
      count: data.count,
      totalSets: data.sets,
      avgWeightLbs: avgWeight.toFixed(1),
      avgReps: Math.round(avgReps),
    };
  });

  return insights;
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

module.exports = analyzeWorkoutHistory;
