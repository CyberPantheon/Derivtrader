// Deriv Trading Bot - Options Trading Module
// Version 1.0

// Configuration
const CONFIG = {
    RISK_PER_TRADE: 0.02, // 2% of balance
    MAX_MARTINGALE: 5, // Max consecutive losses before stopping
    SESSION_PROFIT_TARGET: 0.1, // 10% account growth target
    ANALYSIS_INTERVAL: 5000, // 5 seconds between analysis
    HISTORY_LENGTH: 1000 // Number of ticks to keep in memory
};

// Trading Strategies with weights and descriptions
const STRATEGIES = {
    EMA_CROSSOVER: {
        name: 'EMA Crossover',
        weight: 0.25,
        description: '9/21 EMA crossover strategy for trend identification',
        currentSignal: null,
        analysis: async (ticks) => {
            const shortEMA = calculateEMA(ticks, 9);
            const longEMA = calculateEMA(ticks, 21);
            return {
                signal: shortEMA > longEMA ? 'CALL' : 'PUT',
                confidence: Math.abs(shortEMA - longEMA) / ticks[ticks.length-1].close,
                reasoning: `EMA Crossover: ${shortEMA > longEMA ? 'Bullish' : 'Bearish'} crossover detected (9EMA: ${shortEMA.toFixed(4)}, 21EMA: ${longEMA.toFixed(4)})`
            };
        }
    },
    RSI_STRAT: {
        name: 'RSI Divergence',
        weight: 0.2,
        description: 'Relative Strength Index for overbought/oversold conditions',
        currentSignal: null,
        analysis: async (ticks) => {
            const rsi = calculateRSI(ticks, 14);
            let signal, reasoning;
            if (rsi < 30) {
                signal = 'CALL';
                reasoning = `RSI (${rsi.toFixed(1)}) indicates oversold conditions`;
            } else if (rsi > 70) {
                signal = 'PUT';
                reasoning = `RSI (${rsi.toFixed(1)}) indicates overbought conditions`;
            } else {
                signal = 'HOLD';
                reasoning = `RSI (${rsi.toFixed(1)}) in neutral range`;
            }
            return {
                signal,
                confidence: rsi < 30 ? (30 - rsi)/30 : rsi > 70 ? (rsi - 70)/30 : 0,
                reasoning
            };
        }
    },
    BOLLINGER_BANDS: {
        name: 'Bollinger Bands',
        weight: 0.2,
        description: 'Price action relative to volatility bands',
        currentSignal: null,
        analysis: async (ticks) => {
            const period = 20;
            const stdDev = 2;
            const closes = ticks.slice(-period).map(t => t.close);
            const middle = calculateSMA(closes, period);
            const std = calculateStandardDeviation(closes, middle);
            const upper = middle + (std * stdDev);
            const lower = middle - (std * stdDev);
            const lastClose = ticks[ticks.length-1].close;
            
            let signal, reasoning;
            if (lastClose <= lower) {
                signal = 'CALL';
                reasoning = `Price (${lastClose}) at lower Bollinger Band (${lower.toFixed(4)})`;
            } else if (lastClose >= upper) {
                signal = 'PUT';
                reasoning = `Price (${lastClose}) at upper Bollinger Band (${upper.toFixed(4)})`;
            } else {
                signal = 'HOLD';
                reasoning = `Price (${lastClose}) between bands (${lower.toFixed(4)}-${upper.toFixed(4)})`;
            }
            
            return {
                signal,
                confidence: lastClose <= lower ? (lower - lastClose)/lower : 
                           lastClose >= upper ? (lastClose - upper)/upper : 0,
                reasoning
            };
        }
    },
    MACD: {
        name: 'MACD',
        weight: 0.15,
        description: 'Moving Average Convergence Divergence momentum strategy',
        currentSignal: null,
        analysis: async (ticks) => {
            const ema12 = calculateEMA(ticks, 12);
            const ema26 = calculateEMA(ticks, 26);
            const macdLine = ema12 - ema26;
            const signalLine = calculateEMA(ticks.slice(-9), 9); // Using last 9 periods for signal
            
            return {
                signal: macdLine > signalLine ? 'CALL' : 'PUT',
                confidence: Math.abs(macdLine - signalLine) / ticks[ticks.length-1].close,
                reasoning: `MACD (${macdLine.toFixed(4)}) ${macdLine > signalLine ? 'above' : 'below'} Signal Line (${signalLine.toFixed(4)})`
            };
        }
    },
    FIBONACCI_RETRACE: {
        name: 'Fibonacci Retrace',
        weight: 0.1,
        description: 'Key Fibonacci levels for support/resistance',
        currentSignal: null,
        analysis: async (ticks) => {
            const lookback = 50;
            const recent = ticks.slice(-lookback);
            const high = Math.max(...recent.map(t => t.high));
            const low = Math.min(...recent.map(t => t.low));
            const range = high - low;
            const levels = {
                '0.236': high - range * 0.236,
                '0.382': high - range * 0.382,
                '0.5': high - range * 0.5,
                '0.618': high - range * 0.618
            };
            
            const lastPrice = ticks[ticks.length-1].close;
            let nearestLevel = null;
            let minDistance = Infinity;
            
            for (const [key, value] of Object.entries(levels)) {
                const distance = Math.abs(lastPrice - value);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestLevel = {key, value};
                }
            }
            
            const threshold = range * 0.02; // 2% of range as threshold
            let signal = 'HOLD';
            let reasoning = `Price (${lastPrice}) near Fib ${nearestLevel.key} level (${nearestLevel.value.toFixed(4)})`;
            
            if (minDistance < threshold) {
                const retraceLevel = parseFloat(nearestLevel.key);
                if (retraceLevel <= 0.382 && lastPrice < nearestLevel.value) {
                    signal = 'CALL';
                    reasoning += ' - Potential support bounce';
                } else if (retraceLevel >= 0.5 && lastPrice > nearestLevel.value) {
                    signal = 'PUT';
                    reasoning += ' - Potential resistance rejection';
                }
            }
            
            return {
                signal,
                confidence: signal !== 'HOLD' ? (threshold - minDistance)/threshold : 0,
                reasoning
            };
        }
    },
    VOLUME_PROFILE: {
        name: 'Volume Profile',
        weight: 0.1,
        description: 'Analyzing volume at price levels',
        currentSignal: null,
        analysis: async (ticks) => {
            // Simplified volume profile analysis
            const volumeBins = {};
            ticks.slice(-100).forEach(tick => {
                const priceLevel = Math.round(tick.close * 100) / 100;
                volumeBins[priceLevel] = (volumeBins[priceLevel] || 0) + 1;
            });
            
            const sortedLevels = Object.entries(volumeBins).sort((a, b) => b[1] - a[1]);
            const highVolumeLevel = parseFloat(sortedLevels[0][0]);
            const lastPrice = ticks[ticks.length-1].close;
            const distance = Math.abs(lastPrice - highVolumeLevel);
            const threshold = 0.001; // 0.1% threshold
            
            let signal = 'HOLD';
            let reasoning = `High volume at ${highVolumeLevel}, current price ${lastPrice}`;
            
            if (distance < threshold) {
                signal = lastPrice > highVolumeLevel ? 'PUT' : 'CALL';
                reasoning += ` - Price at key volume ${lastPrice > highVolumeLevel ? 'resistance' : 'support'} level`;
            }
            
            return {
                signal,
                confidence: signal !== 'HOLD' ? (threshold - distance)/threshold : 0,
                reasoning
            };
        }
    }
};

// Global variables
let derivWS = null;
let tickHistory = [];
let currentInstrument = 'R_100';
let accountBalance = 1000;
let tradingSession = {
    startTime: null,
    trades: [],
    pnl: 0,
    winRate: 0,
    consecutiveLosses: 0,
    status: 'active',
    profitTarget: 0
};

// Chart initialization
const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    width: 800,
    height: 400,
    layout: {
        background: { color: 'rgba(255, 255, 255, 0.05)' },
        textColor: 'white',
    },
    grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
    },
    timeScale: {
        timeVisible: true,
        secondsVisible: false,
    }
});

const candlestickSeries = chart.addCandlestickSeries({
    upColor: '#00b4d8',
    downColor: '#ff4d4d',
    borderVisible: false,
    wickUpColor: '#00b4d8',
    wickDownColor: '#ff4d4d',
});

// Add volume series
const volumeSeries = chart.addHistogramSeries({
    color: 'rgba(0, 180, 216, 0.3)',
    priceFormat: {
        type: 'volume',
    },
    priceScaleId: '' // set as an overlay by setting a blank priceScaleId
});

// Trading Engine Class
class TradingEngine {
    constructor() {
        this.activeStrategies = new Set(Object.keys(STRATEGIES));
        this.marketConditions = {
            volatility: 0,
            trendStrength: 0,
            marketPhase: 'neutral'
        };
    }

    async analyzeMarket(ticks) {
        if (ticks.length < 50) {
            return { signal: 'HOLD', confidence: 0, details: [] };
        }

        // Calculate market conditions first
        this.calculateMarketConditions(ticks);
        
        const analysisResults = [];
        const strategyPromises = [];
        
        // Run all strategies in parallel
        for (const [key, strategy] of Object.entries(STRATEGIES)) {
            if (!this.activeStrategies.has(key)) continue;
            
            strategyPromises.push(
                strategy.analysis(ticks)
                    .then(result => {
                        STRATEGIES[key].currentSignal = result.signal;
                        analysisResults.push({
                            strategy: key,
                            signal: result.signal,
                            confidence: result.confidence * strategy.weight,
                            reasoning: result.reasoning
                        });
                        updateAnalysisLog(`[${strategy.name}] ${result.reasoning}`);
                    })
                    .catch(error => {
                        console.error(`Strategy ${key} failed:`, error);
                        updateAnalysisLog(`[${strategy.name}] Analysis failed: ${error.message}`);
                    })
            );
        }

        await Promise.all(strategyPromises);
        return this.consolidateSignals(analysisResults);
    }

    calculateMarketConditions(ticks) {
        // Calculate volatility (standard deviation of last 50 closes)
        const recentCloses = ticks.slice(-50).map(t => t.close);
        const mean = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
        const variance = recentCloses.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentCloses.length;
        this.marketConditions.volatility = Math.sqrt(variance) / mean;
        
        // Calculate trend strength (slope of linear regression)
        const n = recentCloses.length;
        const xSum = n * (n - 1) / 2;
        const x2Sum = n * (n - 1) * (2 * n - 1) / 6;
        const ySum = recentCloses.reduce((a, b) => a + b, 0);
        const xySum = recentCloses.reduce((a, b, i) => a + b * i, 0);
        
        const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
        this.marketConditions.trendStrength = Math.abs(slope) / mean;
        this.marketConditions.marketPhase = slope > 0 ? 'bullish' : slope < 0 ? 'bearish' : 'neutral';
        
        updateAnalysisLog(`Market Conditions: Volatility ${(this.marketConditions.volatility*100).toFixed(2)}%, Trend ${this.marketConditions.marketPhase} (Strength: ${(this.marketConditions.trendStrength*100).toFixed(2)}%)`);
    }

    consolidateSignals(results) {
        const signalWeights = { CALL: 0, PUT: 0, HOLD: 0 };
        const signalReasons = {
            CALL: [],
            PUT: [],
            HOLD: []
        };
        
        results.forEach(({ signal, confidence, reasoning }) => {
            signalWeights[signal] += confidence;
            signalReasons[signal].push(reasoning);
        });

        const maxSignal = Object.entries(signalWeights).reduce((a, b) => 
            a[1] > b[1] ? a : b);
        
        // Adjust confidence based on market conditions
        let adjustedConfidence = maxSignal[1];
        if (maxSignal[0] !== 'HOLD') {
            // Increase confidence if signal aligns with trend
            if ((maxSignal[0] === 'CALL' && this.marketConditions.marketPhase === 'bullish') ||
                (maxSignal[0] === 'PUT' && this.marketConditions.marketPhase === 'bearish')) {
                adjustedConfidence = Math.min(1, adjustedConfidence * 1.2);
            }
            
            // Increase confidence in high volatility
            adjustedConfidence = Math.min(1, adjustedConfidence * (1 + this.marketConditions.volatility));
        }
        
        return {
            signal: maxSignal[0],
            confidence: adjustedConfidence,
            reasons: signalReasons[maxSignal[0]],
            details: results
        };
    }

    calculateDynamicStake(balance) {
        if (tradingSession.consecutiveLosses >= CONFIG.MAX_MARTINGALE) {
            updateAnalysisLog("Max martingale reached! Stopping trading session.");
            tradingSession.status = 'stopped';
            return 0;
        }
        
        const baseStake = balance * CONFIG.RISK_PER_TRADE;
        const martingaleFactor = Math.pow(2, tradingSession.consecutiveLosses);
        return Math.min(baseStake * martingaleFactor, balance * 0.5); // Never risk more than 50%
    }

    shouldContinueTrading() {
        if (tradingSession.status === 'stopped') return false;
        
        // Check profit target
        if (tradingSession.pnl >= tradingSession.profitTarget) {
            updateAnalysisLog(`Profit target reached! Current PNL: $${tradingSession.pnl.toFixed(2)}`);
            tradingSession.status = 'target_reached';
            return false;
        }
        
        // Check if market conditions are too volatile
        if (this.marketConditions.volatility > 0.05) { // 5% volatility
            updateAnalysisLog(`High volatility detected (${(this.marketConditions.volatility*100).toFixed(2)}%). Pausing trading.`);
            return false;
        }
        
        return true;
    }
}

// Technical Indicators
function calculateEMA(ticks, period) {
    const multiplier = 2 / (period + 1);
    let ema = ticks[0].close;
    for (let i = 1; i < ticks.length; i++) {
        ema = (ticks[i].close - ema) * multiplier + ema;
    }
    return ema;
}

function calculateRSI(ticks, period) {
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const delta = ticks[i].close - ticks[i-1].close;
        if (delta > 0) gains += delta;
        else losses -= delta;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateSMA(data, period) {
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateStandardDeviation(data, mean) {
    const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(variance);
}

// WebSocket Functions
function connectToDeriv() {
    derivWS = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=69958');
    
    derivWS.onopen = () => {
        console.log('Connected to Deriv');
        authenticate(getOAuthToken());
    };

    derivWS.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        handleWebSocketMessage(data);
    };

    derivWS.onclose = () => {
        console.log('Disconnected from Deriv');
        setTimeout(connectToDeriv, 5000); // Reconnect after 5 seconds
    };
}

function handleWebSocketMessage(data) {
    if (data.error) {
        console.error('WebSocket error:', data.error);
        updateAnalysisLog(`Error: ${data.error.message}`);
        return;
    }

    switch(data.msg_type) {
        case 'authorize':
            handleAuthorization(data);
            break;
        case 'tick_history':
            processTickHistory(data.history);
            break;
        case 'tick':
            processTickUpdate(data.tick);
            break;
        case 'buy':
            handleTradeResult(data);
            break;
        case 'balance':
            updateBalance(data.balance);
            break;
    }
}

function authenticate(token) {
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    derivWS.send(JSON.stringify({
        authorize: token
    }));
}

function handleAuthorization(data) {
    if (data.authorize) {
        accountBalance = data.authorize.balance;
        updateBalance(accountBalance);
        updateAnalysisLog('Successfully authenticated');
        
        // Initialize trading session
        tradingSession.startTime = Date.now();
        tradingSession.profitTarget = accountBalance * CONFIG.SESSION_PROFIT_TARGET;
        updateAnalysisLog(`Session started. Profit target: $${tradingSession.profitTarget.toFixed(2)}`);
        
        // Request initial tick history
        requestTickHistory();
    } else {
        updateAnalysisLog('Authentication failed');
    }
}

// Market Data Processing
function processTickHistory(history) {
    if (!history || !history.candles) return;
    
    tickHistory = history.candles.map(candle => ({
        epoch: candle.epoch,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close)
    }));
    
    updateChart(tickHistory);
    updateAnalysisLog(`Loaded ${tickHistory.length} historical ticks`);
    
    // Start initial analysis
    analyzeMarket();
}

function processTickUpdate(tick) {
    const newTick = {
        epoch: tick.epoch,
        open: parseFloat(tick.open),
        high: parseFloat(tick.high),
        low: parseFloat(tick.low),
        close: parseFloat(tick.close)
    };
    
    // Update tick history
    tickHistory.push(newTick);
    if (tickHistory.length > CONFIG.HISTORY_LENGTH) {
        tickHistory.shift();
    }
    
    // Update chart
    candlestickSeries.update(newTick);
    
    // Throttle analysis to prevent overloading
    if (!this.lastAnalysis || Date.now() - this.lastAnalysis > CONFIG.ANALYSIS_INTERVAL) {
        this.lastAnalysis = Date.now();
        analyzeMarket();
    }
}

function updateChart(data) {
    const formattedData = data.map(tick => ({
        time: tick.epoch,
        open: tick.open,
        high: tick.high,
        low: tick.low,
        close: tick.close
    }));
    
    candlestickSeries.setData(formattedData);
    
    // Update volume data (simplified)
    const volumeData = data.map((tick, i) => ({
        time: tick.epoch,
        value: i > 0 ? Math.abs(tick.close - data[i-1].close) * 10000 : 0,
        color: i > 0 ? (tick.close > data[i-1].close ? 'rgba(0, 180, 216, 0.5)' : 'rgba(255, 77, 77, 0.5)') : 'rgba(0, 180, 216, 0.5)'
    }));
    
    volumeSeries.setData(volumeData);
}

// Trading Functions
async function analyzeMarket() {
    const engine = new TradingEngine();
    if (!engine.shouldContinueTrading()) return;
    
    updateAnalysisLog("Starting market analysis...");
    
    try {
        const analysis = await engine.analyzeMarket(tickHistory);
        displayAnalysisResults(analysis);
        
        if (analysis.signal !== 'HOLD' && analysis.confidence > 0.65) {
            executeTrade(analysis);
        }
    } catch (error) {
        console.error('Analysis error:', error);
        updateAnalysisLog(`Analysis failed: ${error.message}`);
    }
}

function displayAnalysisResults(analysis) {
    document.getElementById('confidenceValue').textContent = `${(analysis.confidence * 100).toFixed(1)}%`;
    document.getElementById('confidenceFill').style.width = `${analysis.confidence * 100}%`;
    
    const signalElement = document.getElementById('currentSignal');
    signalElement.innerHTML = `
        <h4>${analysis.signal} (${(analysis.confidence * 100).toFixed(1)}% confidence)</h4>
        <ul>
            ${analysis.reasons.map(r => `<li>${r}</li>`).join('')}
        </ul>
    `;
}

function executeTrade(signal) {
    const engine = new TradingEngine();
    const stake = engine.calculateDynamicStake(accountBalance);
    
    if (stake <= 0) {
        updateAnalysisLog("Insufficient balance or trading paused");
        return;
    }
    
    const tradeParams = {
        proposal: 1,
        amount: stake.toFixed(2),
        basis: 'stake',
        contract_type: signal.signal,
        currency: 'USD',
        duration: 5,
        duration_unit: 't',
        symbol: currentInstrument,
        subscribe: 1
    };
    
    updateAnalysisLog(`Executing ${signal.signal} trade with stake: $${stake.toFixed(2)}`);
    derivWS.send(JSON.stringify({
        buy: tradeParams
    }));
}

function handleTradeResult(data) {
    if (data.buy) {
        const contractId = data.buy.contract_id;
        const stake = parseFloat(data.buy.buy_price);
        const contractType = data.buy.contract_type;
        
        updateAnalysisLog(`Trade opened: ${contractType} ($${stake.toFixed(2)}) - Contract ID: ${contractId}`);
        
        // Subscribe to updates for this contract
        derivWS.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: contractId,
            subscribe: 1
        }));
    } else if (data.proposal_open_contract) {
        const contract = data.proposal_open_contract;
        
        if (contract.is_expired) {
            const profit = parseFloat(contract.profit);
            const isWin = profit > 0;
            
            // Update trading session
            tradingSession.trades.push({
                contractId: contract.contract_id,
                type: contract.contract_type,
                stake: parseFloat(contract.buy_price),
                profit,
                isWin,
                timestamp: Date.now()
            });
            
            tradingSession.pnl += profit;
            tradingSession.winRate = tradingSession.trades.filter(t => t.isWin).length / tradingSession.trades.length;
            
            if (isWin) {
                tradingSession.consecutiveLosses = 0;
            } else {
                tradingSession.consecutiveLosses++;
            }
            
            updatePerformanceMetrics();
            updateAnalysisLog(`Trade closed: ${contract.contract_type} - ${isWin ? 'WIN' : 'LOSS'} ($${profit.toFixed(2)})`);
            
            // Check if we should continue trading
            const engine = new TradingEngine();
            if (!engine.shouldContinueTrading()) {
                showSessionSummary();
            }
        }
    }
}

// UI Functions
function updateAnalysisLog(message, data = null) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<small>[${new Date().toLocaleTimeString()}]</small> ${message}`;
    
    if (data) {
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(data, null, 2);
        logEntry.appendChild(pre);
    }
    
    const logContainer = document.getElementById('analysisLog');
    logContainer.prepend(logEntry);
    
    // Auto-scroll and limit log entries
    if (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

function updateBalance(balance) {
    accountBalance = balance;
    document.getElementById('balance').textContent = balance.toFixed(2);
}

function updatePerformanceMetrics() {
    document.getElementById('pnl').textContent = `$${tradingSession.pnl.toFixed(2)}`;
    document.getElementById('winRate').textContent = `${(tradingSession.winRate * 100).toFixed(1)}%`;
    document.getElementById('totalTrades').textContent = tradingSession.trades.length;
    
    const wins = tradingSession.trades.filter(t => t.isWin).length;
    const losses = tradingSession.trades.length - wins;
    const profitFactor = losses > 0 ? (wins / losses) : wins;
    document.getElementById('profitFactor').textContent = profitFactor.toFixed(2);
}

function showSessionSummary() {
    const duration = (Date.now() - tradingSession.startTime) / 1000 / 60; // in minutes
    const summary = `
        <h3>Trading Session Summary</h3>
        <p>Duration: ${duration.toFixed(1)} minutes</p>
        <p>Total Trades: ${tradingSession.trades.length}</p>
        <p>Win Rate: ${(tradingSession.winRate * 100).toFixed(1)}%</p>
        <p>PNL: $${tradingSession.pnl.toFixed(2)}</p>
        <p>Status: ${tradingSession.status === 'target_reached' ? 'Profit Target Reached' : 'Trading Stopped'}</p>
    `;
    
    const summaryElement = document.createElement('div');
    summaryElement.className = 'session-summary';
    summaryElement.innerHTML = summary;
    
    document.getElementById('analysisLog').prepend(summaryElement);
}

// Instrument Handling
function requestTickHistory() {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify({
            ticks_history: currentInstrument,
            adjust_start_time: 1,
            count: 1000,
            end: 'latest',
            granularity: 60, // 1 minute candles
            style: 'candles',
            subscribe: 1
        }));
    }
}

// Initialize
function getOAuthToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

document.addEventListener('DOMContentLoaded', () => {
    connectToDeriv();
    
    // Instrument selection
    document.getElementById('instrumentSelect').addEventListener('change', (e) => {
        currentInstrument = e.target.value;
        updateAnalysisLog(`Switched to instrument: ${currentInstrument}`);
        requestTickHistory();
    });
    
    // Timeframe buttons
    document.getElementById('timeframe1m').addEventListener('click', () => changeTimeframe(60));
    document.getElementById('timeframe5m').addEventListener('click', () => changeTimeframe(300));
    document.getElementById('timeframe15m').addEventListener('click', () => changeTimeframe(900));
    document.getElementById('timeframe1h').addEventListener('click', () => changeTimeframe(3600));
    
    // Signal actions
    document.getElementById('executeSignal').addEventListener('click', () => {
        const signalElement = document.getElementById('currentSignal');
        const signalMatch = signalElement.textContent.match(/(CALL|PUT)/);
        if (signalMatch) {
            executeTrade({ signal: signalMatch[0], confidence: 1 });
        }
    });
    
    document.getElementById('ignoreSignal').addEventListener('click', () => {
        updateAnalysisLog("Signal ignored by user");
    });
});

function changeTimeframe(seconds) {
    if (derivWS && derivWS.readyState === WebSocket.OPEN) {
        derivWS.send(JSON.stringify({
            ticks_history: currentInstrument,
            adjust_start_time: 1,
            count: 1000,
            end: 'latest',
            granularity: seconds,
            style: 'candles',
            subscribe: 1
        }));
        
        updateAnalysisLog(`Changed timeframe to ${seconds/60} minutes`);
    }
}
