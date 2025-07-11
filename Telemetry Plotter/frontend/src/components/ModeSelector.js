import React from 'react';

function ModeSelector({ setMode }) {
  console.log('Rendering ModeSelector'); // Debug
  return (
    <div>
      <h2>Select Mode</h2>
      <button onClick={() => setMode('serial')}>Serial Port</button>
      <button onClick={() => setMode('csv')}>CSV File</button>
      <button onClick={() => setMode('test')}>Test Data</button>
    </div>
  );
}

export default ModeSelector;