// options_script.js - Complete Fixed Implementation
const APP_ID = 69958;
const API_ENDPOINT = 'frontend.binary.com';
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

// Initialize with default weights
const strategyWeights = {
    priceAction: 1.2,
    breakout: 1.1,
    trendFollowing: 1.0,
    meanReversion: 0.9,
    momentum: 1.0,
    supportResistance: 1.1,
    supplyDemand: 1.0,
    reversal: 1.3,
    scalping: 0.8,
    martingale: 0.7,
    neuralNetwork: 1.4,
    bigMoneyFlow: 1.2,
    deltaGamma: 1.1,
    patternRecognition: 1.3,
    fibonacci: 1.0,
    vwap: 1.1,
    multiTimeframe: 1.2,
    orderBook: 1.0,
    historicalSuccess: 1.3,
    selfLearning: 1.5
};

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
    api = new DerivAPIBrowser({ endpoint: API_ENDPOINT, appId: APP_ID });
    setupEventListeners();
    checkForOAuthToken();
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
        
        await api.authorize(token);
        await fetchAccounts();
        
    } catch (error) {
        console.error('Authentication failed:', error);
        addToLog('Authentication failed. Please try again.', 'error');
    }
}

// Fetch user accounts
async function fetchAccounts() {
    try {
        const response = await api.accountList();
        accounts = response.account_list;
        
        if (accounts.length > 0) {
            populateAccountDropdown();
            elements.authenticateBtn.textContent = 'Authenticated';
            elements.authenticateBtn.style.backgroundColor = 'var(--success-color)';
        } else {
            addToLog('No trading accounts found.', 'warning');
        }
    } catch (error) {
        console.error('Failed to fetch accounts:', error);
        addToLog('Failed to load accounts. Please try again.', 'error');
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
        option.value = account.account;
        option.textContent = `${account.account_type} (${account.currency})`;
        elements.accountList.appendChild(option);
    });
    
    elements.accountList.disabled = false;
}

// Handle account selection
async function handleAccountSelection(event) {
    const accountId = event.target.value;
    currentAccount = accounts.find(acc => acc.account === accountId);
    
    if (currentAccount) {
        elements.accountBalance.textContent = `${currentAccount.balance} ${currentAccount.currency}`;
        await fetchInstruments();
    } else {
        elements.instrumentList.disabled = true;
        elements.analyzeBtn.disabled = true;
    }
}

// Fetch available instruments
async function fetchInstruments() {
    try {
        const response = await api.activeSymbols({ active_symbols: 'brief' });
        instruments = response.active_symbols.filter(sym => sym.market === 'forex' || sym.market === 'synthetic');
        populateInstrumentDropdown();
    } catch (error) {
        console.error('Failed to fetch instruments:', error);
        addToLog('Failed to load instruments. Please try again.', 'error');
    }
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

// Change timeframe
function changeTimeframe(timeframe) {
    if (!currentInstrument) return;
    
    // Update active button
    document.querySelectorAll('.chart-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    fetchHistoricalData(timeframe);
}

// Fetch historical data
async function fetchHistoricalData(timeframe) {
    try {
        const response = await api.candles({
            symbol: currentInstrument,
            granularity: timeframe,
            count: 1000
        });
        
        historicalData = response.candles.map(candle => ({
            time: candle.epoch,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        }));
        
        currentSeries.setData(historicalData);
        subscribeToTicks();
        
    } catch (error) {
        console.error('Failed to fetch historical data:', error);
        addToLog(`Failed to load ${timeframe} data for ${currentInstrument}`, 'error');
    }
}

// Subscribe to real-time ticks
function subscribeToTicks() {
    // Unsubscribe from any existing subscriptions
    activeSubscriptions.forEach(sub => sub.unsubscribe());
    activeSubscriptions.clear();
    
    const tickSubscription = api.subscribe({ ticks: currentInstrument });
    
    tickSubscription.onUpdate(response => {
        const tick = response.tick;
        tickData.push(tick);
        
        if (tickData.length > MAX_TICKS) {
            tickData.shift();
        }
        
        updateChart(tick);
    });
    
    activeSubscriptions.add(tickSubscription);
}

// Update chart with new tick
function updateChart(tick) {
    const lastCandle = historicalData[historicalData.length - 1];
    const currentTime = Math.floor(tick.epoch / 60000) * 60000; // Round to nearest minute
    
    if (lastCandle.time === currentTime) {
        // Update current candle
        lastCandle.high = Math.max(lastCandle.high, tick.quote);
        lastCandle.low = Math.min(lastCandle.low, tick.quote);
        lastCandle.close = tick.quote;
    } else {
        // Create new candle
        const newCandle = {
            time: currentTime,
            open: tick.quote,
            high: tick.quote,
            low: tick.quote,
            close: tick.quote
        };
        historicalData.push(newCandle);
        
        if (historicalData.length > 1000) {
            historicalData.shift();
        }
    }
    
    currentSeries.update(historicalData[historicalData.length - 1]);
}

// Start analysis
function startAnalysis() {
    if (!currentInstrument || !currentAccount) return;
    
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.textContent = 'Analyzing...';
    
    // Clear previous results
    elements.strategyStatus.innerHTML = '';
    elements.currentSignal.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Analyzing...</p>';
    
    // Simulate analysis (in a real app, this would run actual strategies)
    setTimeout(() => {
        runStrategies();
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtn.textContent = 'Analyze';
    }, 2000);
}

// Run all strategies
function runStrategies() {
    const data = {
        historical: historicalData,
        realtime: tickData
    };
    
    let totalBullish = 0;
    let totalBearish = 0;
    let totalConfidence = 0;
    let strategyCount = 0;
    
    // Run price action strategy as an example
    const priceActionResult = priceActionStrategy(data);
    addStrategyResult('Price Action', priceActionResult);
    
    if (priceActionResult.direction === 'bullish') totalBullish++;
    if (priceActionResult.direction === 'bearish') totalBearish++;
    totalConfidence += priceActionResult.confidence;
    strategyCount++;
    
    // Determine final signal
    const finalDirection = totalBullish > totalBearish ? 'bullish' : totalBearish > totalBullish ? 'bearish' : 'neutral';
    const avgConfidence = Math.round(totalConfidence / strategyCount);
    
    displayFinalSignal(finalDirection, avgConfidence);
}

// Example strategy implementation
function priceActionStrategy(data) {
    if (data.historical.length < 3) {
        return { confidence: 0, direction: 'neutral', reason: 'Not enough data' };
    }
    
    const recentCandles = data.historical.slice(-3);
    const currentPrice = data.realtime.length > 0 ? data.realtime[data.realtime.length - 1].quote : recentCandles[2].close;
    
    // Check for bullish engulfing pattern
    if (recentCandles[1].close < recentCandles[1].open && // Previous candle was bearish
        recentCandles[2].close > recentCandles[2].open && // Current candle is bullish
        recentCandles[2].open < recentCandles[1].close && 
        recentCandles[2].close > recentCandles[1].open) {
        return { confidence: 75, direction: 'bullish', reason: 'Bullish engulfing pattern detected' };
    }
    
    // Check for bearish engulfing pattern
    if (recentCandles[1].close > recentCandles[1].open && // Previous candle was bullish
        recentCandles[2].close < recentCandles[2].open && // Current candle is bearish
        recentCandles[2].open > recentCandles[1].close && 
        recentCandles[2].close < recentCandles[1].open) {
        return { confidence: 75, direction: 'bearish', reason: 'Bearish engulfing pattern detected' };
    }
    
    // Default neutral signal
    return { confidence: 0, direction: 'neutral', reason: 'No clear price action pattern' };
}

// Add strategy result to UI
function addStrategyResult(strategyName, result) {
    const strategyElement = document.createElement('div');
    strategyElement.className = `strategy-status ${result.direction}`;
    
    strategyElement.innerHTML = `
        <div class="strategy-name">
            <span>${strategyName}</span>
            <span class="direction ${result.direction}">${result.direction}</span>
        </div>
        <div class="strategy-description">${result.reason}</div>
        <div class="confidence">Confidence: ${result.confidence}%</div>
        <div class="strategy-progress">
            <div class="progress-bar" style="width: ${result.confidence}%"></div>
        </div>
    `;
    
    elements.strategyStatus.appendChild(strategyElement);
}

// Display final signal
function displayFinalSignal(direction, confidence) {
    elements.confidenceFill.style.width = `${confidence}%`;
    elements.confidenceValue.textContent = `${confidence}%`;
    
    let signalHTML = '';
    if (direction === 'neutral') {
        signalHTML = '<p style="color: var(--text-secondary);">No clear market direction</p>';
    } else {
        signalHTML = `
            <h3 style="color: ${direction === 'bullish' ? 'var(--success-color)' : 'var(--error-color)'}">
                ${direction.toUpperCase()} SIGNAL
            </h3>
            <p>${confidence}% confidence</p>
        `;
    }
    
    elements.currentSignal.innerHTML = signalHTML;
    addToLog(`New ${direction} signal detected with ${confidence}% confidence`, 'info');
}

// Execute current signal
function executeCurrentSignal() {
    const signalElement = elements.currentSignal.querySelector('h3');
    if (!signalElement) return;
    
    const direction = signalElement.textContent.includes('BULLISH') ? 'BUY' : 'SELL';
    executeTrade(direction);
}

// Ignore current signal
function ignoreCurrentSignal() {
    addToLog('Current signal ignored', 'warning');
    elements.currentSignal.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Waiting for new analysis...</p>';
    elements.confidenceFill.style.width = '0%';
    elements.confidenceValue.textContent = '0%';
}

// Execute trade
async function executeTrade(direction) {
    const now = Date.now();
    if (now - lastSignalTime < 30000) { // 30-second cooldown
        addToLog('Trade execution too frequent. Please wait.', 'warning');
        return;
    }
    lastSignalTime = now;
    
    try {
        const amount = 10; // Fixed amount for demo
        const response = await api.buy({
            price: amount,
            amount: amount,
            basis: 'stake',
            contract_type: direction.toLowerCase(),
            currency: currentAccount.currency,
            duration: PREDICTION_WINDOW,
            duration_unit: 'm',
            symbol: currentInstrument
        });
        
        const trade = {
            id: response.buy.contract_id,
            direction,
            amount,
            timestamp: new Date(),
            instrument: currentInstrument,
            profit: response.buy.profit > 0
        };
        
        tradeHistory.push(trade);
        logTrade(trade);
        updatePerformanceMetrics();
        
    } catch (error) {
        console.error('Trade execution failed:', error);
        addToLog('Trade execution failed: ' + error.message, 'error');
    }
}

// Log trade to UI
function logTrade(trade) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${trade.direction.toLowerCase()} ${trade.profit ? 'profit' : 'loss'}`;
    
    logEntry.innerHTML = `
        <div class="log-time">${trade.timestamp.toLocaleTimeString()}</div>
        <div class="log-message">
            Executed ${trade.direction} trade for ${trade.amount} ${currentAccount.currency} on ${trade.instrument}
            - ${trade.profit ? 'WIN' : 'LOSS'}
        </div>
    `;
    
    elements.analysisLog.prepend(logEntry);
    addToLog(`Trade executed: ${trade.direction} ${trade.instrument}`, 'trade');
}

// Update performance metrics
function updatePerformanceMetrics() {
    if (tradeHistory.length === 0) return;
    
    const wins = tradeHistory.filter(t => t.profit).length;
    const losses = tradeHistory.length - wins;
    const winRate = Math.round((wins / tradeHistory.length) * 100);
    
    const totalProfit = tradeHistory.reduce((sum, trade) => sum + (trade.profit ? trade.amount : -trade.amount), 0);
    const profitFactor = wins > 0 ? (wins * 10) / (losses * 10) : 0;
    
    elements.winRate.textContent = `${winRate}%`;
    elements.pnl.textContent = `$${totalProfit.toFixed(2)}`;
    elements.totalTrades.textContent = tradeHistory.length;
    elements.profitFactor.textContent = profitFactor.toFixed(2);
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
