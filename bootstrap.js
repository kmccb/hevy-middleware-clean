const { fetchExerciseTemplates } = require("./exerciseService");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const fetchAllRoutines = require("./fetchAllRoutines");
const runDailySync = require("./runDailySync");

async function bootstrap(app, PORT) {
  try {
    console.log("⏳ Priming cache...");
    await fetchExerciseTemplates();
    await fetchAllWorkouts();
    await fetchAllRoutines();
    console.log("✅ All cache files ready.");

    await runDailySync();

    app.listen(PORT, () => {
      console.log(`🏋️ CoachGPT Middleware is LIVE on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err.message || err);
    process.exit(1);
  }
}

module.exports = bootstrap;
