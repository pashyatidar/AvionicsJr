import React, { useState } from 'react';
import SerialPlotter from './components/SerialPlotter';
import CSVPlotter from './components/CSVPlotter';
import TestDataPlotter from './components/TestDataPlotter';
import './App.css';

function App() {
  const [mode, setMode] = useState('');

  return (
    <div className="App">
      <h1>Telemetry Plotter</h1>
      {!mode && (
        <div>
          <button onClick={() => setMode('serial')}>Serial Port</button>
          <button onClick={() => setMode('csv')}>CSV File</button>
          <button onClick={() => setMode('test')}>Test Data</button>
        </div>
      )}
      {mode === 'serial' && <SerialPlotter />}
      {mode === 'csv' && <CSVPlotter />}
      {mode === 'test' && <TestDataPlotter />}
    </div>
  );
}

export default App;