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
  
    return workout.exercises.map(ex => {
      const sets = ex.sets.map(s => {
        if (s.duration_seconds) {
          return `${s.duration_seconds}s hold`;
        } else if (s.weight_kg != null && s.reps != null) {
          return `${(s.weight_kg * 2.20462).toFixed(1)} lbs x ${s.reps}`;
        } else {
          return "Bodyweight";
        }
      }).join(", ");
  
      return `<strong>${ex.title}</strong><br>Sets: ${sets}`;
    }).join("<br><br>");
  }

  function generateHtmlSummary(
    
    workouts,
    macros,
    allMacrosData,
    trainerInsights,
    todayTargetDay,
    charts,
    todaysWorkout,
    quoteText
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
        if (!e.sets || e.sets.length === 0) return null;
      
        const setSummary = e.sets.map(s => {
          if (s.duration_seconds) {
            return `${s.duration_seconds}s hold`;
          } else if (s.reps != null && s.weight_kg != null) {
            const weightLbs = (s.weight_kg * 2.20462).toFixed(1);
            return `${weightLbs} lbs x ${s.reps}`;
          } else if (s.reps != null && (s.weight_kg == null || s.weight_kg === 0)) {
            return `Bodyweight x ${s.reps}`;
          } else {
            return "Unknown set";
          }
        }).join(", ");
      
        const note = trainerInsights.find(i => i.title === e.title)?.suggestion || "Maintain form and consistency";
      
        return `<strong>${e.title}</strong><br>Sets: ${setSummary}<br>Note: ${note}`;
      }).filter(Boolean).join("<br><br>");
      
      return `<h4>Workout: ${w.title}</h4>${exBlocks}`;
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
        
      <h3>🧠 Trainer Feedback</h3>${feedback}<br><br>
  
      <h3>📅 What’s Next</h3>
      Today is <strong>Day ${todayTargetDay}</strong>. Focus on:<br>
      - Intentional form<br>
      - Progressive overload<br>
      - Core tension & recovery<br><br>
  
      <h3>🏋️ Today’s CoachGPT Workout</h3>
      ${formatWorkoutForEmail(todaysWorkout)}<br><br>

      <h3>🧭 Daily Inspiration</h3>
      <em>${quoteText}</em><br><br>

  
      
  
      Keep it up — I’ve got your back.<br>– CoachGPT
    `;
  }
  
  module.exports = generateHtmlSummary;