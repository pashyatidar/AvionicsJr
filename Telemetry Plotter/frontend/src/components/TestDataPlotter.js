import React, { useState } from 'react';
import axios from 'axios';
import PlotGraph from './PlotGraph';

function TestDataPlotter() {
  const [data, setData] = useState([]);
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) {
      setUploadStatus('No file selected');
      return;
    }
    setFile(selectedFile);
    setUploadStatus(`File selected: ${selectedFile.name}`);
    setErrorMessage(''); // Clear any previous error
    setData([]); // Reset data until "Run" is clicked
    setFilePath(''); // Reset file path
  };

  const handleRun = async () => {
    if (!file) {
      setErrorMessage('Please upload a CSV file before running.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus('Uploading...');
      const uploadResponse = await axios.post(
        'https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/upload-csv',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const { filePath } = uploadResponse.data;
      setFilePath(filePath);
      setUploadStatus('File uploaded successfully');

      // Fetch the parsed CSV data
      const csvResponse = await axios.get(
        `https://laughing-space-invention-jj9qr495976gc549x-5000.app.github.dev/read-csv/${encodeURIComponent(filePath)}`
      );
      console.log('CSV data:', csvResponse.data);
      setData(csvResponse.data);
      setErrorMessage('');
    } catch (err) {
      console.error('Upload or CSV error:', err.response?.data || err.message);
      setUploadStatus('');
      setErrorMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const parameters = ['Pressure', 'Thrust', 'Temperature'];
  const units = { Pressure: 'mbar', Thrust: 'N', Temperature: '°C' };

  return (
    <div>
      <h2>CSV Upload Mode</h2>
      <div style={{ marginBottom: '20px' }}>
        <h3>Upload CSV File</h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ margin: '10px' }}
        />
        <button onClick={handleRun}>Run</button>
        <p>{uploadStatus}</p>
        {errorMessage && (
          <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMessage}</p>
        )}
        <div style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
          <h4>Expected CSV Structure:</h4>
          <p>
            The CSV file should contain a <strong>time</strong> or{' '}
            <strong>timestamp</strong> column in <strong>HH:mm:ss</strong> format
            and at least one of the following sensor columns:{' '}
            <strong>pressure</strong>, <strong>thrust</strong>, or{' '}
            <strong>temperature</strong>. Case-insensitive column names are
            supported. Example:
          </p>
          <pre style={{ background: '#f4f4f4', padding: '10px', borderRadius: '4px' }}>
            time,pressure,thrust,temperature
            12:00:00,1013.25,150.5,25.0
            12:00:01,1013.30,151.0,25.1
          </pre>
          <p>If some sensor columns are missing, only the available data will be plotted.</p>
        </div>
      </div>
      {data.length > 0 && (
        <div>
          <h3>Data from: {filePath.split('/').pop()}</h3>
          {parameters.map(param => {
            const hasValidData = data.some(
              d => d[param.toLowerCase()] != null && !isNaN(d[param.toLowerCase()])
            );
            console.log(`Checking ${param} data:`, hasValidData, data.map(d => d[param.toLowerCase()]));
            return hasValidData ? (
              <PlotGraph
                key={param}
                data={data}
                parameter={param}
                unit={units[param]}
                mode="csv"
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export default TestDataPlotter;