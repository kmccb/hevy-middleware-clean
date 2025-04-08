// chartService.js
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const { registerFont } = require("canvas");



const width = 800;
const height = 400;
const chartCallback = (ChartJS) => {
  
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

/**
 * Helper to generate a line chart buffer given labels and datasets
 */
async function generateLineChart(title, labels, datasets) {
  const config = {
    type: "line",
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        fill: false,
        borderColor: ds.borderColor || "blue",
        tension: 0.1
      }))
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: title
        },
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(config);
}

/**
 * Weight trend line over time
 */
async function generateWeightChart(data) {
  const labels = data.map(d => d.date);
  const weights = data.map(d => parseFloat(d.weight));
  return await generateLineChart("Weight Trend", labels, [
    { label: "Weight (lbs)", data: weights }
  ]);
}

/**
 * Steps trend
 */
async function generateStepsChart(data) {
  const labels = data.map(d => d.date);
  const steps = data.map(d => parseInt(d.steps || 0));
  return await generateLineChart("Daily Steps", labels, [
    { label: "Steps", data: steps }
  ]);
}

/**
 * Macros trend (Protein / Fat / Carbs)
 */
async function generateMacrosChart(data) {
  const labels = data.map(d => d.date);
  return await generateLineChart("Macros", labels, [
    { label: "Protein", data: data.map(d => parseInt(d.protein || 0)), borderColor: "green" },
    { label: "Carbs", data: data.map(d => parseInt(d.carbs || 0)), borderColor: "blue" },
    { label: "Fat", data: data.map(d => parseInt(d.fat || 0)), borderColor: "orange" }
  ]);
}

/**
 * Calorie trend
 */
async function generateCaloriesChart(data) {
  const labels = data.map(d => d.date);
  const calories = data.map(d => parseInt(d.calories || 0));
  return await generateLineChart("Calories", labels, [
    { label: "Calories", data: calories }
  ]);
}

module.exports = {
  generateWeightChart,
  generateStepsChart,
  generateMacrosChart,
  generateCaloriesChart
};
