// chartService.js
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const moment = require('moment');

const width = 800; // px
const height = 400; // px
const backgroundColour = 'white';
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour });

function normalizeDateLabels(data) {
  return data.map(entry => moment(entry.date).format("YYYY-MM-DD"));
}

function parseNumeric(data, key) {
  return data.map(entry => {
    const val = parseFloat(entry[key]);
    return isNaN(val) ? null : val;
  });
}

async function generateLineChart(data, label, yLabel) {
  const labels = normalizeDateLabels(data);
  const values = parseNumeric(data, label);

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: yLabel,
        data: values,
        fill: true,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.3
      }]
    },
    options: {
      responsive: false,
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
            text: 'Date'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 20,
            font: {
              size: 12
            }
          }
        }
      }
    }
  };

  return await chartJSNodeCanvas.renderToBuffer(config);
}

module.exports = {
  generateWeightChart: async (data) => generateLineChart(data, 'weight', 'Weight (lbs)'),
  generateStepsChart: async (data) => generateLineChart(data, 'steps', 'Steps'),
  generateMacrosChart: async (data) => generateLineChart(data, 'protein', 'Protein (g)'), // you can duplicate this for carbs/fat if needed
  generateCaloriesChart: async (data) => generateLineChart(data, 'calories', 'Calories')
};
