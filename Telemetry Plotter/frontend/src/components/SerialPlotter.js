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
        await axios.post('https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/connect-serial', { portName });
        setPort(portName);
      } catch (err) {
        console.error('Connect error:', err);
      }
    };
    connectSerial();
    const source = new EventSource('https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/serial-data');
    source.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        console.log('Serial data:', newData);
        setData(prev => [...prev, newData].slice(-100));
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
      {parameters.map(param => (
        data.some(d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()])) && (
          <PlotGraph key={param} data={data} parameter={param} unit={units[param]} />
        )
      ))}
    </div>
  );
}

export default SerialPlotter;