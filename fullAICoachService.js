// fullAICoachService.js
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);
const moment = require("moment");

function summarizeWorkoutTrends(workouts) {
  const trend = {
    Push: 0,
    Pull: 0,
    Legs: 0,
    Abs: 0,
    Cardio: 0,
    Other: 0,
    byMuscle: {},
    recentTypes: [],
    lastTrained: {}
  };

  workouts.forEach(w => {
    const title = w.title.toLowerCase();
    const date = w.start_time || w.date;

    if (title.includes("push")) {
      trend.Push++;
      trend.lastTrained.Push = trend.lastTrained.Push || date;
    } else if (title.includes("pull")) {
      trend.Pull++;
      trend.lastTrained.Pull = trend.lastTrained.Pull || date;
    } else if (title.includes("leg")) {
      trend.Legs++;
      trend.lastTrained.Legs = trend.lastTrained.Legs || date;
    } else if (title.includes("abs")) {
      trend.Abs++;
      trend.lastTrained.Abs = trend.lastTrained.Abs || date;
    } else if (title.includes("cardio")) {
      trend.Cardio++;
      trend.lastTrained.Cardio = trend.lastTrained.Cardio || date;
    } else {
      trend.Other++;
    }

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

  const lastTrainedText = Object.entries(trend.lastTrained)
    .map(([type, date]) => `${type}: ${moment(date).fromNow()}`)
    .join(" | ");

  return `
- Workout Frequency: Push ${trend.Push}, Pull ${trend.Pull}, Legs ${trend.Legs}, Abs ${trend.Abs}, Cardio ${trend.Cardio}
- Last Trained: ${lastTrainedText}
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
        content: `You are an elite strength and hypertrophy coach. Your client is intermediate-level, focused, and wants visible abs and lean mass. You must prescribe training with progressive intent and effort. Return only raw JSON.`
      },
      {
        role: "user",
        content: `
User Info:
- Goal: ${goal}
- Experience: Intermediate male, age 47, 6'2", 178 lbs
- Constraints: ${constraints.join(", ")}
- Session Duration: 45 minutes

Training Summary:
${trainingSummary}

Guidelines:
- Choose the most undertrained body part unless recently trained.
- Avoid repeating any workout type trained within the last 48 hours.
- Total sets for the session should be **at least 16**.
- Build a hypertrophy-appropriate session: 4–6 exercises, 3–4 sets each.
- You may use supersets (identify them clearly).
- Include: reps, weight (in kg), rest time, and tempo.
- Prioritize mind-muscle connection, mechanical fatigue, time under tension.
- Use appropriate weight for 8–15 reps.
- Avoid spinal compression, deadlifts, or anything straining the lower back.
- Plan should drive body recomposition and visible ab development.

Available Exercises:
${leanExercises.map(e => `${e.title} (${e.muscle}, ${e.equipment})`).join("\n").slice(0, 4000)}

Instructions:
Respond ONLY with valid JSON. Use this structure:
{
  "todayPlan": {
    "type": "Abs",
    "exercises": [
      {
        "title": "Cable Crunch",
        "sets": [
          { "reps": 12, "weight_kg": 35, "tempo": "3-1-1", "rest_sec": 60 },
          { "reps": 10, "weight_kg": 40, "tempo": "3-1-1", "rest_sec": 60 },
          { "reps": 8, "weight_kg": 45, "tempo": "3-1-1", "rest_sec": 60 }
        ],
        "notes": "Control the eccentric and maintain deep contraction"
      }
    ]
  },
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
