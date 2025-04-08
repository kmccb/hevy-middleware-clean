// analyzeTrainerFeedback.js

/**
 * Analyzes workout data and provides trainer-style feedback.
 * Returns an array of objects with avg weight, reps, and a suggestion.
 */
function generateTrainerFeedback(workouts, KG_TO_LBS = 2.20462) {
    const exerciseMap = {};
  
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
  
    const feedback = [];
  
    for (const [title, sets] of Object.entries(exerciseMap)) {
      const last3 = sets.slice(-3);
      if (last3.length === 0) continue;
  
      const avgWeightKg = last3.reduce((sum, s) => sum + s.weight_kg, 0) / last3.length;
      const avgReps = last3.reduce((sum, s) => sum + s.reps, 0) / last3.length;
      const lastVolume = last3.map(s => s.weight_kg * s.reps);
      const suggestion =
        lastVolume.length >= 2 && lastVolume.at(-1) > lastVolume.at(-2)
          ? "⬆️ Increase weight slightly"
          : "➡️ Maintain weight / reps";
  
      feedback.push({
        title,
        avgWeightLbs: (avgWeightKg * KG_TO_LBS).toFixed(1),
        avgReps: avgReps.toFixed(1),
        suggestion
      });
    }
  
    return feedback;
  }
  
  module.exports = { generateTrainerFeedback };
  