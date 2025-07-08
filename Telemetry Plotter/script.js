// DOM elements
const connectButton = document.getElementById('connect-button');
const statusElement = document.getElementById('connection-status');
const temperatureElement = document.getElementById('temperature');
const pressureElement = document.getElementById('pressure');
const altitudeElement = document.getElementById('altitude');

// Chart.js setup
const maxDataPoints = 20; // Limit to 20 data points for performance
const temperatureChart = new Chart(document.getElementById('temperature-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: '#ff6384',
            fill: false
        }]
    },
    options: {
        scales: {
            x: { display: true, title: { display: true, text: 'Time' } },
            y: { display: true, title: { display: true, text: 'Temperature (°C)' } }
        }
    }
});

const pressureChart = new Chart(document.getElementById('pressure-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Pressure (hPa)',
            data: [],
            borderColor: '#36a2eb',
            fill: false
        }]
    },
    options: {
        scales: {
            x: { display: true, title: { display: true, text: 'Time' } },
            y: { display: true, title: { display: true, text: 'Pressure (hPa)' } }
        }
    }
});

const altitudeChart = new Chart(document.getElementById('altitude-chart'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Altitude (m)',
            data: [],
            borderColor: '#4bc0c0',
            fill: false
        }]
    },
    options: {
        scales: {
            x: { display: true, title: { display: true, text: 'Time' } },
            y: { display: true, title: { display: true, text: 'Altitude (m)' } }
        }
    }
});

// Web Serial API setup
let port;
let reader;
let keepReading = false;

async function connectToSerial() {
    try {
        // Request serial port
        port = await navigator.serial.requestPort({});
        await port.open({ baudRate: 115200 }); // Match microcontroller baud rate

        statusElement.textContent = 'Connected';
        statusElement.classList.add('connected');
        connectButton.disabled = true;

        keepReading = true;
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        // Read data loop
        while (keepReading) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            try {
                const data = JSON.parse(value.trim());
                updateDashboard(data);
            } catch (error) {
                console.error('Error parsing serial data:', error);
            }
        }
    } catch (error) {
        console.error('Serial connection error:', error);
        statusElement.textContent = 'Error';
        connectButton.disabled = false;
    }
}

function updateDashboard(data) {
    // Update text displays
    temperatureElement.textContent = `${data.temperature.toFixed(1)} °C`;
    pressureElement.textContent = `${data.pressure.toFixed(1)} hPa`;
    altitudeElement.textContent = `${data.altitude.toFixed(1)} m`;

    // Update charts
    const timeLabel = new Date().toLocaleTimeString();
    
    // Temperature chart
    temperatureChart.data.labels.push(timeLabel);
    temperatureChart.data.datasets[0].data.push(data.temperature);
    if (temperatureChart.data.labels.length > maxDataPoints) {
        temperatureChart.data.labels.shift();
        temperatureChart.data.datasets[0].data.shift();
    }
    temperatureChart.update();

    // Pressure chart
    pressureChart.data.labels.push(timeLabel);
    pressureChart.data.datasets[0].data.push(data.pressure);
    if (pressureChart.data.labels.length > maxDataPoints) {
        pressureChart.data.labels.shift();
        pressureChart.data.datasets[0].data.shift();
    }
    pressureChart.update();

    // Altitude chart
    altitudeChart.data.labels.push(timeLabel);
    altitudeChart.data.datasets[0].data.push(data.altitude);
    if (altitudeChart.data.labels.length > maxDataPoints) {
        altitudeChart.data.labels.shift();
        altitudeChart.data.datasets. data.shift();
    }
    altitudeChart.update();
}

// Handle connect button click
connectButton.addEventListener('click', connectToSerial);

// Handle disconnection
window.addEventListener('beforeunload', async () => {
    if (reader) {
        keepReading = false;
        reader.cancel();
        await reader.releaseLock();
        await port.close();
    }
});