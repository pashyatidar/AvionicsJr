import React, { useState, useEffect } from 'react';
import PlotGraph from './PlotGraph';

function TestDataPlotter() {
  const [subMode, setSubMode] = useState('');
  const [data, setData] = useState([]);

  const generateRandomData = () => {
    const newData = {
      time: new Date().toISOString(),
      pressure: Math.random() * 1000,
      thrust: Math.random() * 500,
      temperature: Math.random() * 50
    };
    console.log('Random data:', newData);
    setData(prev => [...prev, newData]);
  };

  useEffect(() => {
    if (subMode === 'random') {
      const interval = setInterval(generateRandomData, 5);
      return () => clearInterval(interval);
    }
  }, [subMode]);

  const parameters = ['Pressure', 'Thrust', 'Temperature'];
  const units = { Pressure: 'mbar', Thrust: 'N', Temperature: '°C' };

  return (
    <div>
      <h2>Test Data</h2>
      {!subMode && (
        <div>
          <button onClick={() => setSubMode('random')}>Start Random Data</button>
        </div>
      )}
      {subMode && parameters.map(param => {
        const hasValidData = data.some(d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()]));
        console.log(`Checking ${param} data:`, hasValidData, data.map(d => d[param.toLowerCase()]));
        return hasValidData && (
          <PlotGraph
            key={param}
            data={data}
            parameter={param}
            unit={units[param]}
            mode="test"
          />
        );
      })}
    </div>
  );
}

export default TestDataPlotter;
