import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PlotGraph from './PlotGraph';

function CSVPlotter() {
  const [data, setData] = useState([]);
  const [filePath, setFilePath] = useState('');

  useEffect(() => {
    const file = prompt('Enter CSV file path (e.g., data/sample.csv):');
    setFilePath(file);
    axios.get(`https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/read-csv/${encodeURIComponent(file)}`)
      .then(res => {
        console.log('CSV data:', res.data);
        setData(res.data);
      })
      .catch(err => console.error('CSV error:', err.response?.data || err.message));
  }, []);

  const parameters = ['Pressure', 'Thrust', 'Temperature'];
  const units = { Pressure: 'mbar', Thrust: 'N', Temperature: '°C' };

  return (
    <div>
      <h2>CSV File Data ({filePath})</h2>
      {parameters.map(param => {
        const hasValidData = data.some(d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()]));
        console.log(`Checking ${param} data:`, hasValidData, data.map(d => d[param.toLowerCase()]));
        return hasValidData && (
          <PlotGraph key={param} data={data} parameter={param} unit={units[param]} />
        );
      })}
    </div>
  );
}

export default CSVPlotter;