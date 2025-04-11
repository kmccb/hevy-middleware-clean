// trainerUtils.js
// * Analyzes recent workouts to provide average weight, reps, and smart coaching feedback per exercise.
// This is the "Trainer Feedback" section of the email.

// Conversion constant: kilograms to pounds
const KG_TO_LBS = 2.20462;

/**
 
 * @param {Array} workouts - A list of workout objects containing exercises and their sets.
 * @returns {Array} analysis - List of exercise summaries with avg weight (lbs), reps, and coaching suggestion.
 */
function analyzeWorkouts(workouts) {
  const exerciseMap = {}; // Used to group all sets by exercise title

  // Build a map of exercise names to all valid sets (with weight + reps)
  workouts.forEach(w => {
    w.exercises.forEach(e => {
      if (!exerciseMap[e.title]) exerciseMap[e.title] = [];
      e.sets.forEach(s => {
        if (s.weight_kg != null && s.reps != null) {
          exerciseMap[e.title].push(s);
        }
      });
    });
  });

  const analysis = []; // Final summary list per exercise

  for (const [title, sets] of Object.entries(exerciseMap)) {
    const last3 = sets.slice(-3); // Take last 3 sets for this exercise

    // Compute average weight (kg) and average reps
    const avgWeightKg = last3.reduce((sum, s) => sum + s.weight_kg, 0) / last3.length;
    const avgReps = last3.reduce((sum, s) => sum + s.reps, 0) / last3.length;

    // Volume trend: weight × reps for each of the last 3 sets
    const lastVolume = last3.map(s => s.weight_kg * s.reps);

    // Coach-style suggestion:
    // - If volume increased recently, suggest bumping weight
    // - Else suggest holding steady
    const suggestion = lastVolume.length >= 2 && lastVolume.at(-1) > lastVolume.at(-2)
      ? "⬆️ Increase weight slightly"
      : "➡️ Maintain weight / reps";

    // Add final formatted result
    analysis.push({
      title,
      avgWeightLbs: (avgWeightKg * KG_TO_LBS).toFixed(1),
      avgReps: avgReps.toFixed(1),
      suggestion
    });
  }

  return analysis;
}

module.exports = { analyzeWorkouts };
