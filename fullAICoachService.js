// fullAICoachService.js
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);


function summarizeWorkoutTrends(workouts) {
  const summary = {
    Push: 0,
    Pull: 0,
    Legs: 0,
    Abs: 0,
    Cardio: 0,
    Other: 0,
    byMuscle: {}
  };

  workouts.forEach(w => {
    const title = w.title.toLowerCase();
    if (title.includes("push")) summary.Push++;
    else if (title.includes("pull")) summary.Pull++;
    else if (title.includes("leg")) summary.Legs++;
    else if (title.includes("abs")) summary.Abs++;
    else if (title.includes("cardio")) summary.Cardio++;
    else summary.Other++;

    w.exercises.forEach(ex => {
      const m = ex.primary_muscle_group?.toLowerCase() || "unknown";
      summary.byMuscle[m] = (summary.byMuscle[m] || 0) + 1;
    });
  });

  return summary;
}

function simplifyExercises(templates) {
  return templates.map(t => ({
    id: t.id,
    title: t.title,
    muscle: t.primary_muscle_group,
    equipment: t.equipment
  })).slice(0, 75); // keep it tight
}

function averageMacros(macros) {
  const avg = { protein: 0, calories: 0, count: 0 };
  macros.forEach(m => {
    const p = parseFloat(m.protein);
    const c = parseFloat(m.calories);
    if (!isNaN(p)) avg.protein += p;
    if (!isNaN(c)) avg.calories += c;
    avg.count++;
  });
  if (avg.count > 0) {
    avg.protein = Math.round(avg.protein / avg.count);
    avg.calories = Math.round(avg.calories / avg.count);
  }
  return avg;
}

/**
 * Full AI-driven training planner
 */
async function generateFullAICoachPlan({ workouts, macros, availableExercises, goal, constraints }) {
  try {
    const trends = summarizeWorkoutTrends(workouts);
    const avgMacros = averageMacros(macros);
    const leanExercises = simplifyExercises(availableExercises);

    const messages = [
      {
        role: "system",
        content: `You are a tactical strength and conditioning coach. You build one-day hypertrophy-focused routines with smart progression.`
      },
      {
        role: "user",
        content: `
User Goal: ${goal}
Constraints: ${constraints.join(", ")}

Workout Trends:
Push: ${trends.Push}, Pull: ${trends.Pull}, Legs: ${trends.Legs}, Abs: ${trends.Abs}, Cardio: ${trends.Cardio}
Undertrained Muscles: ${Object.entries(trends.byMuscle).sort((a, b) => a[1] - b[1]).slice(0, 3).map(e => e[0]).join(", ")}

Average Macros (30 days):
Protein: ${avgMacros.protein}g, Calories: ${avgMacros.calories} kcal

Available Exercises:
${leanExercises.map(e => `${e.title} (${e.muscle}, ${e.equipment})`).join("\n").slice(0, 4000)}

Please:
- Choose today's best workout type
- Select 4 exercises (plus 3-4 abs if not cardio)
- Recommend smart sets/reps/weights
- Avoid anything that strains the lower back
- Respond in JSON:
{
  "todayPlan": { "type": "Legs", "exercises": [ {"title": "", "sets": [...], "notes": "" } ] },
  "coachMessage": "Your motivational coaching message here."
}
        `
      }
    ];

    const res = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7
      });
      

      const reply = res.data.choices[0].message.content;

    console.log("🧠 RAW GPT RESPONSE:\n", reply);

    
    const jsonStart = reply.indexOf("{");
    const jsonEnd = reply.lastIndexOf("}") + 1;
    const clean = reply.slice(jsonStart, jsonEnd);
    return JSON.parse(clean);
  } catch (err) {
    console.error("❌ Full AI Coach failed:", err.message);
    return {
      todayPlan: null,
      coachMessage: "Unable to generate plan today. Stay consistent and train smart."
    };
  }
}

module.exports = { generateFullAICoachPlan };
