// Configuration
const APP_ID = 69958; // Test application ID
const API_ENDPOINT = 'frontend.binaryws.com';
const MAX_TICKS = 1000;
const PREDICTION_WINDOW = 5; // minutes

// Global variables
let api;
let currentAccount = null;
let currentInstrument = 'R_100';
let chart;
let candleSeries;
let tickData = [];
let historicalData = [];
let activeSubscriptions = new Set();
let tradeHistory = [];
let lastSignalTime = 0;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Extract token and account from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const accountId = urlParams.get('account_id');
    
    if (!token || !accountId) {
        showError('Missing authentication parameters');
        return;
    }

    try {
        // Initialize API
        api = new DerivAPIBrowser({ 
            endpoint: API_ENDPOINT, 
            appId: APP_ID 
        });
        
        // Authorize connection
        await api.authorize(token);
        
        // Get account info
        const accountResponse = await api.account();
        currentAccount = {
            id: accountResponse.account.account_list[0].account_id,
            currency: accountResponse.account.account_list[0].currency,
            balance: accountResponse.account.balance
        };
        
        updateAccountInfo();
        
        // Initialize chart
        initChart();
        
        // Load initial data
        await loadHistoricalData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Start real-time subscription
        subscribeToTicks();
        
    } catch (error) {
        showError(`Initialization failed: ${error.message}`);
    }
});

function updateAccountInfo() {
    document.getElementById('accountInfo').innerHTML = `
        Account: ${currentAccount.id} | 
        Balance: ${currentAccount.balance} ${currentAccount.currency}
    `;
}

function initChart() {
    const chartContainer = document.getElementById('tradingChart');
    chart = LightweightCharts.createChart(chartContainer, {
        layout: {
            backgroundColor: '#ffffff',
            textColor: '#333',
        },
        grid: {
            vertLines: { color: '#eee' },
            horzLines: { color: '#eee' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });
}

async function loadHistoricalData() {
    try {
        const response = await api.getTickHistory({
            ticks_history: currentInstrument,
            count: MAX_TICKS,
            end: 'latest',
            style: 'candles',
            granularity: 60 // 1-minute candles
        });
        
        historicalData = response.candles.map(candle => ({
            time: candle.epoch,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close)
        }));
        
        candleSeries.setData(historicalData);
        
    } catch (error) {
        showError(`Failed to load historical data: ${error.message}`);
    }
}

function setupEventListeners() {
    // Instrument selection
    document.getElementById('instrumentSelect').addEventListener('change', async (e) => {
        currentInstrument = e.target.value;
        await loadHistoricalData();
        
        // Resubscribe to ticks
        if (activeSubscriptions.size > 0) {
            unsubscribeFromTicks();
            subscribeToTicks();
        }
    });
    
    // Execute trade button
    document.getElementById('executeBtn').addEventListener('click', () => {
        const direction = document.getElementById('signalDirection').textContent;
        if (direction !== '--') {
            executeTrade(direction);
        }
    });
}

async function subscribeToTicks() {
    try {
        const subscription = await api.subscribe({ ticks: currentInstrument });
        activeSubscriptions.add(subscription);
        
        subscription.onUpdate(data => {
            if (data.tick) {
                processTick(data.tick);
            }
        });
        
    } catch (error) {
        showError(`Failed to subscribe to ticks: ${error.message}`);
    }
}

function unsubscribeFromTicks() {
    activeSubscriptions.forEach(sub => sub.unsubscribe());
    activeSubscriptions.clear();
}

function processTick(tick) {
    const newTick = {
        quote: parseFloat(tick.quote),
        epoch: tick.epoch,
        symbol: tick.symbol
    };
    
    // Add to tick data (limit size)
    tickData.push(newTick);
    if (tickData.length > MAX_TICKS) {
        tickData.shift();
    }
    
    // Update candle (simplified - in production you'd want proper candle formation)
    const currentTime = Math.floor(newTick.epoch / 60) * 60; // Minute precision
    const lastCandle = historicalData[historicalData.length - 1];
    
    if (lastCandle && currentTime === lastCandle.time) {
        // Update current candle
        lastCandle.high = Math.max(lastCandle.high, newTick.quote);
        lastCandle.low = Math.min(lastCandle.low, newTick.quote);
        lastCandle.close = newTick.quote;
    } else {
        // Create new candle
        const newCandle = {
            time: currentTime,
            open: newTick.quote,
            high: newTick.quote,
            low: newTick.quote,
            close: newTick.quote
        };
        historicalData.push(newCandle);
        if (historicalData.length > MAX_TICKS) {
            historicalData.shift();
        }
    }
    
    // Update chart
    candleSeries.update(historicalData[historicalData.length - 1]);
    
    // Generate signal (every minute for demo)
    const now = Date.now();
    if (now - lastSignalTime > 60000) { // 1 minute
        generateSignal();
        lastSignalTime = now;
    }
}

function generateSignal() {
    // Simplified signal generation (using 3 strategies and 3 indicators)
    const signal = {
        direction: '--',
        confidence: 0,
        strategyConfirmations: {},
        indicatorConfirmations: {}
    };
    
    // Strategy confirmations
    const emaCross = checkEMACross();
    if (emaCross.confidence > 0) {
        signal.strategyConfirmations.emaCross = emaCross;
    }
    
    const rsiSignal = checkRSI();
    if (rsiSignal.confidence > 0) {
        signal.strategyConfirmations.rsiSignal = rsiSignal;
    }
    
    const priceAction = checkPriceAction();
    if (priceAction.confidence > 0) {
        signal.strategyConfirmations.priceAction = priceAction;
    }
    
    // Indicator confirmations
    const macdSignal = checkMACD();
    if (macdSignal.confidence > 0) {
        signal.indicatorConfirmations.macd = macdSignal;
    }
    
    const bollingerSignal = checkBollinger();
    if (bollingerSignal.confidence > 0) {
        signal.indicatorConfirmations.bollinger = bollingerSignal;
    }
    
    const volumeSignal = checkVolume();
    if (volumeSignal.confidence > 0) {
        signal.indicatorConfirmations.volume = volumeSignal;
    }
    
    // Determine final signal
    const bullishConfirmations = Object.values(signal.strategyConfirmations)
        .concat(Object.values(signal.indicatorConfirmations))
        .filter(c => c.direction === 'bullish').length;
    
    const bearishConfirmations = Object.values(signal.strategyConfirmations)
        .concat(Object.values(signal.indicatorConfirmations))
        .filter(c => c.direction === 'bearish').length;
    
    const totalConfirmations = bullishConfirmations + bearishConfirmations;
    
    if (totalConfirmations > 0) {
        if (bullishConfirmations > bearishConfirmations) {
            signal.direction = 'BUY';
            signal.confidence = Math.min(100, (bullishConfirmations / totalConfirmations) * 100);
        } else {
            signal.direction = 'SELL';
            signal.confidence = Math.min(100, (bearishConfirmations / totalConfirmations) * 100);
        }
    }
    
    displaySignal(signal);
    
    // Enable execute button if we have a signal
    document.getElementById('executeBtn').disabled = signal.direction === '--';
}

// Strategy implementations
function checkEMACross() {
    if (historicalData.length < 50) return { confidence: 0, direction: 'neutral', reason: '' };
    
    // Calculate EMAs (simplified)
    const ema20 = calculateEMA(20);
    const ema50 = calculateEMA(50);
    
    const currentEma20 = ema20[ema20.length - 1];
    const currentEma50 = ema50[ema50.length - 1];
    const prevEma20 = ema20[ema20.length - 2];
    const prevEma50 = ema50[ema50.length - 2];
    
    if (currentEma20 > currentEma50 && prevEma20 <= prevEma50) {
        return { confidence: 75, direction: 'bullish', reason: 'EMA 20 crossed above EMA 50' };
    } else if (currentEma20 < currentEma50 && prevEma20 >= prevEma50) {
        return { confidence: 75, direction: 'bearish', reason: 'EMA 20 crossed below EMA 50' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

function checkRSI() {
    if (historicalData.length < 14) return { confidence: 0, direction: 'neutral', reason: '' };
    
    // Calculate RSI (simplified)
    const rsi = calculateRSI(14);
    const currentRSI = rsi[rsi.length - 1];
    
    if (currentRSI > 70) {
        return { confidence: 70, direction: 'bearish', reason: 'RSI overbought (>70)' };
    } else if (currentRSI < 30) {
        return { confidence: 70, direction: 'bullish', reason: 'RSI oversold (<30)' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

function checkPriceAction() {
    if (historicalData.length < 3) return { confidence: 0, direction: 'neutral', reason: '' };
    
    const lastCandle = historicalData[historicalData.length - 1];
    const prevCandle = historicalData[historicalData.length - 2];
    
    // Check for bullish engulfing
    if (prevCandle.close < prevCandle.open && 
        lastCandle.open < prevCandle.close && 
        lastCandle.close > prevCandle.open) {
        return { confidence: 65, direction: 'bullish', reason: 'Bullish engulfing pattern' };
    }
    
    // Check for bearish engulfing
    if (prevCandle.close > prevCandle.open && 
        lastCandle.open > prevCandle.close && 
        lastCandle.close < prevCandle.open) {
        return { confidence: 65, direction: 'bearish', reason: 'Bearish engulfing pattern' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

// Indicator implementations
function checkMACD() {
    if (historicalData.length < 26) return { confidence: 0, direction: 'neutral', reason: '' };
    
    // Simplified MACD calculation
    const ema12 = calculateEMA(12);
    const ema26 = calculateEMA(26);
    const macdLine = ema12.map((val, i) => val - ema26[i]);
    const signalLine = calculateEMA(9, macdLine);
    
    const currentMacd = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const prevMacd = macdLine[macdLine.length - 2];
    const prevSignal = signalLine[signalLine.length - 2];
    
    if (currentMacd > currentSignal && prevMacd <= prevSignal) {
        return { confidence: 70, direction: 'bullish', reason: 'MACD crossed above signal line' };
    } else if (currentMacd < currentSignal && prevMacd >= prevSignal) {
        return { confidence: 70, direction: 'bearish', reason: 'MACD crossed below signal line' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

function checkBollinger() {
    if (historicalData.length < 20) return { confidence: 0, direction: 'neutral', reason: '' };
    
    // Simplified Bollinger Bands
    const closes = historicalData.slice(-20).map(c => c.close);
    const mean = closes.reduce((sum, val) => sum + val, 0) / closes.length;
    const stdDev = Math.sqrt(closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closes.length);
    
    const upperBand = mean + (2 * stdDev);
    const lowerBand = mean - (2 * stdDev);
    const currentPrice = historicalData[historicalData.length - 1].close;
    
    if (currentPrice > upperBand) {
        return { confidence: 70, direction: 'bearish', reason: 'Price above upper Bollinger band' };
    } else if (currentPrice < lowerBand) {
        return { confidence: 70, direction: 'bullish', reason: 'Price below lower Bollinger band' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

function checkVolume() {
    if (tickData.length < 100) return { confidence: 0, direction: 'neutral', reason: '' };
    
    // Simplified volume analysis (using tick count as proxy)
    const recentTicks = tickData.slice(-100);
    const upTicks = recentTicks.filter(t => t.quote > tickData[tickData.length - 101].quote).length;
    const downTicks = recentTicks.filter(t => t.quote < tickData[tickData.length - 101].quote).length;
    
    if (upTicks > downTicks * 1.5) {
        return { confidence: 60, direction: 'bullish', reason: 'Strong buying pressure' };
    } else if (downTicks > upTicks * 1.5) {
        return { confidence: 60, direction: 'bearish', reason: 'Strong selling pressure' };
    }
    
    return { confidence: 0, direction: 'neutral', reason: '' };
}

// Helper calculations
function calculateEMA(period, sourceData = null) {
    const data = sourceData || historicalData.map(c => c.close);
    if (data.length < period) return Array(data.length).fill(0);
    
    const multiplier = 2 / (period + 1);
    const ema = [data.slice(0, period).reduce((sum, val) => sum + val, 0) / period];
    
    for (let i = period; i < data.length; i++) {
        ema.push((data[i] - ema[i - period]) * multiplier + ema[i - period]);
    }
    
    return ema;
}

function calculateRSI(period) {
    if (historicalData.length < period + 1) return Array(historicalData.length).fill(50);
    
    const changes = [];
    for (let i = 1; i < historicalData.length; i++) {
        changes.push(historicalData[i].close - historicalData[i - 1].close);
    }
    
    let avgGain = 0;
    let avgLoss = 0;
    
    // Initial average
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss -= changes[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    const rsi = Array(period).fill(50);
    
    // Subsequent values
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        let gain = 0;
        let loss = 0;
        
        if (change > 0) gain = change;
        else loss = -change;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
}

function displaySignal(signal) {
    document.getElementById('signalDirection').textContent = signal.direction;
    document.getElementById('signalDirection').className = signal.direction === 'BUY' ? 'positive' : 'negative';
    document.getElementById('signalStrength').textContent = `${signal.confidence.toFixed(1)}%`;
    
    updateConfirmationDisplay('strategyConfirmations', signal.strategyConfirmations);
    updateConfirmationDisplay('indicatorConfirmations', signal.indicatorConfirmations);
    
    // Add to log
    const now = new Date();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="time">${now.toLocaleTimeString()}</span>
        <span class="direction ${signal.direction.toLowerCase()}">${signal.direction}</span>
        <span class="confidence">${signal.confidence.toFixed(1)}%</span>
        <span class="instrument">${currentInstrument}</span>
    `;
    document.getElementById('tradeLogs').prepend(logEntry);
}

function updateConfirmationDisplay(elementId, confirmations) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    
    for (const [name, result] of Object.entries(confirmations)) {
        if (result.confidence > 0) {
            const div = document.createElement('div');
            div.className = `confirmation ${result.direction}`;
            div.innerHTML = `
                <span class="name">${name}</span>
                <span class="confidence">${result.confidence}%</span>
                <span class="reason">${result.reason}</span>
            `;
            container.appendChild(div);
        }
    }
}

async function executeTrade(direction) {
    const now = Date.now();
    if (now - lastSignalTime < 30000) { // 30-second cooldown
        showError('Please wait 30 seconds between trades');
        return;
    }
    lastSignalTime = now;
    
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    const maxTrades = parseInt(document.getElementById('maxTrades').value);
    
    if (tradeHistory.length >= maxTrades) {
        showError(`Maximum ${maxTrades} trades reached`);
        return;
    }
    
    try {
        const response = await api.buy({
            price: amount,
            amount: amount,
            basis: 'stake',
            contract_type: direction === 'BUY' ? 'CALL' : 'PUT',
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
        
    } catch (error) {
        showError(`Trade execution failed: ${error.message}`);
    }
}

function logTrade(trade) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry trade ${trade.direction.toLowerCase()} ${trade.profit ? 'profit' : 'loss'}`;
    logEntry.innerHTML = `
        <span class="time">${trade.timestamp.toLocaleTimeString()}</span>
        <span class="direction">${trade.direction}</span>
        <span class="amount">${trade.amount} ${currentAccount.currency}</span>
        <span class="instrument">${trade.instrument}</span>
        <span class="outcome">${trade.profit ? 'WIN' : 'LOSS'}</span>
    `;
    document.getElementById('tradeLogs').prepend(logEntry);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'log-entry error';
    errorDiv.textContent = message;
    document.getElementById('tradeLogs').prepend(errorDiv);
    console.error(message);
}
