import React, { useState, useEffect } from 'react';
import PlotGraph from './PlotGraph';

function RandomDataPlotter() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newData = {
        time: new Date().toISOString(),
        pressure: Math.random() * 1000,
        thrust: Math.random() * 100,
        temperature: Math.random() * 50
      };
      setData(prev => {
        const updatedData = [...prev, newData].slice(-100); // Keep last 100 points
        return updatedData.map(d => ({
          time: d.time,
          pressure: d.pressure != null ? parseFloat(d.pressure) : null,
          thrust: d.thrust != null ? parseFloat(d.thrust) : null,
          temperature: d.temperature != null ? parseFloat(d.temperature) : null
        }));
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const parameters = ['Pressure', 'Thrust', 'Temperature'];
  const units = { Pressure: 'mbar', Thrust: 'N', Temperature: '°C' };

  return (
    <div>
      <h2>Random Data</h2>
      {parameters.map(param => {
        const hasValidData = data.some(
          d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()])
        );
        return hasValidData ? (
          <PlotGraph
            key={param}
            data={data}
            parameter={param}
            unit={units[param]}
            mode="random"
          />
        ) : null;
      })}
    </div>
  );
}

export default RandomDataPlotter;