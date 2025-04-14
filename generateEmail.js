// generateEmail.js

/**
 * Builds the full HTML content for the daily summary email.
 * Includes workouts, macros, charts, feedback, and a motivational quote.
 */

/**
 * Formats a workout object into HTML for display in the email.
 * @param {Object} workout - A CoachGPT-generated workout object.
 * @returns {string} - HTML string of formatted workout.
 */
function formatWorkoutForEmail(workout) {
  if (!workout || !workout.exercises?.length) return "<p>No workout found.</p>";

  const exerciseCells = workout.exercises.map(ex => {
    const sets = ex.sets?.map(s => {
      if (s.duration_seconds) {
        return `${s.duration_seconds}s hold`;
      } else if (s.weight_kg != null && s.reps != null) {
        return `${(s.weight_kg * 2.20462).toFixed(1)} lbs x ${s.reps}`;
      } else if (s.reps != null) {
        return `Bodyweight x ${s.reps}`;
      } else {
        return "Set info missing";
      }
    }).join(", ");

    return `<td style="vertical-align:top; padding:10px; width:50%;">
      <strong>${ex.title}</strong><br>
      Sets: ${sets}
    </td>`;
  });

  // Combine into rows of 2 columns
  let rows = "";
  for (let i = 0; i < exerciseCells.length; i += 2) {
    rows += `<tr>${exerciseCells[i]}${exerciseCells[i + 1] || "<td></td>"}</tr>`;
  }

  return `<table width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}


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
)

  {

    const { weightChart, stepsChart, macrosChart, calorieChart } = charts;

    
// Function to get the total weight lossed/gained over 30 days for the email.
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
      const setSummary = e.sets?.map(s => {
        if (s.duration_seconds) return `${s.duration_seconds}s hold`;
        if (s.reps != null && s.weight_kg != null) return `${(s.weight_kg * 2.20462).toFixed(1)} lbs x ${s.reps}`;
        if (s.reps != null) return `Bodyweight x ${s.reps}`;
        return "Set info missing";
      }).join(", ");
  
      const note = trainerInsights.find(i => i.title === e.title)?.suggestion || "Maintain form and consistency";
      return `<td style="vertical-align:top; padding:10px; width:50%;">
        <strong>${e.title}</strong><br>
        Sets: ${setSummary}<br>
        <em>${note}</em>
      </td>`;
    });
  
    // Convert array of <td> into rows of 2 columns
    let rows = "";
    for (let i = 0; i < exBlocks.length; i += 2) {
      rows += `<tr>${exBlocks[i]}${exBlocks[i + 1] || "<td></td>"}</tr>`;
    }
  
    return `<h4>Workout: ${w.title}</h4>
      <table width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
  }).join("<br><br>");
  
  
    const feedback = trainerInsights.length > 0
      ? trainerInsights.map(i => `• <strong>${i.title}</strong>: ${i.suggestion} (avg ${i.avgReps} reps @ ${i.avgWeightLbs} lbs)`).join("<br>")
      : "Rest day — no exercise trends to analyze. Use today to prepare for tomorrow’s push.";
  
    return `
      <h3>💪 Yesterday's Workout Summary</h3>${workoutBlock}<br><br>
  
      <h3>🥗 Macros – ${macros.date}</h3>
      <ul>
        <li><strong>Calories:</strong> ${macros.calories} kcal</li>
        <li><strong>Protein:</strong> ${macros.protein}g</li>
        <li><strong>Carbs:</strong> ${macros.carbs}g</li>
        <li><strong>Fat:</strong> ${macros.fat}g</li>
        <li><strong>Weight:</strong> ${macros.weight} lbs</li>
        <li><strong>Steps:</strong> ${macros.steps}</li>
      </ul>
  
      <h3>📉 Weight Trend (Last 30 Days) ${weightChange ? `– ${weightChange}!` : ""}</h3>
      <img src="cid:weightChart" alt="Weight chart"><br>
       
      <h3>🚶 Steps Trend (Last 30 Days) - Avg: ${stepsChart?.average || "N/A"} steps</h3>
      <img src="cid:stepsChart" alt="Steps chart"><br>
        
      <h3>🍳 Macro Trend (Last 30 Days) - Avg Protein: ${macrosChart?.average?.protein || "N/A"}g, Carbs: ${macrosChart?.average?.carbs || "N/A"}g, Fat: ${macrosChart?.average?.fat || "N/A"}g</h3>
      <img src="cid:macrosChart" alt="Macros chart"><br>
        
      <h3>🔥 Calorie Trend (Last 30 Days) - Avge: ${calorieChart?.average || "N/A"} kcal</h3>
      <img src="cid:caloriesChart" alt="Calories chart"><br>
        
      <h3>🏋️ Today’s CoachGPT Workout</h3>
      ${formatWorkoutForEmail(todaysWorkout)}<br><br>

      <h3>🧭 Daily Inspiration</h3>
      <em>${quoteText}</em><br><br>

  
      
  
      Keep it up — I’ve got your back.<br>– CoachGPT

      
    `;
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
  

  module.exports = generateHtmlSummary;