// fullAICoachService.js
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

function validatePlan(plan) {
  if (!plan || !plan.todayPlan || !plan.todayPlan.exercises || plan.todayPlan.exercises.length < 4) return false;
  const sets = plan.todayPlan.exercises.flatMap(e => e.sets || []);
  if (sets.length < 16) return false;
  for (const s of sets) {
    if (typeof s.reps !== "number" || typeof s.weight_kg !== "number" || typeof s.tempo !== "string" || typeof s.rest_sec !== "number") {
      return false;
    }
  }
  return true;
}

async function generateFullAICoachPlan({ trainingSummary, macros, availableExercises, goal, constraints }) {
  const summaryText = `
Training Frequency: ${JSON.stringify(trainingSummary.frequency)}
Muscle Volume: ${JSON.stringify(trainingSummary.muscleVolume)}
Recent Types: ${trainingSummary.recentTypes.slice(-5).join(" | ")}
Top Exercises: ${trainingSummary.topExercises.join(", ")}`;

  const starterJson = `{
  "todayPlan": {
    "type": "Pull",
    "exercises": [
      {
        "title": "Bent Over Row (Dumbbell)",
        "sets": [
          { "reps": 10, "weight_kg": 25, "tempo": "3-1-1", "rest_sec": 60 },
          { "reps": 10, "weight_kg": 25, "tempo": "3-1-1", "rest_sec": 60 }
        ],
        "notes": "Control the eccentric, no momentum."
      },
      {
        "title": "Seated Cable Row",
        "sets": [
          { "reps": 12, "weight_kg": 40, "tempo": "2-1-2", "rest_sec": 75 },
          { "reps": 10, "weight_kg": 45, "tempo": "2-1-2", "rest_sec": 75 }
        ],
        "notes": "Squeeze shoulder blades hard."
      }
    ]
  },
  "coachMessage": "Push yourself — this is the work that reveals abs."
}`;

  const messages = [
    {
      role: "system",
      content: `You are an elite hypertrophy coach. Return only valid JSON.`
    },
    {
      role: "user",
      content: `
Client Info:
- Male, 47, 6'2", 178 lbs
- Goal: ${goal}
- Constraints: ${constraints.join(", ")}
- Session Duration: 45 minutes

Summary:
${summaryText}

Guidelines:
- Build a hypertrophy session: 4–6 exercises, 3–4 sets each
- All sets must include: reps, weight_kg, tempo, rest_sec
- Total sets must be at least 16
- Avoid deadlifts, back strain, spinal compression

Complete this JSON object:
${starterJson}`
    }
  ];

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.createChatCompletion({ model: "gpt-4o", messages, temperature: 0.7 });
      const reply = res.data.choices[0].message.content;
      console.log(`🧠 RAW GPT RESPONSE (Attempt ${attempt}):\n`, reply);
      const jsonStart = reply.indexOf("{");
      const jsonEnd = reply.lastIndexOf("}") + 1;
      const clean = reply.slice(jsonStart, jsonEnd);
      const plan = JSON.parse(clean);

      if (validatePlan(plan)) return plan;
      console.warn(`❌ Attempt ${attempt} rejected: Plan did not meet requirements.`);
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed:`, err.message);
    }
  }

  return {
    todayPlan: null,
    coachMessage: "Plan rejected after 3 attempts due to insufficient volume or missing data."
  };
}

module.exports = { generateFullAICoachPlan };
