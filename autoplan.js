const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.HEVY_API_KEY;
const BASE_URL = 'https://api.hevyapp.com/v1';
const headers = { 'api-key': API_KEY };
const KG_TO_LBS = 2.20462; // Conversion factor from kg to lbs

// Muscle group targets for each workout type
const muscleTargets = {
  Push: ['Chest', 'Shoulders', 'Triceps'],
  Pull: ['Lats', 'Upper Back', 'Biceps'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  Cardio: ['Cardio'],
  Abs: ['Abdominals', 'Obliques']
};

// Exercises to exclude (back-straining)
const excludedExercises = new Set([
  "Deadlift (Barbell)", "Deadlift (Dumbbell)", "Deadlift (Smith Machine)", "Deadlift (Trap Bar)",
  "Romanian Deadlift (Barbell)", "Romanian Deadlift (Dumbbell)",
  "Good Morning (Barbell)"
]);

// Global variables
let exerciseTemplates = [];
let historyAnalysis = null;

// Analyze workout history
function analyzeHistory(workouts) {
  const recentTitles = new Set();
  const muscleGroupFrequency = {};
  const exerciseFrequency = {};
  const absMetrics = { totalSessions: 0, exercises: new Set(), totalSets: 0 };
  const progressionData = {};

  for (const workout of workouts) {
    let hasAbs = false;
    for (const exercise of workout.exercises) {
      recentTitles.add(exercise.title);

      const template = exerciseTemplates.find(t => t.id === exercise.exercise_template_id);
      if (template) {
        const primaryMuscle = template.primary_muscle_group.toLowerCase();
        muscleGroupFrequency[primaryMuscle] = (muscleGroupFrequency[primaryMuscle] || 0) + 1;

        if (primaryMuscle.includes('abdominals') || primaryMuscle.includes('obliques')) {
          hasAbs = true;
          absMetrics.exercises.add(exercise.title);
          absMetrics.totalSets += exercise.sets.length;
        }

        exerciseFrequency[exercise.title] = (exerciseFrequency[exercise.title] || 0) + 1;

        if (!progressionData[exercise.title]) {
          progressionData[exercise.title] = [];
        }
        exercise.sets.forEach(set => {
          if (set.weight_kg != null && set.reps != null) {
            const weight_lbs = set.weight_kg * KG_TO_LBS;
            progressionData[exercise.title].push({
              date: workout.start_time,
              weight_kg: set.weight_kg,
              weight_lbs: weight_lbs,
              reps: set.reps,
              volume: weight_lbs * set.reps // Volume in lbs
            });
          }
        });
      }
    }
    if (hasAbs) absMetrics.totalSessions++;
  }

  const progressionAnalysis = {};
  for (const [title, sets] of Object.entries(progressionData)) {
    if (sets.length >= 2) {
      const lastSet = sets[sets.length - 1];
      const secondLastSet = sets[sets.length - 2];
      const volumeChange = lastSet.volume - secondLastSet.volume;
      let suggestion = "Maintain or increase reps";
      if (volumeChange > 0) {
        const newWeightLbs = lastSet.weight_lbs * 1.05; // 5% increase
        suggestion = `Increase weight to ${newWeightLbs.toFixed(1)} lbs`;
      } else if (lastSet.reps >= 10) {
        const newWeightLbs = lastSet.weight_lbs * 1.05;
        suggestion = `Try increasing weight to ${newWeightLbs.toFixed(1)} lbs`;
      }
      progressionAnalysis[title] = {
        lastWeightLbs: lastSet.weight_lbs.toFixed(1),
        lastReps: lastSet.reps,
        volumeChange: volumeChange,
        suggestion: suggestion
      };
    }
  }

  console.log('📊 Muscle Group Frequency:', muscleGroupFrequency);
  console.log('📊 Exercise Frequency:', exerciseFrequency);
  console.log('📊 Abs Metrics:', absMetrics);
  console.log('📈 Progression Analysis:', progressionAnalysis);

  return {
    recentTitles,
    muscleGroupFrequency,
    exerciseFrequency,
    absMetrics,
    progressionAnalysis
  };
}

// Pick exercises for the workout
function pickExercises(templates, muscleGroups, recentTitles, progressionAnalysis, numExercises = 4) {
  const usedTitles = new Set();
  const selectedExercises = [];
  const availableTemplates = [...templates];

  // Prioritize undertrained muscle groups
  const sortedMuscleGroups = [...muscleGroups].sort((a, b) => {
    const freqA = historyAnalysis.muscleGroupFrequency[a.toLowerCase()] || 0;
    const freqB = historyAnalysis.muscleGroupFrequency[b.toLowerCase()] || 0;
    return freqA - freqB;
  });

  // First pass: Ensure each muscle group is covered
  for (const muscle of sortedMuscleGroups) {
    const candidates = availableTemplates.filter(t => {
      const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
      return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title);
    });

    if (candidates.length > 0) {
      const usedEquipment = new Set(selectedExercises.map(ex => ex.equipment));
      candidates.sort((a, b) => {
        const aIsNewEquipment = usedEquipment.has(a.equipment) ? 1 : 0;
        const bIsNewEquipment = usedEquipment.has(b.equipment) ? 1 : 0;
        return aIsNewEquipment - bIsNewEquipment;
      });

      const selected = candidates[0];
      const progression = progressionAnalysis[selected.title];
      const note = progression
        ? `${progression.suggestion} (last: ${progression.lastWeightLbs} lbs x ${progression.lastReps} reps)`
        : "Start moderate and build";
      console.log(`✅ Selected: ${selected.title} (Muscle: ${muscle}, Equipment: ${selected.equipment}, Note: ${note})`);
      selectedExercises.push({ ...selected, note });
      usedTitles.add(selected.title);
    } else {
      console.log(`⚠️ No suitable template found for ${muscle}`);
    }
  }

  // Second pass: Fill remaining slots
  while (selectedExercises.length < numExercises) {
    const muscle = sortedMuscleGroups[Math.floor(Math.random() * sortedMuscleGroups.length)];
    const candidates = availableTemplates.filter(t => {
      const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
      return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title);
    });

    if (candidates.length === 0) {
      console.log(`⚠️ No more suitable templates found for ${muscle}. Stopping at ${selectedExercises.length} exercises.`);
      break;
    }

    const usedEquipment = new Set(selectedExercises.map(ex => ex.equipment));
    candidates.sort((a, b) => {
      const aIsNewEquipment = usedEquipment.has(a.equipment) ? 1 : 0;
      const bIsNewEquipment = usedEquipment.has(b.equipment) ? 1 : 0;
      return aIsNewEquipment - bIsNewEquipment;
    });

    const selected = candidates[0];
    const progression = progressionAnalysis[selected.title];
    const note = progression
      ? `${progression.suggestion} (last: ${progression.lastWeightLbs} lbs x ${progression.lastReps} reps)`
      : "Start moderate and build";
    console.log(`✅ Selected (additional): ${selected.title} (Muscle: ${muscle}, Equipment: ${selected.equipment}, Note: ${note})`);
    selectedExercises.push({ ...selected, note });
    usedTitles.add(selected.title);
  }

  return selectedExercises;
}

// Pick abs exercises
function pickAbsExercises(templates, recentTitles, numExercises = 4) {
  const absMuscles = ['abdominals', 'obliques'];
  const selectedExercises = [];
  const usedTitles = new Set();

  // Ensure variety: rectus abdominis, obliques, transverse abdominis
  const priorityExercises = [
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" }, // Rectus Abdominis
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" }, // Obliques
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" }, // Transverse Abdominis
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" }  // Additional abs exercise
  ];

  for (let i = 0; i < numExercises; i++) {
    const muscle = priorityExercises[i].muscle;
    const candidates = templates.filter(t => {
      const primaryMatch = (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase());
      const isOblique = i === 1 && (t.title.toLowerCase().includes('twist') || t.title.toLowerCase().includes('side'));
      const isTransverse = i === 2 && (t.title.toLowerCase().includes('plank') || t.title.toLowerCase().includes('dead bug'));
      const isRectus = i === 0 || i === 3;
      return primaryMatch && !recentTitles.has(t.title) && !usedTitles.has(t.title) &&
             (isRectus || (i === 1 && isOblique) || (i === 2 && isTransverse));
    });

    if (candidates.length > 0) {
      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`✅ Selected Abs: ${selected.title} (Muscle: ${muscle})`);
      selectedExercises.push({ ...selected, note: priorityExercises[i].note });
      usedTitles.add(selected.title);
    }
  }

  return selectedExercises;
}

// Create workout in Hevy
async function createWorkout(workoutType, exercises, absExercises) {
  const workout = {
    title: `CoachGPT – ${workoutType} + Abs`,
    exercises: [
      ...exercises.map(ex => {
        const progression = historyAnalysis.progressionAnalysis[ex.title];
        let weight_kg = 0;
        if (progression) {
          if (progression.suggestion.includes("Increase weight to")) {
            const suggestedWeightLbs = parseFloat(progression.suggestion.match(/Increase weight to (\d+\.\d+)/)[1]);
            weight_kg = suggestedWeightLbs / KG_TO_LBS;
          } else {
            weight_kg = parseFloat(progression.lastWeightLbs) / KG_TO_LBS;
          }
        }
        return {
          exercise_template_id: ex.id,
          sets: ex.title.toLowerCase().includes('plank') ? [
            { set_type: 'normal', duration: 45 },
            { set_type: 'normal', duration: 45 },
            { set_type: 'normal', duration: 45 }
          ] : [
            { set_type: 'normal', repetitions: 8, weight_kg: weight_kg },
            { set_type: 'normal', repetitions: 8, weight_kg: weight_kg },
            { set_type: 'normal', repetitions: 8, weight_kg: weight_kg }
          ],
          rest_seconds: ex.title.toLowerCase().includes('plank') ? 60 : 90,
          notes: ex.note || ''
        };
      }),
      ...absExercises.map(ex => {
        const progression = historyAnalysis.progressionAnalysis[ex.title];
        let weight_kg = 0;
        if (progression) {
          if (progression.suggestion.includes("Increase weight to")) {
            const suggestedWeightLbs = parseFloat(progression.suggestion.match(/Increase weight to (\d+\.\d+)/)[1]);
            weight_kg = suggestedWeightLbs / KG_TO_LBS;
          } else {
            weight_kg = parseFloat(progression.lastWeightLbs) / KG_TO_LBS;
          }
        }
        return {
          exercise_template_id: ex.id,
          sets: ex.title.toLowerCase().includes('plank') ? [
            { set_type: 'normal', duration: 45 },
            { set_type: 'normal', duration: 45 },
            { set_type: 'normal', duration: 45 }
          ] : [
            { set_type: 'normal', repetitions: 10, weight_kg: weight_kg },
            { set_type: 'normal', repetitions: 10, weight_kg: weight_kg },
            { set_type: 'normal', repetitions: 10, weight_kg: weight_kg }
          ],
          rest_seconds: 60,
          notes: ex.note || ''
        };
      })
    ]
  };

  const response = await axios.post(`${BASE_URL}/workouts`, workout, { headers });
  console.log(`Workout created: ${response.data.title}`);
  return response.data;
}

// Main function
async function autoplan({ workouts, templates, routines }) {
  try {
    // Set global exercise templates
    exerciseTemplates = templates.filter(t => !excludedExercises.has(t.title));

    // Analyze workout history
    historyAnalysis = analyzeHistory(workouts);

    // Determine workout type (following 7-day cycle)
    const today = new Date(); // Use current date
    const dayOfCycle = (today.getDate() - 1) % 7; // Simplified cycle logic (0-6)
    const workoutTypes = ['Push', 'Pull', 'Legs', 'Cardio', 'Push', 'Pull', 'Rest'];
    const workoutType = workoutTypes[dayOfCycle] || 'Pull'; // Default to Pull if something goes wrong

    if (workoutType === 'Rest') {
      console.log('Today is a rest day. No workout scheduled.');
      return { success: true, message: 'Rest day' };
    }

    if (workoutType === 'Cardio') {
      const cardioExercises = pickExercises(exerciseTemplates, ['Cardio'], historyAnalysis.recentTitles, historyAnalysis.progressionAnalysis, 1);
      const absExercises = pickAbsExercises(exerciseTemplates, historyAnalysis.recentTitles, 4);
      const workout = await createWorkout('Cardio', cardioExercises, absExercises);
      return { success: true, message: 'Cardio workout created', workout };
    }

    // Pick exercises for the main workout type
    const mainExercises = pickExercises(exerciseTemplates, muscleTargets[workoutType], historyAnalysis.recentTitles, historyAnalysis.progressionAnalysis, 4);
    const absExercises = pickAbsExercises(exerciseTemplates, historyAnalysis.recentTitles, 4);

    // Create the workout in Hevy
    const workout = await createWorkout(workoutType, mainExercises, absExercises);
    return { success: true, message: `${workoutType} workout created`, workout };
  } catch (err) {
    console.error('❌ Error in autoplan:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = autoplan;