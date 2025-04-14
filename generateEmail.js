// generateEmail.js

function generateHtmlSummary(
  recentWorkouts,
  macros,
  allMacros,
  trainerInsights,
  dayNumber,
  charts,
  todaysWorkout,
  quoteText,
  aiPlan = null,
  coachMessage = ""
) {
  let html = `
    <h2>🎯 Hevy Daily Summary – Day ${dayNumber}</h2>
    <p><strong>Date:</strong> ${macros.date}</p>
    <p><strong>Quote of the Day:</strong> <em>${quoteText}</em></p>
    <hr/>
  `;

  if (recentWorkouts.length > 0) {
    html += `<h3>✅ Yesterday's Workout(s)</h3><ul>`;
    recentWorkouts.forEach(w => {
      html += `<li><strong>${w.title}</strong> (${w.total_volume_kg.toLocaleString()} kg) – ${w.exercise_count} exercises</li>`;
    });
    html += `</ul>`;
  }

  html += `
    <h3>📊 Charts</h3>
    <img src="cid:weightChart" alt="Weight Chart"/><br/>
    <img src="cid:stepsChart" alt="Steps Chart"/><br/>
    <img src="cid:macrosChart" alt="Macros Chart"/><br/>
    <img src="cid:caloriesChart" alt="Calories Chart"/><br/>
  `;

  html += `<h3>🍽 Macros (Yesterday)</h3>
    <ul>
      <li><strong>Calories:</strong> ${macros.calories}</li>
      <li><strong>Protein:</strong> ${macros.protein}g</li>
      <li><strong>Carbs:</strong> ${macros.carbs}g</li>
      <li><strong>Fat:</strong> ${macros.fat}g</li>
    </ul>`;

  if (trainerInsights.length > 0) {
    html += `<h3>🧠 Trainer Insights</h3><ul>`;
    trainerInsights.forEach(i => {
      html += `<li>${i}</li>`;
    });
    html += `</ul>`;
  }

  if (aiPlan && aiPlan.exercises?.length >= 1) {
    html += `<h3>💡 Full AI CoachGPT Plan (${aiPlan.type})</h3><ul>`;
    aiPlan.exercises.forEach(ex => {
      html += `<li><strong>${ex.title}</strong><ul>`;
      ex.sets.forEach((set, i) => {
        html += `<li>Set ${i + 1}: ${set.reps || 'Hold'} reps @ ${set.weight_kg} kg, Tempo: ${set.tempo || set.duration_sec + " sec"}, Rest: ${set.rest_sec} sec</li>`;
      });
      html += `</ul><em>${ex.notes}</em></li>`;
    });
    html += `</ul>`;
  }

  if (coachMessage) {
    html += `<h3>🧠 CoachGPT Daily Guidance</h3><p><em>${coachMessage}</em></p>`;
  }

  return html;
}

module.exports = generateHtmlSummary;
