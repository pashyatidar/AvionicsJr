const express = require('express');   //web server framework
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

app.post('/connect-serial', (req, res) => {
  console.log('Serial port connected:', req.body.portName);
  res.json({ message: 'Serial port connected' });
});

app.get('/serial-data', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  const interval = setInterval(() => {
    const data = {
      time: new Date().toISOString(),
      pressure: Math.random() * 1000,
      thrust: Math.random() * 100,
      temperature: Math.random() * 50
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 100);
  req.on('close', () => clearInterval(interval));
});

app.post('/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('File uploaded:', req.file.path);
  res.json({ filePath: req.file.path });
});

app.get('/read-csv/:filePath', (req, res) => {
  const results = [];
  const filePath = decodeURIComponent(req.params.filePath);
  console.log('Reading CSV file:', filePath);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return res.status(404).json({ error: 'File not found' });
  }
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('headers', (headers) => {
      console.log('CSV headers:', headers);
    })
    .on('data', (row) => {
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        const normalizedKey = key.trim().toLowerCase();
        if (['timestamp', 'time'].includes(normalizedKey)) {
          normalizedRow.time = row[key];
        } else if (['pressure', 'thrust', 'temperature'].includes(normalizedKey)) {
          normalizedRow[normalizedKey] = row[key] ? parseFloat(row[key]) : null;
        }
      });
      if (normalizedRow.time && !isNaN(new Date(normalizedRow.time).getTime())) {
        results.push(normalizedRow);
      } else {
        console.warn('Invalid row skipped:', row);
      }
    })
    .on('end', () => {
      console.log('Parsed CSV data:', results);
      if (results.length === 0) {
        console.warn('No valid data parsed from CSV');
      }
      res.json(results);
    })
    .on('error', (err) => {
      console.error('CSV parse error:', err);
      res.status(500).json({ error: 'Failed to parse CSV' });
    });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
