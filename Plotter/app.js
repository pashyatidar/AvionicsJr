// data structures containing data for plotting
let allData = [];
let uplotData = { time: [], pressure: [], thrust: [], temp: [] };

// flag variables that control the operations
let index = 0;
let isPaused = false;
let isPlotting = false; // For CSV plotting
let startTime = 0;
let plotStartTime = 0;

// time unit for the x-axis
let timestampUnit = 'ms';

// data series used for csv
let availableSeries = []; // Tracks which data columns are present in the file

// data series for tracking max values
let maxValues = {
    pressure: { value: -Infinity, timestamp: null },
    thrust: { value: -Infinity, timestamp: null },
    temperature: { value: -Infinity, timestamp: null }
};

// flag variables for controlling the random plotting operations
let randomPlotting = false;
let randomPlotInterval = null;
let randomDataLog = [];

// uPlot chart instances
let uplotMain = null;
let uplotPressureThumb = null;
let uplotThrustThumb = null;
let uplotTempThumb = null;

// serial port variables
let port = null;
let reader = null;
let isSerialConnected = false;
let serialData = [];
let keepReading = true;
let serialBuffer = [];
let serialUpdateInterval = null;
let serialHeaderMap = null;

// --- UI Element References ---
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const menuToggle = document.getElementById('menuToggle');
const pageTitle = document.getElementById('pageTitle');
const navLinks = document.querySelectorAll('.nav-link');
const fileDropArea = document.getElementById('fileDropArea');
const csvFileInput = document.getElementById('csvFile');
const statsSidebar = document.getElementById('statsSidebar');

// Page-specific and Header Controls
const plotButton = document.getElementById('plotButton');
const startRandomPlottingButton = document.getElementById('startRandomPlotting');
const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const restartCsvButton = document.getElementById('restartCsvButton');
const restartRandomButton = document.getElementById('restartRandomButton');
const downloadCsvButton = document.getElementById('downloadCsvButton');
const connectSerialButton = document.getElementById('connectSerial');

// Serial Config UI
const serialConfigSelectors = [
    document.getElementById('serialCol1'),
    document.getElementById('serialCol2'),
    document.getElementById('serialCol3')
];


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    showPage('homePage'); // Start on the home page

    // Sidebar Toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        // Wait for the CSS transition to finish before resizing the chart
        setTimeout(() => {
            handleResize();
        }, 310); // 300ms transition + 10ms buffer
    });

    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => { // Make async to await the reset
            e.preventDefault();
            const pageId = link.dataset.page;
            await fullReset(); // Await the reset to prevent race conditions
            showPage(pageId);
            sidebar.classList.add('collapsed');
        });
    });

    // File Drop Area
    fileDropArea.addEventListener('click', () => csvFileInput.click());
    fileDropArea.addEventListener('dragover', (e) => { e.preventDefault(); fileDropArea.classList.add('dragover'); });
    fileDropArea.addEventListener('dragleave', () => fileDropArea.classList.remove('dragover'));
    fileDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            csvFileInput.files = files;
            handleFile({ target: csvFileInput });
        }
    });

    // Event Listeners for Controls
    csvFileInput.addEventListener('change', handleFile);
    plotButton.addEventListener('click', startCsvPlotting);
    startRandomPlottingButton.addEventListener('click', startRandomPlotting);
    connectSerialButton.addEventListener('click', connectToSerial);
    restartCsvButton.addEventListener('click', restartCsvPlotting);
    restartRandomButton.addEventListener('click', restartRandomPlotting);
    downloadCsvButton.addEventListener('click', downloadDataAsCSV);

    serialConfigSelectors.forEach(selector => {
        selector.addEventListener('change', updateSerialConfigUI);
    });

    pauseButton.addEventListener('click', () => {
        isPaused = true;
        pauseButton.disabled = true;
        resumeButton.disabled = false;
    });
    resumeButton.addEventListener('click', () => {
        isPaused = false;
        const lastPlottedTime = allData[index > 0 ? index - 1 : 0].timestamp;
        const elapsedTimeInData = lastPlottedTime - plotStartTime;
        startTime = performance.now() - elapsedTimeInData;
        requestAnimationFrame(plotCSVInterval);
        pauseButton.disabled = false;
        resumeButton.disabled = true;
    });

    // Add listeners for thumbnail charts to switch main view
    document.getElementById('pressureThumbnail').addEventListener('click', () => setActiveChart('pressure'));
    document.getElementById('thrustThumbnail').addEventListener('click', () => setActiveChart('thrust'));
    document.getElementById('temperatureThumbnail').addEventListener('click', () => setActiveChart('temperature'));

    // Add resize listener for fluid charts
    window.addEventListener('resize', handleResize);
    
    // Add fullscreen listener
    mainContent.addEventListener('dblclick', toggleFullScreen);
});

// --- Core UI and State Management ---

function toggleFullScreen() {
    const doc = document.documentElement;
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (doc.requestFullscreen) {
            doc.requestFullscreen();
        } else if (doc.msRequestFullscreen) {
            doc.msRequestFullscreen();
        } else if (doc.mozRequestFullScreen) {
            doc.mozRequestFullScreen();
        } else if (doc.webkitRequestFullscreen) {
            doc.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}


function handleResize() {
    if (!uplotMain) return;

    const mainChartWrapper = document.getElementById('uplot-main-wrapper');
    uplotMain.setSize({
        width: mainChartWrapper.clientWidth,
        height: mainChartWrapper.clientHeight
    });

    if (uplotPressureThumb) {
        const chartHolder = document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart');
        uplotPressureThumb.setSize({ width: chartHolder.clientWidth, height: chartHolder.clientHeight });
    }
    if (uplotThrustThumb) {
        const chartHolder = document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart');
        uplotThrustThumb.setSize({ width: chartHolder.clientWidth, height: chartHolder.clientHeight });
    }
    if (uplotTempThumb) {
        const chartHolder = document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart');
        uplotTempThumb.setSize({ width: chartHolder.clientWidth, height: chartHolder.clientHeight });
    }
}

function showPage(pageId, onPageShownCallback = null) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    if (pageId === 'plottingPage') {
        statsSidebar.style.display = 'flex';
    } else {
        statsSidebar.style.display = 'none';
    }
    
    navLinks.forEach(link => {
        if (link.dataset.page === pageId) {
            link.classList.add('active');
            pageTitle.textContent = link.textContent.trim();
        } else {
            link.classList.remove('active');
        }
    });

    if (onPageShownCallback) {
        requestAnimationFrame(onPageShownCallback);
    }
}

async function fullReset() {
    // Stop all ongoing processes
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    if (serialUpdateInterval) clearInterval(serialUpdateInterval);
    
    randomPlotting = false;
    isPlotting = false;
    isPaused = false;

    // Safely disconnect serial port if open
    if (port && port.readable) {
        keepReading = false;
        if (reader) {
            await reader.cancel().catch(() => {});
        }
    }
    
    // Reset all data structures
    allData = [];
    availableSeries = [];
    serialData = [];
    serialBuffer = [];
    serialHeaderMap = null;
    randomDataLog = [];
    
    // Destroy charts
    if (uplotMain) { uplotMain.destroy(); uplotMain = null; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }

    resetMaxValues();
    plotButton.disabled = true; // Always disable plot button on reset

    // Reset header controls
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    restartCsvButton.style.display = 'none';
    restartRandomButton.style.display = 'none';
    downloadCsvButton.style.display = 'none';
    
    // Reset Serial Config UI
    serialConfigSelectors.forEach(sel => sel.value = 'none');
    updateSerialConfigUI();
    
    document.getElementById('serialStatus').textContent = 'Status: Disconnected';
}

function resetMaxValues() {
    maxValues = {
        pressure: { value: -Infinity, timestamp: null },
        thrust: { value: -Infinity, timestamp: null },
        temperature: { value: -Infinity, timestamp: null }
    };
    document.getElementById('maxPressure').textContent = 'Max Pressure: -- hPa';
    document.getElementById('maxThrust').textContent = 'Max Thrust: -- N';
    document.getElementById('maxTemperature').textContent = 'Max Temp: -- °C';
}

// --- Plotting Logic ---
function startCsvPlotting() {
    if (!allData || allData.length === 0) {
        alert('Please load a valid CSV file first');
        return;
    }
    
    showPage('plottingPage', () => {
        let defaultView = document.getElementById('defaultViewSelect').value || availableSeries[0];
        createCharts(defaultView);
        handleResize();
        
        // Show the correct header controls for this mode
        restartRandomButton.style.display = 'none';
        downloadCsvButton.style.display = 'none';
        restartCsvButton.style.display = 'inline-block';
        pauseButton.style.display = 'inline-block';
        resumeButton.style.display = 'inline-block';

        restartCsvPlotting(); // Use the restart logic to begin plotting
    });
}

function restartCsvPlotting() {
    if (!allData || allData.length === 0) return;

    isPlotting = true;
    isPaused = false;
    index = 0;
    
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
    if (uplotMain) {
        updateAllPlots(); 
    }

    resetMaxValues();

    startTime = performance.now();
    plotStartTime = allData[0].timestamp;
    
    requestAnimationFrame(plotCSVInterval);

    pauseButton.disabled = false;
    resumeButton.disabled = true;
}

function startRandomPlotting() {
    availableSeries = ['pressure', 'thrust', 'temperature'];
    
    showPage('plottingPage', () => {
        createCharts('thrust');
        handleResize();
        
        // Show the correct header controls for this mode
        restartCsvButton.style.display = 'none';
        pauseButton.style.display = 'none';
        resumeButton.style.display = 'none';
        restartRandomButton.style.display = 'inline-block';
        downloadCsvButton.style.display = 'inline-block';
        
        restartRandomPlotting();
    });
}

function restartRandomPlotting() {
    if (randomPlotInterval) clearInterval(randomPlotInterval);
    
    randomPlotting = true;
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };
    randomDataLog = [];
    if (uplotMain) {
        updateAllPlots();
    }
    resetMaxValues();
    startTime = performance.now();

    randomPlotInterval = setInterval(() => {
        if (!randomPlotting) return;

        const elapsedTime = (performance.now() - startTime) / 1000;
        const p = 1013 + Math.sin(elapsedTime) * 10 + (Math.random() - 0.5) * 5;
        const th = 25 + Math.cos(elapsedTime * 0.5) * 20 + (Math.random() - 0.5) * 5;
        const temp = 40 + Math.sin(elapsedTime * 0.2) * 15 + (Math.random() - 0.5) * 3;
        
        const randomData = { 
            timestamp: parseFloat(elapsedTime.toFixed(3)), 
            pressure: parseFloat(p.toFixed(3)), 
            thrust: parseFloat(th.toFixed(3)), 
            temperature: parseFloat(temp.toFixed(3)) 
        };
        randomDataLog.push(randomData);

        updateMaxMinValues(randomData, elapsedTime);

        uplotData.time.push(elapsedTime);
        uplotData.pressure.push(p);
        uplotData.thrust.push(th);
        uplotData.temp.push(temp);

        const windowStartTime = elapsedTime - 5;
        while (uplotData.time.length > 0 && uplotData.time[0] < windowStartTime) {
            uplotData.time.shift();
            uplotData.pressure.shift();
            uplotData.thrust.shift();
            uplotData.temp.shift();
        }
        updateAllPlots();
    }, 100);
}

async function connectToSerial() {
    // Build the list of active series from the user's selection
    availableSeries = [];
    serialConfigSelectors.forEach(sel => {
        if (sel.value !== 'none') {
            availableSeries.push(sel.value);
        }
    });

    // Set a flag that we are ready to process serial data
    serialHeaderMap = true;

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        showPage('plottingPage', () => {
            restartCsvButton.style.display = 'none';
            restartRandomButton.style.display = 'none';
            pauseButton.style.display = 'none';
            resumeButton.style.display = 'none';
            downloadCsvButton.style.display = 'inline-block';

            isSerialConnected = true;
            resetMaxValues();
            createCharts(availableSeries[0] || 'pressure'); // Create charts based on selection
            handleResize();
            
            keepReading = true;
            readSerialData();
            if (serialUpdateInterval) clearInterval(serialUpdateInterval);
            serialUpdateInterval = setInterval(updateFromBuffer, 50);
        });

    } catch (error) { 
        console.error('Serial Connection Error:', error);
        alert('Failed to connect to serial device. Please ensure it is not in use and try again.');
        showPage('serialPage');
    }
}


// --- Chart and Data Handling ---
function setActiveChart(chartType) {
    if (!uplotMain) return;
    uplotMain.setSeries(1, { show: chartType === 'pressure' && availableSeries.includes('pressure') });
    uplotMain.setSeries(2, { show: chartType === 'thrust' && availableSeries.includes('thrust') });
    uplotMain.setSeries(3, { show: chartType === 'temperature' && availableSeries.includes('temperature') });

    document.getElementById('pressureThumbnail').classList.toggle('active', chartType === 'pressure');
    document.getElementById('thrustThumbnail').classList.toggle('active', chartType === 'thrust');
    document.getElementById('temperatureThumbnail').classList.toggle('active', chartType === 'temperature');
}

function createCharts(defaultChartOverride = '') {
    uplotData = { time: [], pressure: [], thrust: [], temp: [] };

    if (uplotMain) { uplotMain.destroy(); uplotMain = null; }
    if (uplotPressureThumb) { uplotPressureThumb.destroy(); uplotPressureThumb = null; }
    if (uplotThrustThumb) { uplotThrustThumb.destroy(); uplotThrustThumb = null; }
    if (uplotTempThumb) { uplotTempThumb.destroy(); uplotTempThumb = null; }


    const mainOpts = {
        legend: { show: true, live: false },
        scales: { x: { time: false }, y: { auto: true } },
        series: [
            {},
            { label: 'Pressure (hPa)', stroke: 'blue', width: 2, points: { show: false } },
            { label: 'Thrust (N)', stroke: 'red', width: 2, points: { show: false } },
            { label: 'Temperature (°C)', stroke: 'orange', width: 2, points: { show: false } },
        ],
        axes: [{ scale: 'x', label: 'Time (s)' }, { scale: 'y' }],
    };
    uplotMain = new uPlot(mainOpts, [uplotData.time, uplotData.pressure, uplotData.thrust, uplotData.temp], document.getElementById('uplot-main-wrapper'));

    const chartArea = document.getElementById('mainChartArea');
    const legend = chartArea.querySelector('.u-legend');
    if (legend) {
        chartArea.appendChild(legend);
    }

    document.getElementById('pressureThumbnail').style.display = availableSeries.includes('pressure') ? 'flex' : 'none';
    document.getElementById('thrustThumbnail').style.display = availableSeries.includes('thrust') ? 'flex' : 'none';
    document.getElementById('temperatureThumbnail').style.display = availableSeries.includes('temperature') ? 'flex' : 'none';

    const thumbOpts = {
        legend: { show: false },
        scales: { x: { time: false }, y: { auto: true } },
        axes: [ { show: false }, { show: false } ],
        cursor: { show: false },
    };

    if (availableSeries.includes('pressure')) {
        const pressureThumbContainer = document.getElementById('pressureThumbnail').querySelector('.thumbnail-chart');
        uplotPressureThumb = new uPlot({
            ...thumbOpts,
            series: [{}, { stroke: 'blue', width: 2 }],
        }, [uplotData.time, uplotData.pressure], pressureThumbContainer);
    }
    if (availableSeries.includes('thrust')) {
        const thrustThumbContainer = document.getElementById('thrustThumbnail').querySelector('.thumbnail-chart');
        uplotThrustThumb = new uPlot({
            ...thumbOpts,
            series: [{}, { stroke: 'red', width: 2 }],
        }, [uplotData.time, uplotData.thrust], thrustThumbContainer);
    }
    if (availableSeries.includes('temperature')) {
        const tempThumbContainer = document.getElementById('temperatureThumbnail').querySelector('.thumbnail-chart');
        uplotTempThumb = new uPlot({
            ...thumbOpts,
            series: [{}, { stroke: 'orange', width: 2 }],
        }, [uplotData.time, uplotData.temp], tempThumbContainer);
    }

    setActiveChart(defaultChartOverride);
}

function updateAllPlots() {
    if (!uplotMain) return;
    uplotMain.setData([uplotData.time, uplotData.pressure, uplotData.thrust, uplotData.temp]);
    if (uplotPressureThumb) uplotPressureThumb.setData([uplotData.time, uplotData.pressure]);
    if (uplotThrustThumb) uplotThrustThumb.setData([uplotData.time, uplotData.thrust]);
    if (uplotTempThumb) uplotTempThumb.setData([uplotData.time, uplotData.temp]);

    const dataLength = uplotData.time.length;
    if (dataLength < 2) return;

    const isSlidingWindow = randomPlotting || isSerialConnected;
    let windowStartTime = uplotData.time[0];
    const windowEndTime = uplotData.time[dataLength - 1];

    let newMax;
    if (isSlidingWindow) {
        windowStartTime = Math.max(0, windowEndTime - 5);
        newMax = windowEndTime;
    } else {
        const duration = windowEndTime - windowStartTime;
        const padding = duration > 0 ? duration * 0.1 : 1;
        newMax = windowEndTime + padding;
    }
    
    const newScale = { min: windowStartTime, max: newMax };
    uplotMain.setScale('x', newScale);
    if (uplotPressureThumb) uplotPressureThumb.setScale('x', newScale);
    if (uplotThrustThumb) uplotThrustThumb.setScale('x', newScale);
    if (uplotTempThumb) uplotTempThumb.setScale('x', newScale);
}

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const success = parseCSV(e.target.result);
        if (success) {
            plotButton.disabled = false;
            setupDefaultViewSelector(availableSeries);
        } else {
            alert('Error: CSV must contain a "timestamp" column and at least one data column (pressure, thrust, or temperature).');
        }
    };
    reader.readAsText(file);
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n').map(line => line.trim());
    if (lines.length < 2) return false;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    if (!headers.includes('timestamp')) return false;
    
    availableSeries = [];
    if (headers.includes('pressure')) availableSeries.push('pressure');
    if (headers.includes('thrust')) availableSeries.push('thrust');
    if (headers.includes('temperature')) availableSeries.push('temperature');
    
    if (availableSeries.length === 0) return false;

    const idx = {
        ts: headers.indexOf('timestamp'),
        p: headers.indexOf('pressure'),
        th: headers.indexOf('thrust'),
        t: headers.indexOf('temperature')
    };

    allData = lines.slice(1).map(line => {
        const cols = line.split(',');
        let time = parseFloat(cols[idx.ts]);
        if (isNaN(time)) return null;
        
        if (document.getElementById('timestampUnit').value === 's') time *= 1000;
        
        const point = { timestamp: time };
        if (idx.p > -1) point.pressure = parseFloat(cols[idx.p]);
        if (idx.th > -1) point.thrust = parseFloat(cols[idx.th]);
        if (idx.t > -1) point.temperature = parseFloat(cols[idx.t]);

        return point;
    }).filter(Boolean);

    allData.sort((a, b) => a.timestamp - b.timestamp);
    return allData.length > 0;
}

function plotCSVInterval() {
    if (!isPlotting || isPaused) return;

    if (index >= allData.length) {
        isPlotting = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        return;
    }

    const elapsedRealTime = performance.now() - startTime;
    const targetTimestamp = plotStartTime + elapsedRealTime;

    let pointsAdded = false;
    while (index < allData.length && allData[index].timestamp <= targetTimestamp) {
        const point = allData[index];
        const timeInSeconds = point.timestamp / 1000;
        uplotData.time.push(timeInSeconds);
        uplotData.pressure.push(point.pressure ?? null);
        uplotData.thrust.push(point.thrust ?? null);
        uplotData.temp.push(point.temperature ?? null);
        updateMaxMinValues(point, timeInSeconds);
        index++;
        pointsAdded = true;
    }

    if (pointsAdded) {
        updateAllPlots();
    }

    requestAnimationFrame(plotCSVInterval);
}

async function readSerialData() {
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();

    while (true) {
        try {
            const { value, done } = await reader.read();
            if (done || !keepReading) break;
            lineBuffer += value;
            let lines = lineBuffer.split('\n');
            lineBuffer = lines.pop();
            for (const line of lines) {
                if (line.trim()) serialBuffer.push(line.trim());
            }
        } catch (error) {
            console.error('Error reading from serial port:', error);
            break;
        }
    }
    
    reader.releaseLock();
    await readableStreamClosed.catch(() => {});
    await port.close().catch(() => {});

    port = null;
    isSerialConnected = false;
    if(serialUpdateInterval) clearInterval(serialUpdateInterval);
    serialUpdateInterval = null;
}

function updateFromBuffer() {
    if (serialBuffer.length === 0 || !serialHeaderMap) return;

    const pointsToProcess = serialBuffer.splice(0, serialBuffer.length);
    pointsToProcess.forEach(line => {
        const data = processSerialLine(line);
        if (data) {
            serialData.push(data);
            const timeInSeconds = data.timestamp / 1000;
            uplotData.time.push(timeInSeconds);
            uplotData.pressure.push(data.pressure ?? null);
            uplotData.thrust.push(data.thrust ?? null);
            uplotData.temp.push(data.temperature ?? null);
            updateMaxMinValues(data, timeInSeconds);
        }
    });
    updateAllPlots();
}

function processSerialLine(line) {
    if (!availableSeries.length) return null;
    
    const cols = line.split(',');
    let time = parseFloat(cols[0]);
    if (isNaN(time)) return null;

    const point = { timestamp: time };

    // Assign values based on the order defined in availableSeries
    // availableSeries[0] corresponds to cols[1], [1] to cols[2], etc.
    availableSeries.forEach((seriesName, index) => {
        const colIndex = index + 1;
        if (cols.length > colIndex) {
            point[seriesName] = parseFloat(cols[colIndex]);
        }
    });
    
    return point;
}

function updateSerialConfigUI() {
    const selectedValues = serialConfigSelectors.map(sel => sel.value);

    // Enable/Disable the connect button
    connectSerialButton.disabled = selectedValues[0] === 'none';

    // Disable selected options in other dropdowns
    serialConfigSelectors.forEach((currentSelector, currentIndex) => {
        // Iterate over all options in the current selector
        Array.from(currentSelector.options).forEach(option => {
            // Don't disable the 'none' option
            if (option.value === 'none') {
                option.disabled = false;
                return;
            }

            // Check if this option's value is selected in ANY OTHER dropdown
            const isSelectedElsewhere = selectedValues.some((selectedValue, selectedIndex) => {
                return selectedValue === option.value && selectedIndex !== currentIndex;
            });

            option.disabled = isSelectedElsewhere;
        });
    });
}


function setupDefaultViewSelector(series) {
    const defaultViewControl = document.getElementById('defaultViewControl');
    const defaultViewSelect = document.getElementById('defaultViewSelect');
    defaultViewSelect.innerHTML = '';

    if (series.length > 1) {
        series.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            defaultViewSelect.appendChild(option);
        });

        if (series.includes('thrust')) defaultViewSelect.value = 'thrust';
        else if (series.includes('pressure')) defaultViewSelect.value = 'pressure';
        
        defaultViewControl.style.display = 'inline-block';
    } else {
        defaultViewControl.style.display = 'none';
    }
}

function updateMaxMinValues(data, timeInSeconds) {
    if (data.pressure != null && data.pressure > maxValues.pressure.value) {
        maxValues.pressure.value = data.pressure;
        maxValues.pressure.timestamp = timeInSeconds;
        document.getElementById('maxPressure').textContent = `Max Pressure: ${data.pressure.toFixed(2)} hPa @ ${timeInSeconds.toFixed(1)}s`;
    }
    if (data.thrust != null && data.thrust > maxValues.thrust.value) {
        maxValues.thrust.value = data.thrust;
        maxValues.thrust.timestamp = timeInSeconds;
        document.getElementById('maxThrust').textContent = `Max Thrust: ${data.thrust.toFixed(2)} N @ ${timeInSeconds.toFixed(1)}s`;
    }
    if (data.temperature != null && data.temperature > maxValues.temperature.value) {
        maxValues.temperature.value = data.temperature;
        maxValues.temperature.timestamp = timeInSeconds;
        document.getElementById('maxTemperature').textContent = `Max Temp: ${data.temperature.toFixed(2)} °C @ ${timeInSeconds.toFixed(1)}s`;
    }
}

function downloadDataAsCSV() {
    let dataToDownload = [];
    let filename = "plot-data.csv";
    let wasSerial = serialData.length > 0;

    if (randomPlotting && randomDataLog.length > 0) {
        dataToDownload = randomDataLog;
        filename = "random-data.csv";
    } else if (wasSerial) {
        dataToDownload = serialData;
        filename = "serial-data.csv";
    } else {
        alert("No data available to download.");
        return;
    }

    if (dataToDownload.length === 0) {
        alert("No data has been generated yet.");
        return;
    }

    const headers = ['timestamp', ...availableSeries].filter((v, i, a) => a.indexOf(v) === i);

    let csvContent = headers.join(",") + "\n";
    dataToDownload.forEach(row => {
        const values = headers.map(header => row[header] ?? '');
        csvContent += values.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
