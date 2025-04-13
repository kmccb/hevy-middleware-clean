// aiCoachService.js
require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


/**
 * Generates an AI-based coaching message and optional plan critiques.
 * @param {Object} input
 * @param {Array} input.workouts - Past 30 days of workouts
 * @param {Object} input.macros - Yesterday's macro data
 * @param {string} input.goal - User's goal
 * @param {Array<string>} input.constraints - Limitations or restrictions
 * @returns {Object} - { dailyMessage, suggestedChanges }
 */
async function generateAICoachingPlan({ workouts, macros, goal, constraints }) {
  try {
    const workoutSummary = summarizeWorkouts(workouts);
    const yesterday = workouts.find(w => w.start_time)?.title || "None logged";

    const prompt = [
      {
        role: "system",
        content:
          "You are a world-class fitness coach and trainer. Analyze training and macro history. Generate a motivating daily message and intelligent coaching. Avoid any exercises that strain the lower back."
      },
      {
        role: "user",
        content: `
Goal: ${goal}
Constraints: ${constraints.join(", ")}
Macros Yesterday: ${macros.calories} kcal, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat, ${macros.steps} steps
Workout Yesterday: ${yesterday}

Workout Trends (30 days):
${workoutSummary}

Please:
1. Give me a short (2-4 sentence) coach-style message for today
2. If needed, suggest any change to today's plan
Respond in JSON with keys: dailyMessage, suggestedChanges`
      }
    ];

    const res = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: prompt,
        temperature: 0.8
      });
      

      const reply = res.choices[0].message.content;

    const jsonStart = reply.indexOf("{");
    const cleanJson = reply.slice(jsonStart);
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("❌ AI Coaching failed:", err.message || err);
    return {
      dailyMessage: "Show up. Push hard. Stay consistent. I’ve got your back. – CoachGPT",
      suggestedChanges: null
    };
  }
}

function summarizeWorkouts(workouts) {
  const splitCounts = { Push: 0, Pull: 0, Legs: 0, Abs: 0, Cardio: 0, Other: 0 };
  workouts.forEach(w => {
    const title = w.title.toLowerCase();
    if (title.includes("push")) splitCounts.Push++;
    else if (title.includes("pull")) splitCounts.Pull++;
    else if (title.includes("leg")) splitCounts.Legs++;
    else if (title.includes("abs")) splitCounts.Abs++;
    else if (title.includes("cardio")) splitCounts.Cardio++;
    else splitCounts.Other++;
  });
  return Object.entries(splitCounts)
    .map(([k, v]) => `${k}: ${v} sessions`)
    .join(" | ");
}

module.exports = { generateAICoachingPlan };
