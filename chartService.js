// chartService.js (QuickChart with 800x400 and return averages for email summaries)
const axios = require("axios");
const moment = require("moment");

function normalizeDateLabels(data) {
  return data.map(entry => moment(entry.date).format("YYYY-MM-DD"));
}

function parseNumeric(data, key) {
  return data.map(entry => {
    const raw = entry[key];
    if (!raw) return null;
    const cleaned = typeof raw === "string" ? raw.replace(/,/g, "").trim() : raw;
    const val = parseFloat(cleaned);
    return isNaN(val) || val <= 0 ? null : val;
  });
}

function average(values) {
  const filtered = values.filter(v => v !== null);
  if (filtered.length === 0) return 0;
  const total = filtered.reduce((a, b) => a + b, 0);
  return Math.round(total / filtered.length);
}

async function generateChartImage(labels, datasets, title) {
  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Amount"
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
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16
          }
        }
      }
    }
  };

   const url = `https://quickchart.io/chart?width=400&height=200&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data, "binary");
}

module.exports = {
  generateWeightChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "weight");
    const avg = average(values);
    const buffer = await generateChartImage(labels, [
      {
        label: "Weight",
        data: values,
        fill: true,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        pointRadius: 3,
        tension: 0.3
      }
    ], `Weight Trend (Last 30 Days) - Average ${avg} lbs`);
    return { buffer, average: avg };
  },

  generateStepsChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "steps");
    const avg = average(values);
    const buffer = await generateChartImage(labels, [
      {
        label: "Steps",
        data: values,
        fill: true,
        borderColor: "rgba(255, 206, 86, 1)",
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        pointRadius: 3,
        tension: 0.3
      }
    ], `Steps Trend (Last 30 Days) - Average ${avg}`);
    return { buffer, average: avg };
  },

  generateMacrosChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const protein = parseNumeric(data, "protein");
    const carbs = parseNumeric(data, "carbs");
    const fat = parseNumeric(data, "fat");
    const avgP = average(protein);
    const avgC = average(carbs);
    const avgF = average(fat);

    const datasets = [
      {
        label: "Protein",
        data: protein,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: false,
        pointRadius: 3,
        tension: 0.3
      },
      {
        label: "Carbs",
        data: carbs,
        borderColor: "rgba(153, 102, 255, 1)",
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        fill: false,
        pointRadius: 3,
        tension: 0.3
      },
      {
        label: "Fat",
        data: fat,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        fill: false,
        pointRadius: 3,
        tension: 0.3
      }
    ];

    const title = `Macro Trend (Last 30 Days) - Avg P: ${avgP}g, C: ${avgC}g, F: ${avgF}g`;
    const buffer = await generateChartImage(labels, datasets, title);
    return { buffer, average: { protein: avgP, carbs: avgC, fat: avgF } };
  },

  generateCaloriesChart: async (data) => {
    const labels = normalizeDateLabels(data);
    const values = parseNumeric(data, "calories");
    const avg = average(values);
    const buffer = await generateChartImage(labels, [
      {
        label: "Calories",
        data: values,
        fill: true,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        pointRadius: 3,
        tension: 0.3
      }
    ], `Calorie Trend (Last 30 Days) - Average ${avg} kcal`);
    return { buffer, average: avg };
  }
};
