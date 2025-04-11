// generateEmail.js

/**
 * Formats a workout object into HTML for display in the email.
 * @param {Object} workout - A CoachGPT-generated workout object.
 * @returns {string} - HTML string of formatted workout.
 */
function formatWorkoutForEmail(workout) {
  if (!workout || !workout.exercises?.length) return "<p>No workout found.</p>";

  return `
    <h4>${workout.title || "CoachGPT Workout"}</h4>
    ` + workout.exercises.map(ex => {
    const sets = ex.sets.map(s => {
      if (s.duration_seconds) {
        return `🕒 ${s.duration_seconds}s hold`;
      } else if (s.weight_kg === 0 && !s.reps) {
        return "Bodyweight";
      } else if (s.weight_kg != null && s.reps != null) {
        return `${(s.weight_kg * 2.20462).toFixed(1)} lbs x ${s.reps}`;
      } else {
        return "–";
      }
    }).join(", ");

    return `<strong>${ex.title}</strong><br>Sets: ${sets}`;
  }).join("<br><br>");
}

/**
 * Builds the full HTML content for the daily summary email.
 * Includes workouts, macros, charts, feedback, and optional quote and workout plan.
 */
function generateHtmlSummary(
  workouts,
  macros,
  allMacrosData,
  trainerInsights,
  todayTargetDay,
  charts,
  todaysWorkout
) {
  const { weightChart, stepsChart, macrosChart, calorieChart } = charts;

  const weightChange = (() => {
    const validWeights = allMacrosData
      .map(m => parseFloat(m.weight))
      .filter(w => !isNaN(w));

    if (validWeights.length < 2) return null;

    const delta = validWeights.at(-1) - validWeights[0];
    const direction = delta < 0 ? "Down" : "Up";
    return `${direction} ${Math.abs(delta).toFixed(1)} lbs`;
  })();

  const workoutBlock = workouts.map(w => {
    const exBlocks = w.exercises.map(e => {
      const validSets = e.sets.filter(s => s.weight_kg != null && s.reps != null);
      if (!validSets.length) return null;
      const setSummary = validSets.map(s => `${(s.weight_kg * 2.20462).toFixed(1)} lbs x ${s.reps}`).join(", ");
      const note = trainerInsights.find(i => i.title === e.title)?.suggestion || "Maintain form and consistency";
      return `<strong>${e.title}</strong><br>Sets: ${setSummary}<br>Note: ${note}`;
    }).filter(Boolean).join("<br><br>");
    return `<h4>Workout: ${w.title}</h4>${exBlocks}`;
  }).join("<br><br>");

  const feedback = trainerInsights.length > 0
    ? trainerInsights.map(i => `• <strong>${i.title}</strong>: ${i.suggestion} (avg ${i.avgReps} reps @ ${i.avgWeightLbs} lbs)`).join("<br>")
    : "Rest day — no exercise trends to analyze. Use today to prepare for tomorrow’s push.";

  return `
    <h3>💪 Yesterday’s Workout Summary</h3>
    ${workoutBlock}<br><br>
    <hr>

    <h3>🥗 Macros – ${macros.date}</h3>
    <ul>
      <li><strong>Calories:</strong> ${macros.calories} kcal</li>
      <li><strong>Protein:</strong> ${macros.protein}g</li>
      <li><strong>Carbs:</strong> ${macros.carbs}g</li>
      <li><strong>Fat:</strong> ${macros.fat}g</li>
      <li><strong>Weight:</strong> ${macros.weight} lbs</li>
      <li><strong>Steps:</strong> ${macros.steps}</li>
    </ul>
    <hr>

    <h3>📉 Weight Trend (Last 30 Days) ${weightChange ? `– ${weightChange}!` : ""}</h3>
    <img src="cid:weightChart" alt="Weight chart"><br>
    <small>📊 30-day average: ${weightChart?.average || "N/A"} lbs</small><br><br>

    <h3>🚶 Steps Trend (Last 30 Days)</h3>
    <img src="cid:stepsChart" alt="Steps chart"><br>
    <small>📊 30-day average: ${stepsChart?.average || "N/A"} steps</small><br><br>

    <h3>🍳 Macro Trend (Last 30 Days)</h3>
    <img src="cid:macrosChart" alt="Macros chart"><br>
    <small>📊 Avg Protein: ${macrosChart?.average?.protein || "N/A"}g, Carbs: ${macrosChart?.average?.carbs || "N/A"}g, Fat: ${macrosChart?.average?.fat || "N/A"}g</small><br><br>

    <h3>🔥 Calorie Trend (Last 30 Days)</h3>
    <img src="cid:caloriesChart" alt="Calories chart"><br>
    <small>📊 30-day average: ${calorieChart?.average || "N/A"} kcal</small><br><br>
    <hr>

    <h3>🧠 Trainer Feedback</h3>${feedback}<br><br>

    <h3>📅 What’s Next</h3>
    Today is <strong>Day ${todayTargetDay}</strong>. Focus on:<br>
    - Intentional form<br>
    - Progressive overload<br>
    - Core tension & recovery<br><br>
    <hr>

    <h3>🏋️ Today’s CoachGPT Workout</h3>
    ${formatWorkoutForEmail(todaysWorkout)}<br><br>

    Keep it up — I’ve got your back.<br>– CoachGPT
  `;
}

module.exports = generateHtmlSummary;
