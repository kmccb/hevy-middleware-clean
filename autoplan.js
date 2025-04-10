const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const TEMPLATES_FILE = path.join(__dirname, 'data', 'exercise_templates.json');
const ROUTINES_FILE = path.join(__dirname, 'data', 'routines.json');
const WORKOUTS_FILE = path.join(__dirname, 'data', 'workouts-30days.json');

const KG_TO_LBS = 2.20462;
const SPLIT_ROTATION = ['Push', 'Pull', 'Legs', 'Core'];

function getNextSplit(workouts) {
  console.log('🔍 Determining next split...');
  const titles = workouts.map(w => w.title || '');
  console.log('📋 Workout titles:', titles);
  for (let i = SPLIT_ROTATION.length - 1; i >= 0; i--) {
    if (titles.some(t => t.includes(SPLIT_ROTATION[i]))) {
      const nextSplit = SPLIT_ROTATION[(i + 1) % SPLIT_ROTATION.length];
      console.log(`✅ Last split found: ${SPLIT_ROTATION[i]}. Next split: ${nextSplit}`);
      return nextSplit;
    }
  }
  console.log('⚠️ No split found in history. Defaulting to Push.');
  return 'Push';
}

function getRecentTitles(workouts) {
  const titles = new Set();
  workouts.forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(e => titles.add(e.title));
    }
  });
  console.log('📜 Recent exercise titles:', [...titles]);
  return titles;
}

function getExerciseHistory(exName, workouts) {
  const sets = [];
  workouts.forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(e => {
        if (e.title === exName && e.sets) {
          sets.push(...e.sets.filter(s => s.weight_kg != null && s.reps != null));
        }
      });
    }
  });
  return sets;
}

function generateSetPlan(historySets) {
  if (!historySets.length) {
    return [
      { type: 'warmup', weight_kg: 0, reps: 10 },
      { type: 'normal', weight_kg: 30, reps: 8 },
      { type: 'normal', weight_kg: 30, reps: 8 },
    ];
  }

  const lastSet = historySets.at(-1);
  const priorSet = historySets.length > 1 ? historySets.at(-2) : lastSet;

  const volLast = lastSet.weight_kg * lastSet.reps;
  const volPrior = priorSet.weight_kg * priorSet.reps;
  const overload = volLast > volPrior;

  const newWeight = overload ? lastSet.weight_kg + 2.5 : lastSet.weight_kg;
  const newReps = overload ? lastSet.reps : Math.max(6, Math.min(12, lastSet.reps));

  return [
    { type: 'warmup', weight_kg: 0, reps: 10 },
    { type: 'normal', weight_kg: Math.round(newWeight), reps: newReps },
    { type: 'normal', weight_kg: Math.round(newWeight), reps: newReps },
  ];
}

function pickExercises(templates, muscleGroups, recentTitles, numExercises = 4) {
  const usedTitles = new Set();
  const selectedExercises = [];
  const availableTemplates = [...templates];

  // First pass: Try to pick exercises strictly matching primary muscle groups
  for (const muscle of muscleGroups) {
    const candidates = availableTemplates.filter(t => {
      const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
      return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title);
    });

    if (candidates.length > 0) {
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`✅ Selected: ${selected.title} (Muscle: ${muscle})`);
      selectedExercises.push(selected);
      usedTitles.add(selected.title);
    } else {
      console.log(`⚠️ No suitable template found for ${muscle} in first pass`);
    }
  }

  // Second pass: Fill remaining slots, but only with target muscle groups
  while (selectedExercises.length < numExercises) {
    const remainingMuscles = muscleGroups.filter(muscle => {
      return !selectedExercises.some(ex => (ex.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase()));
    });

    if (remainingMuscles.length === 0) {
      // If all muscle groups are covered, pick randomly from the target muscle groups
      const muscle = muscleGroups[Math.floor(Math.random() * muscleGroups.length)];
      const candidates = availableTemplates.filter(t => {
        const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
        return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title);
      });

      if (candidates.length === 0) {
        console.log(`⚠️ No more suitable templates found for ${muscle}. Stopping at ${selectedExercises.length} exercises.`);
        break; // Stop if no more suitable exercises are found
      }

      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`✅ Selected (additional): ${selected.title} (Muscle: ${muscle})`);
      selectedExercises.push(selected);
      usedTitles.add(selected.title);
    } else {
      const muscle = remainingMuscles[Math.floor(Math.random() * remainingMuscles.length)];
      const candidates = availableTemplates.filter(t => {
        const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
        return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title);
      });

      if (candidates.length === 0) {
        console.log(`⚠️ No suitable template found for ${muscle} in second pass`);
        break; // Stop if no suitable exercises are found
      }

      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`✅ Selected (additional): ${selected.title} (Muscle: ${muscle})`);
      selectedExercises.push(selected);
      usedTitles.add(selected.title);
    }
  }

  return selectedExercises;
}

async function autoplan() {
  try {
    if (!HEVY_API_KEY) {
      throw new Error('HEVY_API_KEY is not configured in environment variables');
    }

    let workouts, templates, routines;
    try {
      if (!fs.existsSync(WORKOUTS_FILE)) {
        console.log(`⚠️ Cache file missing: ${WORKOUTS_FILE}. Creating empty file...`);
        fs.mkdirSync(path.dirname(WORKOUTS_FILE), { recursive: true });
        fs.writeFileSync(WORKOUTS_FILE, JSON.stringify([]));
      }
      if (!fs.existsSync(TEMPLATES_FILE)) {
        console.log(`⚠️ Cache file missing: ${TEMPLATES_FILE}. Creating empty file...`);
        fs.mkdirSync(path.dirname(TEMPLATES_FILE), { recursive: true });
        fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([]));
      }
      if (!fs.existsSync(ROUTINES_FILE)) {
        console.log(`⚠️ Cache file missing: ${ROUTINES_FILE}. Creating empty file...`);
        fs.mkdirSync(path.dirname(ROUTINES_FILE), { recursive: true });
        fs.writeFileSync(ROUTINES_FILE, JSON.stringify([]));
      }

      const rawWorkoutsData = fs.readFileSync(WORKOUTS_FILE, 'utf8');
    //  console.log('📝 Raw workouts data:', rawWorkoutsData); // UNCOMMENT TO VERIFY WORKOUTS GETTING LOGGED.
      if (!rawWorkoutsData.trim()) {
        throw new Error('Workouts file is empty');
      }
      workouts = JSON.parse(rawWorkoutsData);

      const rawTemplatesData = fs.readFileSync(TEMPLATES_FILE, 'utf8');
      console.log('📝 Raw templates data:', rawTemplatesData);
      if (!rawTemplatesData.trim()) {
        throw new Error('Templates file is empty');
      }
      const templatesData = JSON.parse(rawTemplatesData);
      templates = templatesData.exercise_templates || templatesData; // Handle both array and object structure
      if (!Array.isArray(templates)) {
        throw new Error('Exercise templates data is not an array');
      }
      console.log('📦 Templates loaded:', templates.length);

      const rawRoutinesData = fs.readFileSync(ROUTINES_FILE, 'utf8');
      console.log('📝 Raw routines data:', rawRoutinesData);
      if (!rawRoutinesData.trim()) {
        throw new Error('Routines file is empty');
      }
      routines = JSON.parse(rawRoutinesData);
    } catch (err) {
      throw new Error(`Failed to read input files: ${err.message}`);
    }

    const uniqueMuscles = new Set(templates.map(t => t.primary_muscle_group));
    console.log('🔬 Muscle groups found in templates:', [...uniqueMuscles]);

    // Debug: Log templates for Shoulders and Triceps
    const shoulderTemplates = templates.filter(t => (t.primary_muscle_group || '').toLowerCase().includes('shoulders'));
    console.log('🔍 Shoulder templates:', shoulderTemplates.map(t => ({ title: t.title, primary_muscle_group: t.primary_muscle_group })));
    const tricepsTemplates = templates.filter(t => (t.primary_muscle_group || '').toLowerCase().includes('triceps'));
    console.log('🔍 Triceps templates:', tricepsTemplates.map(t => ({ title: t.title, primary_muscle_group: t.primary_muscle_group })));

    const split = getNextSplit(workouts);
    console.log('🎯 Next split:', split);

    const selected = pickExercises(split, templates, workouts);

    if (!selected.length) {
      console.warn('⚠️ No exercises selected. Skipping update.');
      return { success: false };
    }

    const routine = routines.find(r => r.name && r.name.toLowerCase().includes('coachgpt'));
    if (!routine) throw new Error("Routine 'CoachGPT' not found");

    const payload = {
      routine: {
        title: `CoachGPT – ${split} Day`,
        notes: `Trainer-crafted ${split} day with progressive overload and fatigue-aware targeting.`,
        exercises: selected,
      },
    };

    console.log('📦 Final payload:', JSON.stringify(payload, null, 2));

    const response = await axios.put(
      `https://api.hevyapp.com/v1/routines/${routine.id}`,
      payload,
      {
        headers: {
          'api-key': HEVY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Routine updated successfully!', response.status);
    return { success: true };
  } catch (err) {
    console.error('❌ Autoplan failed:', err.response?.data || err.message);
    return { success: false };
  }
}

if (require.main === module) {
  console.log('🚀 Running autoplan directly from main...');
  autoplan();
}

console.log('📦 Exporting autoplan:', typeof autoplan);
module.exports = autoplan;