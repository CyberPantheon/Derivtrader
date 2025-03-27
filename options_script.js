class TradingSystem {
    constructor(apiToken, accountId) {
        this.deriv = new Deriv({
            app_id: 1089,
            endpoint: 'frontend.binaryws.com'
        });
        this.apiToken = apiToken;
        this.accountId = accountId;
        this.currentSubscription = null;
        this.historicalData = [];
        this.indicators = {
            ema20: [],
            ema50: [],
            rsi: [],
            macd: { macd: [], signal: [] }
        };
    }

    async initialize() {
        try {
            await this.deriv.authorize(this.apiToken);
            await this.loadHistoricalData();
            this.initializeTradingView();
            this.setupEventListeners();
        } catch (error) {
            this.logError(`Initialization failed: ${error.message}`);
        }
    }

    async loadHistoricalData() {
        const response = await this.deriv.getTickHistory({
            ticks_history: document.getElementById('instrumentSelect').value,
            count: 1000,
            end: 'latest'
        });
        this.historicalData = response.history;
        this.calculateIndicators();
    }

    calculateIndicators() {
        // EMA Calculation
        this.indicators.ema20 = this.calculateEMA(20);
        this.indicators.ema50 = this.calculateEMA(50);
        
        // RSI Calculation
        this.indicators.rsi = this.calculateRSI(14);
        
        // MACD Calculation
        const macdResults = this.calculateMACD(12, 26, 9);
        this.indicators.macd.macd = macdResults.macd;
        this.indicators.macd.signal = macdResults.signal;
    }

    calculateEMA(period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        let sum = 0;
        
        for (let i = 0; i < this.historicalData.length; i++) {
            const price = parseFloat(this.historicalData[i].quote);
            if (i < period) {
                sum += price;
                ema.push(i === period - 1 ? sum / period : null);
            } else {
                ema.push((price - ema[i-1]) * multiplier + ema[i-1]);
            }
        }
        return ema;
    }

    calculateRSI(period) {
        const gains = [];
        const losses = [];
        const rsi = [];
        
        for (let i = 1; i < this.historicalData.length; i++) {
            const change = parseFloat(this.historicalData[i].quote) - 
                         parseFloat(this.historicalData[i-1].quote);
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        let avgGain = gains.slice(0, period).reduce((a,b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a,b) => a + b, 0) / period;

        for (let i = period; i < gains.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
            
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
        return rsi;
    }

    calculateMACD(shortPeriod, longPeriod, signalPeriod) {
        const shortEMA = this.calculateEMA(shortPeriod);
        const longEMA = this.calculateEMA(longPeriod);
        const macdLine = shortEMA.map((val, idx) => val - longEMA[idx]);
        const signalLine = this.calculateSignalLine(macdLine, signalPeriod);
        return { macd: macdLine, signal: signalLine };
    }

    calculateSignalLine(values, period) {
        return this.calculateEMA(period, values);
    }

    initializeTradingView() {
        new TradingView.widget({
            container_id: 'tradingview_chart',
            symbol: 'R_100',
            interval: '1',
            timezone: 'Etc/UTC',
            theme: 'light',
            style: '1',
            toolbar_bg: '#f1f3f6',
            enable_publishing: false,
            hide_side_toolbar: true,
            studies: [
                'MASimple@tv-basicstudies',
                'RSI@tv-basicstudies',
                'MACD@tv-basicstudies'
            ]
        });
    }

    setupEventListeners() {
        document.getElementById('instrumentSelect').addEventListener('change', async (e) => {
            await this.loadHistoricalData();
            this.initializeTradingView();
        });

        document.getElementById('executeTrade').addEventListener('click', () => {
            this.executeTrade();
        });

        // Initialize real-time subscription
        this.subscribeToRealTime();
    }

    async subscribeToRealTime() {
        const symbol = document.getElementById('instrumentSelect').value;
        this.currentSubscription = await this.deriv.subscribe({ ticks: symbol });
        
        this.currentSubscription.onUpdate((data) => {
            this.processTick(data.tick);
        });
    }

    processTick(tick) {
        this.historicalData.push(tick);
        if (this.historicalData.length > 1000) this.historicalData.shift();
        
        this.calculateIndicators();
        this.generateSignal();
        this.updateUI(tick);
    }

    generateSignal() {
        const currentPrice = parseFloat(this.historicalData.slice(-1)[0].quote);
        const signals = [];
        
        // EMA Cross Strategy
        if (this.indicators.ema20.slice(-1)[0] > this.indicators.ema50.slice(-1)[0]) {
            signals.push('EMA20 Cross Above EMA50');
        }

        // RSI Strategy
        const currentRSI = this.indicators.rsi.slice(-1)[0];
        if (currentRSI < 30) signals.push('RSI Oversold');
        if (currentRSI > 70) signals.push('RSI Overbought');

        // MACD Strategy
        const macd = this.indicators.macd.macd.slice(-1)[0];
        const signal = this.indicators.macd.signal.slice(-1)[0];
        if (macd > signal) signals.push('MACD Bullish Cross');

        // Generate final signal
        const signalStrength = (signals.length / 3) * 100;
        this.displaySignal(signals, signalStrength);
    }

    displaySignal(signals, strength) {
        const signalElement = document.getElementById('signalDetails');
        const strengthElement = document.getElementById('signalStrength');
        
        strengthElement.textContent = `${Math.round(strength)}% Confidence`;
        strengthElement.style.color = strength > 60 ? 'green' : strength > 40 ? 'orange' : 'red';
        
        signalElement.innerHTML = signals.map(s => 
            `<div class="alert alert-sm py-1 mb-1">✅ ${s}</div>`
        ).join('');
    }

    async executeTrade() {
        const tradeAmount = document.getElementById('tradeAmount').value;
        const stopLoss = document.getElementById('stopLoss').value;
        
        try {
            const response = await this.deriv.buy({
                amount: tradeAmount,
                basis: 'stake',
                contract_type: 'CALL',
                currency: 'USD',
                duration: 5,
                duration_unit: 'm',
                symbol: document.getElementById('instrumentSelect').value
            });
            
            this.logTrade(response);
        } catch (error) {
            this.logError(`Trade failed: ${error.message}`);
        }
    }

    logTrade(tradeData) {
        const logElement = document.getElementById('tradeLog');
        logElement.innerHTML += `
            <div class="alert alert-sm alert-success">
                Trade executed: ${tradeData.contract_id}<br>
                Amount: $${tradeData.amount} | Payout: $${tradeData.payout}
            </div>
        `;
    }

    logError(message) {
        const logElement = document.getElementById('tradeLog');
        logElement.innerHTML += `
            <div class="alert alert-sm alert-danger">
                ${new Date().toLocaleTimeString()}: ${message}
            </div>
        `;
    }

    updateUI(tick) {
        document.getElementById('accountInfo').innerHTML = `
            Account: ${this.accountId} | Balance: $${tick.balance} 
            | Last Tick: ${parseFloat(tick.quote).toFixed(2)}
        `;
    }
}

// Initialize system when page loads
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const apiToken = urlParams.get('token');
    const accountId = urlParams.get('account_id');
    
    const tradingSystem = new TradingSystem(apiToken, accountId);
    tradingSystem.initialize();
});
