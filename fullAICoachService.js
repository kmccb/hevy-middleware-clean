// fullAICoachService.js
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

function summarizeWorkoutTrends(workouts) {
  const trend = {
    Push: 0,
    Pull: 0,
    Legs: 0,
    Abs: 0,
    Cardio: 0,
    Other: 0,
    byMuscle: {},
    recentTypes: []
  };

  workouts.forEach(w => {
    const title = w.title.toLowerCase();
    if (title.includes("push")) trend.Push++;
    else if (title.includes("pull")) trend.Pull++;
    else if (title.includes("leg")) trend.Legs++;
    else if (title.includes("abs")) trend.Abs++;
    else if (title.includes("cardio")) trend.Cardio++;
    else trend.Other++;

    trend.recentTypes.push(w.title);

    w.exercises.forEach(ex => {
      const m = ex.primary_muscle_group?.toLowerCase() || "unknown";
      trend.byMuscle[m] = (trend.byMuscle[m] || 0) + 1;
    });
  });

  return trend;
}

function simplifyExercises(templates) {
  return templates.map(t => ({
    id: t.id,
    title: t.title,
    muscle: t.primary_muscle_group,
    equipment: t.equipment
  })).slice(0, 75);
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

function formatTrainingSummary(trend, macros) {
  const undertrained = Object.entries(trend.byMuscle)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([muscle, count]) => `${muscle} (${count} sets)`)
    .join(", ");

  return `
- Workout Frequency: Push ${trend.Push}, Pull ${trend.Pull}, Legs ${trend.Legs}, Abs ${trend.Abs}, Cardio ${trend.Cardio}
- Undertrained Muscle Groups: ${undertrained}
- Avg Protein: ${macros.protein}g | Avg Calories: ${macros.calories} kcal
- Recent Workout Titles: ${trend.recentTypes.slice(-5).join(" | ")}`;
}

async function generateFullAICoachPlan({ workouts, macros, availableExercises, goal, constraints }) {
  try {
    const trends = summarizeWorkoutTrends(workouts);
    const avgMacros = averageMacros(macros);
    const trainingSummary = formatTrainingSummary(trends, avgMacros);
    const leanExercises = simplifyExercises(availableExercises);

    const messages = [
      {
        role: "system",
        content: `You are a tactical strength and conditioning coach. Prescribe one-day hypertrophy workouts that reflect current trends.`
      },
      {
        role: "user",
        content: `
Goal: ${goal}
Constraints: ${constraints.join(", ")}

Training Summary:
${trainingSummary}

Available Exercises:
${leanExercises.map(e => `${e.title} (${e.muscle}, ${e.equipment})`).join("\n").slice(0, 4000)}

Please return:
{
  "todayPlan": { "type": "Legs", "exercises": [ {"title": "", "sets": [...], "notes": "" } ] },
  "coachMessage": "Your motivational coaching message here."
}`
      }
    ];

    const res = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7
    });

    const reply = res.data.choices[0].message.content;
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
