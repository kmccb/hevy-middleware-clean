async function autoplan() {
  try {
    if (!HEVY_API_KEY) {
      throw new Error('HEVY_API_KEY is not configured in environment variables');
    }

    let workouts, templates, routines;
    try {
      if (!fs.existsSync(WORKOUTS_FILE)) {
        throw new Error(`Workouts file not found at ${WORKOUTS_FILE}`);
      }
      if (!fs.existsSync(TEMPLATES_FILE)) {
        throw new Error(`Templates file not found at ${TEMPLATES_FILE}`);
      }
      if (!fs.existsSync(ROUTINES_FILE)) {
        throw new Error(`Routines file not found at ${ROUTINES_FILE}`);
      }

      console.log("📂 TEMPLATES_FILE path:", TEMPLATES_FILE);
      const rawTemplatesData = fs.readFileSync(TEMPLATES_FILE, 'utf8');
      console.log("📝 Raw templates data:", rawTemplatesData);
      if (!rawTemplatesData.trim()) {
        throw new Error("Templates file is empty");
      }
      templates = JSON.parse(rawTemplatesData);
      if (!templates) {
        throw new Error("Templates data is undefined after parsing");
      }
      console.log("📦 Templates loaded:", templates);

      workouts = JSON.parse(fs.readFileSync(WORKOUTS_FILE));
      routines = JSON.parse(fs.readFileSync(ROUTINES_FILE));
    } catch (err) {
      throw new Error(`Failed to read input files: ${err.message}`);
    }

    const allTemplates = Object.values(templates);
    const uniqueMuscles = new Set(allTemplates.map(t => t.primary_muscle_group));
    console.log("🔬 Muscle groups found in templates:", [...uniqueMuscles]);

    const split = getNextSplit(workouts);
    console.log("🎯 Next split:", split);

    console.log("📋 Templates before pickExercises:", templates);
    const selected = pickExercises(split, templates, workouts);

    if (!selected.length) {
      console.warn("⚠️ No exercises selected. Skipping update.");
      return { success: false };
    }

    const routine = routines.find(r => r.name && r.name.toLowerCase().includes("coachgpt"));
    if (!routine) throw new Error("Routine 'CoachGPT' not found");

    const payload = {
      routine: {
        title: `CoachGPT – ${split} Day`,
        notes: `Trainer-crafted ${split} day with progressive overload and fatigue-aware targeting.`,
        exercises: selected
      }
    };

    console.log("📦 Final payload:", JSON.stringify(payload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routine.id}`,
      payload,
      {
        headers: {
          "api-key": HEVY_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Routine updated successfully!", response.status);
    return { success: true };
  } catch (err) {
    console.error("❌ Autoplan failed:", err.response?.data || err.message);
    return { success: false };
  }
}