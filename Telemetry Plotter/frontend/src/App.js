import React, { useState } from 'react';
import SerialPlotter from './components/SerialPlotter';
import TestDataPlotter from './components/TestDataPlotter';
import RandomDataPlotter from './components/RandomDataPlotter';
import './App.css';

function App() {
  const [mode, setMode] = useState('');

  return (
    <div className="App">
      <h1>Telemetry Plotter</h1>
      {!mode && (
        <div>
          <button onClick={() => setMode('serial')}>Serial Data</button>
          <button onClick={() => setMode('csv')}>CSV Upload</button>
          <button onClick={() => setMode('random')}>Random Data</button>
        </div>
      )}
      {mode === 'serial' && <SerialPlotter />}
      {mode === 'csv' && <TestDataPlotter />}
      {mode === 'random' && <RandomDataPlotter />}
    </div>
  );
}

export default App;