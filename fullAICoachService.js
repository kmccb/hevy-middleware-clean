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

  const messages = [
    {
      role: "system",
      content: `You are an elite hypertrophy coach. You return raw JSON only.`
    },
    {
      role: "user",
      content: `
Client:
- Male, 47, 6'2", 178 lbs
- Goal: ${goal}
- Constraints: ${constraints.join(", ")}
- Session: 45 min, hypertrophy style, minimum 16 total sets

Summary:
${summaryText}

Guidelines:
- 4–6 exercises, 3–4 sets each
- All sets must include reps, weight_kg, tempo, rest_sec
- If this can’t be satisfied, change muscle group
- Avoid spinal compression, deadlifts, back strain

Instructions:
Return valid JSON ONLY:
{
  "todayPlan": { "type": "Push", "exercises": [ ... ] },
  "coachMessage": "Push yourself — this is the work that reveals abs."
}`
    }
  ];

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.createChatCompletion({ model: "gpt-4o", messages, temperature: 0.7 });
      const reply = res.data.choices[0].message.content;
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
