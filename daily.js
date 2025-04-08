const path = require("path");
const simpleGit = require("simple-git");
const { pushDirect } = require("./utils/gitPushDirect");
const { getYesterdaysWorkouts } = require("./getYesterdaysWorkouts");
const fetchAllWorkouts = require("./fetchAllWorkouts");
const { analyzeTrends } = require("./analyzeTrends");
const { generateTrainerFeedback } = require("./analyzeTrainerFeedback");


/**
 * DAILY SYNC PROCESS
 * This script runs a daily sync to fetch workout data, analyze trends, and commit changes to git.
 */
async function runDailySync() {
  try {
    console.log("🚀 Starting daily sync process...");

    // Fetch and Save Workouts
    console.time("⏱ fetchAllWorkouts");
    await fetchAllWorkouts(); // Pulls last 30 days of workouts from Hevy API and saves locally
    console.timeEnd("⏱ fetchAllWorkouts");

    // Analyze Trends
    console.time("⏱ analyzeTrends");
    const trends = analyzeTrends(); // Analyzes 30-day workout history for progress
    console.timeEnd("⏱ analyzeTrends");

    if (trends.length > 0) {
      console.log(`📈 Found ${trends.length} exercises with trend data.`);
      trends.forEach(t => console.log(`  🏋️ ${t.name}: ΔWeight ${t.change.weight}, ΔReps ${t.change.reps}`));
    }

    // Check Yesterday's Workouts
    console.time("⏱ getYesterdaysWorkouts");
    const workouts = await getYesterdaysWorkouts(); // Fetches workouts from the previous day
    console.timeEnd("⏱ getYesterdaysWorkouts");

    if (workouts.length === 0) {
      console.log("😴 No workouts found yesterday.");
    } else {
      console.log(`📅 Found ${workouts.length} workouts from yesterday.`);
      workouts.forEach((w, i) => console.log(`  ${i + 1}: ${w.name || "Unnamed"} @ ${w.start_time}`));
    }

    // Git Integration
    const git = simpleGit(path.join(__dirname));
    const status = await git.status();

    if (status.modified.length || status.created.length || status.deleted.length) {
      console.log("🔄 Detected file changes. Pushing directly to main...");
      await pushDirect({ commitMessage: "CoachGPT auto-update: Routine or macro changes" });
    } else {
      console.log("✅ No file changes. No push needed.");
    }

  } catch (err) {d
    console.error("❌ Error in daily sync:", err);
  } finally {
    console.log("🏁 Daily sync complete. Exiting.");
    process.exit(0);
  }
}

runDailySync();