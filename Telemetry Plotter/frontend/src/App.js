import React, { useState } from 'react';
import SerialPlotter from './components/SerialPlotter';
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
          <button onClick={() => setMode('test')}>Test Data</button>
        </div>
      )}
      {mode === 'serial' && <SerialPlotter />}
      {mode === 'test' && <TestDataPlotter />}
    </div>
  );
}

export default App;
