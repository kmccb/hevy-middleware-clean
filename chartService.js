// chartService.js
const axios = require("axios");

/**
 * Generates a chart image from QuickChart
 * @param {Object} config - Chart.js config object
 * @returns {Buffer}
 */
async function generateQuickChart(config) {
  const url = "https://quickchart.io/chart";
  const response = await axios.post(url, { chart: config }, { responseType: "arraybuffer" });
  return response.data;
}

async function generateWeightChart(data) {
  const labels = data.map(d => d.date);
  const weights = data.map(d => parseFloat(d.weight));
  return await generateQuickChart({
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Weight (lbs)", data: weights }]
    }
  });
}

async function generateStepsChart(data) {
  const labels = data.map(d => d.date);
  const steps = data.map(d => parseInt(d.steps || 0));
  return await generateQuickChart({
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Steps", data: steps }]
    }
  });
}

async function generateMacrosChart(data) {
  const labels = data.map(d => d.date);
  return await generateQuickChart({
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Protein", data: data.map(d => parseInt(d.protein || 0)), borderColor: "green" },
        { label: "Carbs", data: data.map(d => parseInt(d.carbs || 0)), borderColor: "blue" },
        { label: "Fat", data: data.map(d => parseInt(d.fat || 0)), borderColor: "orange" }
      ]
    }
  });
}

async function generateCaloriesChart(data) {
  const labels = data.map(d => d.date);
  const calories = data.map(d => parseInt(d.calories || 0));
  return await generateQuickChart({
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Calories", data: calories }]
    }
  });
}

module.exports = {
  generateWeightChart,
  generateStepsChart,
  generateMacrosChart,
  generateCaloriesChart
};
