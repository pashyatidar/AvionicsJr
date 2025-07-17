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
import 'chartjs-adapter-date-fns';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

function PlotGraph({ data, parameter, unit }) {
  if (!data || !Array.isArray(data) || data.length === 0 || !data.some(d => d[parameter.toLowerCase()] != null && !isNaN(d[parameter.toLowerCase()]))) {
    console.log(`No valid data for ${parameter}:`, data);
    return <div style={{ color: 'red', textAlign: 'center' }}>No valid data available for {parameter}</div>;
  }

  const startTime = new Date(data[0].time).getTime();

  const formatTime = (time) => {
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  const chartData = {
    datasets: [{
      label: `${parameter} (${unit})`,
      data: data.map(d => ({
        x: (new Date(d.time).getTime() - startTime) / 1000, // Relative seconds
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
          text: 'Time (HH:mm:ss)'
        },
        ticks: {
          callback: (value) => {
            const date = new Date(startTime + value * 1000);
            return formatTime(date);
          }
        },
        min: 0,
        max: data.length > 0
          ? ((new Date(data[data.length - 1].time).getTime() - startTime) / 1000) + 1
          : undefined
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
            const seconds = tooltipItems[0].parsed.x;
            const date = new Date(startTime + seconds * 1000);
            return formatTime(date);
          }
        }
      }
    }
  };

  return (
    <div style={{ width: '1000px', height: '400px', margin: '20px auto', color: 'white', textAlign: 'center' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

export default PlotGraph;