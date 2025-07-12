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
        max: mode === 'test' && data.length > 0
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
            return `${tooltipItems[0].parsed.x.toFixed(3)} s`;
          }
        }
      },
      annotation: {
        annotations
      }
    }
  };


  let status = null;
  let statusColor = null;
  if (parameter.toLowerCase() === 'thrust') {
    const validData = data.filter(d => d.thrust != null && !isNaN(d.thrust));
    const latest = validData[validData.length - 1];
    const thrust = latest ? parseFloat(latest.thrust) : 0;
    if (thrust > 250) {
      status = 'LAUNCH';
      statusColor = 'red';
    } else if (thrust > 100) {
      status = 'ARM';
      statusColor = 'orange';
    } else {
      status = 'SAFE';
      statusColor = 'green';
    }
  }

  return (
    <div style={{ width: '1000px', height: '440px', margin: '20px auto', color: 'white', textAlign: 'center' }}>
      {status && (
        <button
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '10px',
            backgroundColor: statusColor,
            color: 'white',
            marginBottom: '15px',
            border: 'none',
            boxShadow: '0 0 10px ' + statusColor,
          }}
        >
          {status}
        </button>
      )}

      <Line data={chartData} options={options} />
    </div>
  );
}

export default PlotGraph;
