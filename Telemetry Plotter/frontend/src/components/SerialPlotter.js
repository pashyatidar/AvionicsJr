import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PlotGraph from './PlotGraph';

function SerialPlotter() {
  const [data, setData] = useState([]);
  const [port, setPort] = useState('');

  useEffect(() => {
    const connectSerial = async () => {
      const portName = prompt('Enter serial port (e.g., COM3):');
      try {
        await axios.post('http://localhost:5000/connect-serial', { portName });
        setPort(portName);
      } catch (err) {
        console.error('Connect error:', err);
      }
    };
    connectSerial();

    const source = new EventSource('http://localhost:5000/serial-data');
    source.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        // Ensure time is in ISO format for consistency
        newData.time = new Date(newData.time).toISOString();
        console.log('Serial data:', newData);
        setData(prev => {
          const updatedData = [...prev, newData].slice(-100); // Keep last 100 points
          return updatedData.map(d => ({
            time: d.time,
            pressure: d.pressure != null ? parseFloat(d.pressure) : null,
            thrust: d.thrust != null ? parseFloat(d.thrust) : null,
            temperature: d.temperature != null ? parseFloat(d.temperature) : null
          }));
        });
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    source.onerror = (err) => console.error('SSE error:', err);
    return () => source.close();
  }, []);

  const parameters = ['Pressure', 'Thrust', 'Temperature'];
  const units = { Pressure: 'mbar', Thrust: 'N', Temperature: '°C' };

  return (
    <div>
      <h2>Serial Port Data (Port: {port})</h2>
      {parameters.map(param => {
        const hasValidData = data.some(d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()]));
        return hasValidData ? (
          <PlotGraph
            key={param}
            data={data}
            parameter={param}
            unit={units[param]}
            mode="serial"
          />
        ) : null;
      })}
    </div>
  );
}

export default SerialPlotter;