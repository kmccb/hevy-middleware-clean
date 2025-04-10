const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_KEY = process.env.HEVY_API_KEY;
const BASE_URL = 'https://api.hevyapp.com/v1';
const headers = { 'api-key': API_KEY };
const KG_TO_LBS = 2.20462;

const muscleTargets = {
  Push: ['Chest', 'Shoulders', 'Triceps'],
  Pull: ['Lats', 'Upper Back', 'Biceps'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  Cardio: ['Cardio'],
  Abs: ['Abdominals', 'Obliques']
};

const muscleToWorkoutType = {
  chest: 'Push',
  shoulders: 'Push',
  triceps: 'Push',
  lats: 'Pull',
  upper_back: 'Pull',
  biceps: 'Pull',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  cardio: 'Cardio',
  full_body: 'Legs'
};

const excludedExercises = new Set([
  "Deadlift (Barbell)", "Deadlift (Dumbbell)", "Deadlift (Smith Machine)", "Deadlift (Trap Bar)",
  "Romanian Deadlift (Barbell)", "Romanian Deadlift (Dumbbell)",
  "Good Morning (Barbell)"
]);

const LAST_SCHEDULED_FILE = path.join(__dirname, 'data', 'last_scheduled.json');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readLastScheduled() {
  if (fs.existsSync(LAST_SCHEDULED_FILE)) {
    return JSON.parse(fs.readFileSync(LAST_SCHEDULED_FILE, 'utf-8'));
  }
  return { workoutType: null, date: null };
}

function writeLastScheduled(workoutType, date) {
  fs.writeFileSync(LAST_SCHEDULED_FILE, JSON.stringify({ workoutType, date: date.toISOString() }));
}

let exerciseTemplates = [];
let historyAnalysis = null;

function analyzeHistory(workouts) {
  const recentTitles = new Set();
  const muscleGroupFrequency = {};
  const exerciseFrequency = {};
  const absMetrics = { totalSessions: 0, exercises: new Set(), totalSets: 0 };
  const progressionData = {};

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  for (const workout of workouts) {
    let hasAbs = false;
    const workoutDate = new Date(workout.start_time);
    const isRecent = workoutDate >= oneDayAgo;

    for (const exercise of workout.exercises) {
      if (isRecent) {
        recentTitles.add(exercise.title);
      }

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
              volume: weight_lbs * set.reps
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
        const newWeightLbs = lastSet.weight_lbs * 1.05;
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

function determineWorkoutType(historyAnalysis, lastCompletedWorkout) {
  const lastScheduled = readLastScheduled();
  const today = new Date();
  const lastScheduledDate = lastScheduled.date ? new Date(lastScheduled.date) : null;

  if (lastScheduled.workoutType && lastScheduledDate) {
    const lastScheduledDateStr = lastScheduledDate.toISOString().split('T')[0];
    const lastCompletedDate = lastCompletedWorkout?.start_time ? new Date(lastCompletedWorkout.start_time).toISOString().split('T')[0] : null;

    if (!lastCompletedDate || lastScheduledDateStr > lastCompletedDate) {
      console.log(`🔄 Last scheduled workout (${lastScheduled.workoutType}) on ${lastScheduledDateStr} was not completed. Scheduling it again.`);
      return lastScheduled.workoutType;
    }
  }

  const muscleFrequencies = historyAnalysis.muscleGroupFrequency;
  const muscleGroups = Object.keys(muscleFrequencies);

  const undertrainedMuscles = muscleGroups
    .filter(m => !m.includes('abdominals') && !m.includes('obliques') && m !== 'cardio')
    .sort((a, b) => muscleFrequencies[a] - muscleFrequencies[b]);

  if (undertrainedMuscles.length === 0) {
    console.log('⚠️ No muscle groups to train (history might be empty). Defaulting to Push.');
    return 'Push';
  }

  const leastTrainedMuscle = undertrainedMuscles[0];
  const workoutType = muscleToWorkoutType[leastTrainedMuscle] || 'Push';
  console.log(`📅 Determined workout type: ${workoutType} (least trained muscle: ${leastTrainedMuscle}, frequency: ${muscleFrequencies[leastTrainedMuscle]})`);

  return workoutType;
}

function pickExercises(templates, muscleGroups, recentTitles, progressionAnalysis, numExercises = 4) {
  const usedTitles = new Set();
  const selectedExercises = [];
  const availableTemplates = [...templates];

  const sortedMuscleGroups = [...muscleGroups].sort((a, b) => {
    const freqA = historyAnalysis.muscleGroupFrequency[a.toLowerCase()] || 0;
    const freqB = historyAnalysis.muscleGroupFrequency[b.toLowerCase()] || 0;
    return freqA - freqB;
  });

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
      console.log(`⚠️ No suitable template found for ${muscle}. Available templates:`, availableTemplates
        .filter(t => (t.primary_muscle_group || '').toLowerCase().includes(muscle.toLowerCase()))
        .map(t => t.title));
    }
  }

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

function pickAbsExercises(templates, recentTitles, numExercises = 4) {
  const absMuscles = ['abdominals', 'obliques'];
  const selectedExercises = [];
  const usedTitles = new Set();

  const priorityExercises = [
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" },
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" },
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" },
    { muscle: 'abdominals', note: "Focus on slow, controlled reps" }
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

async function createWorkout(workoutType, exercises, absExercises) {
  const validExercises = exercises.filter(ex => ex.id && typeof ex.id === 'string');
  const validAbsExercises = absExercises.filter(ex => ex.id && typeof ex.id === 'string');

  if (validExercises.length === 0 && validAbsExercises.length === 0) {
    throw new Error('No valid exercises to create workout');
  }

  const findSimilarExerciseWeight = (exercise, progressionAnalysis) => {
    if (progressionAnalysis[exercise.title]) {
      const progression = progressionAnalysis[exercise.title];
      if (progression.suggestion.includes("Increase weight to")) {
        const suggestedWeightLbs = parseFloat(progression.suggestion.match(/Increase weight to (\d+\.\d+)/)[1]);
        return suggestedWeightLbs / KG_TO_LBS;
      }
      return parseFloat(progression.lastWeightLbs) / KG_TO_LBS;
    }

    const primaryMuscle = exercise.primary_muscle_group?.toLowerCase();
    const equipment = exercise.equipment?.toLowerCase();
    for (const [title, progression] of Object.entries(progressionAnalysis)) {
      const template = exerciseTemplates.find(t => t.title === title);
      if (template &&
          template.primary_muscle_group?.toLowerCase() === primaryMuscle &&
          template.equipment?.toLowerCase() === equipment) {
        console.log(`🔄 Using weight from similar exercise ${title} for ${exercise.title}`);
        if (progression.suggestion.includes("Increase weight to")) {
          const suggestedWeightLbs = parseFloat(progression.suggestion.match(/Increase weight to (\d+\.\d+)/)[1]);
          return suggestedWeightLbs / KG_TO_LBS;
        }
        return parseFloat(progression.lastWeightLbs) / KG_TO_LBS;
      }
    }
    if (equipment === 'resistance_band') {
      return 10;
    }
    return 0;
  };

  const now = new Date();
  const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0);
  const startTimeISO = startTime.toISOString();

  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + 1);
  const endTimeISO = endTime.toISOString();

  const workoutPayload = {
    title: `CoachGPT – ${workoutType} + Abs`,
    start_time: startTimeISO,
    end_time: endTimeISO,
    exercises: [
      ...validExercises.map(ex => {
        const weight_kg = findSimilarExerciseWeight(ex, historyAnalysis.progressionAnalysis);
        const isDurationBased = ex.title.toLowerCase().includes('plank');
        const isBodyweight = !ex.equipment || ex.equipment === 'none';
        const progression = historyAnalysis.progressionAnalysis[ex.title];
        const note = progression
          ? `${progression.suggestion} (last: ${progression.lastWeightLbs} lbs x ${progression.lastReps} reps)`
          : (weight_kg > 0 ? `Start with ${Math.round(weight_kg * KG_TO_LBS)} lbs${ex.equipment === 'resistance_band' ? ' (equivalent for resistance band)' : ' (based on similar exercise)'}` : (isBodyweight ? "Bodyweight exercise" : "Start moderate and build"));
        return {
          exercise_template_id: ex.id,
          sets: isDurationBased ? [
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null },
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null },
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null }
          ] : [
            { type: 'normal', repetitions: 8, weight_kg: weight_kg, duration: null },
            { type: 'normal', repetitions: 8, weight_kg: weight_kg, duration: null },
            { type: 'normal', repetitions: 8, weight_kg: weight_kg, duration: null }
          ],
          rest_seconds: isDurationBased ? 60 : 90,
          notes: note
        };
      }),
      ...validAbsExercises.map(ex => {
        const weight_kg = findSimilarExerciseWeight(ex, historyAnalysis.progressionAnalysis);
        const isDurationBased = ex.title.toLowerCase().includes('plank');
        const isWeighted = ex.title.toLowerCase().includes('weighted') || ex.title.toLowerCase().includes('cable');
        let finalWeightKg = weight_kg;
        if (isWeighted && weight_kg === 0) {
          finalWeightKg = 5;
        }
        const progression = historyAnalysis.progressionAnalysis[ex.title];
        const note = progression
          ? `${progression.suggestion} (last: ${progression.lastWeightLbs} lbs x ${progression.lastReps} reps)`
          : (finalWeightKg > 0 ? `Start with ${Math.round(finalWeightKg * KG_TO_LBS)} lbs` : "Focus on slow, controlled reps");
        return {
          exercise_template_id: ex.id,
          sets: isDurationBased ? [
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null },
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null },
            { type: 'normal', duration: 45, weight_kg: 0, repetitions: null }
          ] : [
            { type: 'normal', repetitions: 10, weight_kg: finalWeightKg, duration: null },
            { type: 'normal', repetitions: 10, weight_kg: finalWeightKg, duration: null },
            { type: 'normal', repetitions: 10, weight_kg: finalWeightKg, duration: null }
          ],
          rest_seconds: 60,
          notes: note
        };
      })
    ]
  };

  const payload = {
    workout: workoutPayload
  };

  console.log('📤 Workout payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(`${BASE_URL}/workouts`, payload, { headers });
    console.log(`Workout created: ${response.data.title}`);
    return response.data;
  } catch (err) {
    console.error('❌ Failed to create workout:', err.response?.data || err.message);
    throw err;
  }
}

async function autoplan({ workouts, templates, routines }) {
  try {
    exerciseTemplates = templates.filter(t => !excludedExercises.has(t.title));
    historyAnalysis = analyzeHistory(workouts);
    const lastCompletedWorkout = workouts.length > 0 ? workouts[0] : null;
    const workoutType = determineWorkoutType(historyAnalysis, lastCompletedWorkout);
    const today = new Date();
    writeLastScheduled(workoutType, today);

    if (workoutType === 'Cardio') {
      const cardioExercises = pickExercises(exerciseTemplates, ['Cardio'], historyAnalysis.recentTitles, historyAnalysis.progressionAnalysis, 1);
      const absExercises = pickAbsExercises(exerciseTemplates, historyAnalysis.recentTitles, 4);
      const workout = await createWorkout('Cardio', cardioExercises, absExercises);
      return { success: true, message: 'Cardio workout created', workout };
    }

    const mainExercises = pickExercises(exerciseTemplates, muscleTargets[workoutType], historyAnalysis.recentTitles, historyAnalysis.progressionAnalysis, 4);
    const absExercises = pickAbsExercises(exerciseTemplates, historyAnalysis.recentTitles, 4);
    const workout = await createWorkout(workoutType, mainExercises, absExercises);
    return { success: true, message: `${workoutType} workout created`, workout };
  } catch (err) {
    console.error('❌ Error in autoplan:', err.message);
    const detailedError = err.response?.data?.error || err.message;
    return { success: false, error: `Request failed with status code 400: ${detailedError}` };
  }
}

module.exports = autoplan;