// chartService.js (QuickChart version)
const axios = require("axios");
const moment = require("moment");

function normalizeDateLabels(data) {
  return data.map(entry => moment(entry.date).format("YYYY-MM-DD"));
}

function parseNumeric(data, key) {
  return data.map(entry => {
    const val = parseFloat(entry[key]);
    return isNaN(val) ? null : val;
  });
}

async function generateChartImage(labels, values, labelName, yLabel, color) {
  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: labelName,
          data: values,
          fill: true,
          borderColor: color,
          backgroundColor: color.replace("1)", "0.2)"),
          pointRadius: 3,
          tension: 0.3
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yLabel
          }
        },
        x: {
          title: {
            display: true,
            text: "Date"
          }
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }
  };

  const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data, "binary");
}

module.exports = {
  generateWeightChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "weight");
    return generateChartImage(labels, values, "Weight", "Weight (lbs)", "rgba(54, 162, 235, 1)");
  },

  generateStepsChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "steps");
    return generateChartImage(labels, values, "Steps", "Steps", "rgba(255, 206, 86, 1)");
  },

  generateMacrosChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "protein");
    return generateChartImage(labels, values, "Protein", "Protein (g)", "rgba(75, 192, 192, 1)");
  },

  generateCaloriesChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "calories");
    return generateChartImage(labels, values, "Calories", "Calories", "rgba(255, 99, 132, 1)");
  }
};
