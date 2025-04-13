// fullAICoachService.js
require("dotenv").config();
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);
const moment = require("moment");

function summarizeWorkoutTrends(workouts) {
  const trend = {
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
      trend.byMuscle[m] = (trend.byMuscle[m] || 0) + 1;
    });
  });

  return trend;
  return trend;
}

function simplifyExercises(templates) {
  return templates.map(t => ({
    id: t.id,
    title: t.title,
    muscle: t.primary_muscle_group,
    equipment: t.equipment
  })).slice(0, 75);
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
    const trainingSummary = formatTrainingSummary(trends, avgMacros);
    const leanExercises = simplifyExercises(availableExercises);

    const messages = [
      {
        role: "system",
        content: `You are a tactical strength and hypertrophy coach. Return only raw JSON.`
        content: `You are a tactical strength and hypertrophy coach. Return only raw JSON.`
      },
      {
        role: "user",
        content: `
User Info:
- Goal: ${goal}
- Experience: Intermediate male, age 47, 6'2", 178 lbs
- Constraints: ${constraints.join(", ")}
User Info:
- Goal: ${goal}
- Experience: Intermediate male, age 47, 6'2", 178 lbs
- Constraints: ${constraints.join(", ")}

Training Summary:
${trainingSummary}

Guidelines:
- Choose the most undertrained body part unless recently trained.
- Avoid repeating any workout type trained within the last 48 hours.
- Build a hypertrophy-appropriate session: 4–6 exercises, 2–4 sets each.
- Prioritize mind-muscle connection, time under tension, mechanical fatigue.
- Use appropriate weight for 8–15 reps. Include tempo cues or rest periods.
- Avoid spinal compression, deadlifts, or anything straining the lower back.
- Plan should be suitable for getting shredded without sacrificing muscle.

Available Exercises:
${leanExercises.map(e => `${e.title} (${e.muscle}, ${e.equipment})`).join("\n").slice(0, 4000)}

Instructions:
Respond ONLY with valid JSON. No commentary. No markdown. Use this structure:
Instructions:
Respond ONLY with valid JSON. No commentary. No markdown. Use this structure:
{
  "todayPlan": {
    "type": "Legs",
    "exercises": [
      {
        "title": "",
        "sets": [
          { "reps": 10, "weight_kg": 25 },
          { "reps": 10, "weight_kg": 25 },
          { "reps": 8, "weight_kg": 30 }
        ],
        "notes": "..."
      }
    ]
  },
  "coachMessage": "..."
}`
  "todayPlan": {
    "type": "Legs",
    "exercises": [
      {
        "title": "",
        "sets": [
          { "reps": 10, "weight_kg": 25 },
          { "reps": 10, "weight_kg": 25 },
          { "reps": 8, "weight_kg": 30 }
        ],
        "notes": "..."
      }
    ]
  },
  "coachMessage": "..."
}`
      }
    ];

    const res = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7
    });
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7
    });

    const reply = res.data.choices[0].message.content;
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
