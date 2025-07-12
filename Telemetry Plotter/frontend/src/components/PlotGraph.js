import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

function PlotGraph({ data, parameter, unit, mode }) {
  if (!data || !Array.isArray(data) || data.length === 0 || !data.some(d => d[parameter.toLowerCase()] != null && !isNaN(d[parameter.toLowerCase()]))) {
    console.log(`No valid data for ${parameter}:`, data);
    return <div style={{ color: 'red', textAlign: 'center' }}>No valid data available for {parameter}</div>;
  }

  const startTime = new Date(data[0].time).getTime();
  const annotations = mode === 'test' && data.length > 0 ? data.reduce((acc, d, index) => {
    if (index % 50 === 0 && index !== 0) {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFFF00'];
      const markerIndex = Math.floor(index / 50);
      const relativeSeconds = (new Date(d.time).getTime() - startTime) / 1000;
      acc[`mark-${markerIndex}`] = {
        type: 'line',
        xMin: relativeSeconds,
        xMax: relativeSeconds,
        borderColor: colors[markerIndex % colors.length],
        borderWidth: 2,
        label: {
          content: `mark-${markerIndex} (${relativeSeconds.toFixed(3)})`,
          display: true,
          position: 'top',
          backgroundColor: colors[markerIndex % colors.length],
          color: '#000',
          padding: 4
        }
      };
    }
    return acc;
  }, {}) : {};

  const chartData = {
    datasets: [{
      label: `${parameter} (${unit})`,
      data: data.map(d => ({
        x: (new Date(d.time).getTime() - startTime) / 1000,
        y: d[parameter.toLowerCase()] != null && !isNaN(d[parameter.toLowerCase()]) ? parseFloat(d[parameter.toLowerCase()]) : null
      })),
      borderColor: 'rgba(75, 192, 192, 1)',
      fill: false,
      pointRadius: 0
    }]
  };

  const options = {
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (seconds)'
        },
        min: 0,
        max: mode === 'test' && data.length > 0 ? ((new Date(data[data.length - 1].time).getTime() - startTime) / 1000) + 1 : undefined
      },
      y: {
        title: {
          display: true,
          text: unit
        }
      }
    },
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            return `${tooltipItems[0].parsed.x.toFixed(3)} s`;
          }
        }
      },
      annotation: {
        annotations
      }
    }
  };

  console.log(`Rendering ${parameter} graph with data:`, chartData.datasets[0].data);
  const latestPoint = [...chartData.datasets[0].data].reverse().find(point => point.y !== null);
  const latestValue = latestPoint ? latestPoint.y.toFixed(2) : 'N/A';
  const latestTime = latestPoint ? latestPoint.x.toFixed(3) : 'N/A';

return (
  <div style={{ width: '1000px', height: '420px', margin: '20px auto', color: 'white', textAlign: 'center' }}>
    <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '16px' }}>
      Latest {parameter}: {latestValue} {unit} at {latestTime} s
    </div>
    <Line data={chartData} options={options} />
  </div>
);

}

export default PlotGraph;
