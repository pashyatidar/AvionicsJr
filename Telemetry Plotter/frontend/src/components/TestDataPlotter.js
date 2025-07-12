import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      console.error('No file selected');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/upload-csv', formData);
      console.log('Upload response:', res.data);
      const fileData = await axios.get(`https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/read-csv/${encodeURIComponent(res.data.filePath)}`);
      console.log('Uploaded CSV data:', fileData.data);
      setData(fileData.data);
    } catch (err) {
      console.error('Upload/CSV error:', err.response?.data || err.message);
    }
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
          <button onClick={() => setSubMode('random')}>Random Data</button>
          <input type="file" accept=".csv" onChange={handleFileUpload} />
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
