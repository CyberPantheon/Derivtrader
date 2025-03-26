// options_script.js - Fixed Implementation
const APP_ID = 69958;
const API_ENDPOINT = 'wss://ws.binaryws.com/websockets/v3';
const MAX_TICKS = 10000;
const PREDICTION_WINDOW = 5; // minutes

// Global variables
let api;
let currentAccount = null;
let currentInstrument = null;
let currentChart = null;
let currentSeries = null;
let tickData = [];
let historicalData = [];
let activeSubscriptions = new Set();
let tradeHistory = [];
let strategyPerformance = {};
let lastSignalTime = 0;
let accounts = [];
let instruments = [];

// DOM Elements
const elements = {
    accountList: document.getElementById('accountList'),
    authenticateBtn: document.getElementById('authenticateBtn'),
    instrumentList: document.getElementById('instrumentList'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    accountBalance: document.getElementById('accountBalance'),
    strategyStatus: document.getElementById('strategyStatus'),
    analysisLog: document.getElementById('analysisLog'),
    winRate: document.getElementById('winRate'),
    pnl: document.getElementById('pnl'),
    totalTrades: document.getElementById('totalTrades'),
    profitFactor: document.getElementById('profitFactor'),
    currentSignal: document.getElementById('currentSignal'),
    confidenceFill: document.getElementById('confidenceFill'),
    confidenceValue: document.getElementById('confidenceValue'),
    executeSignal: document.getElementById('executeSignal'),
    ignoreSignal: document.getElementById('ignoreSignal'),
    timeframe1m: document.getElementById('timeframe1m'),
    timeframe5m: document.getElementById('timeframe5m'),
    timeframe15m: document.getElementById('timeframe15m'),
    timeframe1h: document.getElementById('timeframe1h')
};

// Initialize API Connection
function initializeAPI() {
    try {
        api = new WebSocket(API_ENDPOINT);
        
        api.onopen = function() {
            addToLog('Connected to Deriv API', 'success');
            checkForOAuthToken();
        };
        
        api.onerror = function(error) {
            console.error('WebSocket error:', error);
            addToLog('Connection error. Please refresh the page.', 'error');
        };
        
        api.onclose = function() {
            addToLog('Disconnected from Deriv API', 'warning');
        };
        
        api.onmessage = function(msg) {
            const response = JSON.parse(msg.data);
            handleAPIResponse(response);
        };
        
        setupEventListeners();
    } catch (error) {
        console.error('API initialization failed:', error);
        addToLog('Failed to initialize API connection', 'error');
    }
}

// Handle API responses
function handleAPIResponse(response) {
    if (response.error) {
        console.error('API error:', response.error);
        addToLog(response.error.message, 'error');
        return;
    }
    
    if (response.msg_type === 'authorize') {
        handleAuthorizationResponse(response);
    } else if (response.msg_type === 'account_list') {
        handleAccountListResponse(response);
    } else if (response.msg_type === 'active_symbols') {
        handleActiveSymbolsResponse(response);
    }
}

// Check for OAuth token in URL
function checkForOAuthToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        localStorage.setItem('deriv_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        handleAuthentication();
    }
}

// Setup event listeners
function setupEventListeners() {
    elements.authenticateBtn.addEventListener('click', handleAuthentication);
    elements.accountList.addEventListener('change', handleAccountSelection);
    elements.instrumentList.addEventListener('change', handleInstrumentSelection);
    elements.analyzeBtn.addEventListener('click', startAnalysis);
    elements.executeSignal.addEventListener('click', executeCurrentSignal);
    elements.ignoreSignal.addEventListener('click', ignoreCurrentSignal);
    
    // Timeframe buttons
    elements.timeframe1m.addEventListener('click', () => changeTimeframe('1m'));
    elements.timeframe5m.addEventListener('click', () => changeTimeframe('5m'));
    elements.timeframe15m.addEventListener('click', () => changeTimeframe('15m'));
    elements.timeframe1h.addEventListener('click', () => changeTimeframe('1h'));
}

// Handle authentication
async function handleAuthentication() {
    try {
        const token = localStorage.getItem('deriv_token');
        
        if (!token) {
            // Redirect to OAuth if no token
            window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=en`;
            return;
        }
        
        // Send authorization request
        api.send(JSON.stringify({
            authorize: token
        }));
        
        addToLog('Authenticating...', 'info');
        
    } catch (error) {
        console.error('Authentication failed:', error);
        addToLog('Authentication failed. Please try again.', 'error');
    }
}

// Handle authorization response
function handleAuthorizationResponse(response) {
    if (response.error) {
        addToLog('Authorization failed: ' + response.error.message, 'error');
        return;
    }
    
    addToLog('Successfully authenticated', 'success');
    elements.authenticateBtn.textContent = 'Authenticated';
    elements.authenticateBtn.style.backgroundColor = 'var(--success-color)';
    
    // Request account list
    api.send(JSON.stringify({
        account_list: 1
    }));
}

// Handle account list response
function handleAccountListResponse(response) {
    accounts = response.account_list;
    
    if (accounts.length > 0) {
        populateAccountDropdown();
        addToLog(`${accounts.length} accounts loaded`, 'success');
    } else {
        addToLog('No trading accounts found.', 'warning');
    }
}

// Populate account dropdown
function populateAccountDropdown() {
    elements.accountList.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select account...';
    elements.accountList.appendChild(defaultOption);
    
    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.loginid;
        option.textContent = `${account.account_type} (${account.currency})`;
        elements.accountList.appendChild(option);
    });
    
    elements.accountList.disabled = false;
}

// Handle account selection
function handleAccountSelection(event) {
    const accountId = event.target.value;
    currentAccount = accounts.find(acc => acc.loginid === accountId);
    
    if (currentAccount) {
        elements.accountBalance.textContent = `${currentAccount.balance} ${currentAccount.currency}`;
        fetchInstruments();
    } else {
        elements.instrumentList.disabled = true;
        elements.analyzeBtn.disabled = true;
    }
}

// Fetch available instruments
function fetchInstruments() {
    api.send(JSON.stringify({
        active_symbols: 'brief',
        product_type: 'basic'
    }));
    addToLog('Loading instruments...', 'info');
}

// Handle active symbols response
function handleActiveSymbolsResponse(response) {
    instruments = response.active_symbols.filter(sym => 
        sym.market === 'forex' || sym.market === 'synthetic'
    );
    
    populateInstrumentDropdown();
    addToLog(`${instruments.length} instruments loaded`, 'success');
}

// Populate instrument dropdown
function populateInstrumentDropdown() {
    elements.instrumentList.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select instrument...';
    elements.instrumentList.appendChild(defaultOption);
    
    instruments.forEach(instrument => {
        const option = document.createElement('option');
        option.value = instrument.symbol;
        option.textContent = instrument.display_name;
        elements.instrumentList.appendChild(option);
    });
    
    elements.instrumentList.disabled = false;
}

// Handle instrument selection
function handleInstrumentSelection(event) {
    currentInstrument = event.target.value;
    elements.analyzeBtn.disabled = !currentInstrument;
    
    if (currentInstrument) {
        initializeChart();
    }
}

// Initialize the chart
function initializeChart() {
    if (currentChart) {
        currentChart.remove();
    }
    
    const chartContainer = document.getElementById('mainChart');
    currentChart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight - 40,
        layout: {
            backgroundColor: 'transparent',
            textColor: 'rgba(255, 255, 255, 0.7)',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
    });
    
    currentSeries = currentChart.addCandlestickSeries({
        upColor: 'rgba(0, 200, 83, 0.7)',
        downColor: 'rgba(255, 61, 0, 0.7)',
        borderDownColor: 'rgba(255, 61, 0, 1)',
        borderUpColor: 'rgba(0, 200, 83, 1)',
        wickDownColor: 'rgba(255, 61, 0, 1)',
        wickUpColor: 'rgba(0, 200, 83, 1)',
    });
    
    fetchHistoricalData('1m');
}

// Fetch historical data
function fetchHistoricalData(timeframe) {
    if (!currentInstrument) return;
    
    api.send(JSON.stringify({
        ticks_history: currentInstrument,
        style: 'candles',
        granularity: timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600,
        count: 1000,
        end: 'latest'
    }));
    
    addToLog(`Loading ${timeframe} data for ${currentInstrument}...`, 'info');
}

// Add message to log
function addToLog(message, type = 'info') {
    const now = new Date();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    logEntry.innerHTML = `
        <div class="log-time">${now.toLocaleTimeString()}</div>
        <div class="log-message">${message}</div>
    `;
    
    elements.analysisLog.prepend(logEntry);
}

// Initialize the application
window.addEventListener('DOMContentLoaded', initializeAPI);
