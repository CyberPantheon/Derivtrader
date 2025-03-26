// options_script.js - Complete Implementation
const DerivAPIBrowser = require('@deriv/deriv-api/dist/DerivAPIBrowser');
const { LightweightCharts } = require('lightweight-charts');
const talib = require('talib'); // For technical indicators

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

// Initialize with default weights (these can be adjusted based on performance)
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

const indicatorWeights = {
    rsi: 1.0,
    macd: 1.1,
    bollinger: 1.0,
    ema: 1.2,
    stochastic: 0.9,
    parabolicSAR: 1.0,
    atr: 0.8,
    ichimoku: 1.1,
    adx: 1.0,
    volume: 0.9
};

// Strategy Implementations
const strategies = {
    priceAction: (data) => {
        const recentCandles = data.historical.slice(-3);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        // Check for common candlestick patterns
        const isHammer = recentCandles[1].low < recentCandles[0].low && 
                        recentCandles[1].close > (recentCandles[1].high + recentCandles[1].low)/2;
        const isEngulfing = recentCandles[1].close > recentCandles[0].high && 
                           recentCandles[1].open < recentCandles[0].low;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (isHammer && currentPrice > recentCandles[1].close) {
            confidence = 65;
            direction = 'bullish';
            reason = 'Hammer pattern identified with confirmation';
        } else if (isEngulfing) {
            confidence = 70;
            direction = recentCandles[1].close > recentCandles[1].open ? 'bullish' : 'bearish';
            reason = 'Engulfing pattern identified';
        }
        
        return { confidence, direction, reason };
    },
    
    breakout: (data) => {
        // Identify recent support/resistance levels
        const recentData = data.historical.slice(-50);
        const resistance = Math.max(...recentData.map(d => d.high));
        const support = Math.min(...recentData.map(d => d.low));
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        const threshold = (resistance - support) * 0.05; // 5% of range
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentPrice > resistance + threshold) {
            confidence = 75;
            direction = 'bullish';
            reason = `Breakout above resistance (${resistance.toFixed(2)})`;
        } else if (currentPrice < support - threshold) {
            confidence = 75;
            direction = 'bearish';
            reason = `Breakdown below support (${support.toFixed(2)})`;
        }
        
        return { confidence, direction, reason };
    },
    
    trendFollowing: (data) => {
        const closes = data.historical.slice(-200).map(d => d.close);
        const ma50 = talib.MA(closes, 50);
        const ma200 = talib.MA(closes, 200);
        
        const currentMA50 = ma50[ma50.length - 1];
        const currentMA200 = ma200[ma200.length - 1];
        const prevMA50 = ma50[ma50.length - 2];
        const prevMA200 = ma200[ma200.length - 2];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentMA50 > currentMA200 && prevMA50 <= prevMA200) {
            confidence = 80;
            direction = 'bullish';
            reason = 'Golden Cross (50MA crossed above 200MA)';
        } else if (currentMA50 < currentMA200 && prevMA50 >= prevMA200) {
            confidence = 80;
            direction = 'bearish';
            reason = 'Death Cross (50MA crossed below 200MA)';
        } else if (currentMA50 > currentMA200) {
            confidence = 60;
            direction = 'bullish';
            reason = 'Uptrend confirmed by moving averages';
        } else if (currentMA50 < currentMA200) {
            confidence = 60;
            direction = 'bearish';
            reason = 'Downtrend confirmed by moving averages';
        }
        
        return { confidence, direction, reason };
    },
    
    meanReversion: (data) => {
        const closes = data.historical.slice(-100).map(d => d.close);
        const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
        const stdDev = Math.sqrt(closes.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / closes.length);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentPrice > mean + (2 * stdDev)) {
            confidence = 70;
            direction = 'bearish';
            reason = 'Price significantly above mean (+2σ)';
        } else if (currentPrice < mean - (2 * stdDev)) {
            confidence = 70;
            direction = 'bullish';
            reason = 'Price significantly below mean (-2σ)';
        } else if (currentPrice > mean + stdDev) {
            confidence = 55;
            direction = 'bearish';
            reason = 'Price above mean (+1σ)';
        } else if (currentPrice < mean - stdDev) {
            confidence = 55;
            direction = 'bullish';
            reason = 'Price below mean (-1σ)';
        }
        
        return { confidence, direction, reason };
    },
    
    momentum: (data) => {
        const closes = data.historical.slice(-14).map(d => d.close);
        const rsi = talib.RSI(closes, 14);
        const currentRSI = rsi[rsi.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentRSI < 30) {
            confidence = 65;
            direction = 'bullish';
            reason = 'Oversold condition (RSI < 30)';
        } else if (currentRSI > 70) {
            confidence = 65;
            direction = 'bearish';
            reason = 'Overbought condition (RSI > 70)';
        } else if (currentRSI > 50 && currentRSI > rsi[rsi.length - 2]) {
            confidence = 55;
            direction = 'bullish';
            reason = 'RSI rising above 50';
        } else if (currentRSI < 50 && currentRSI < rsi[rsi.length - 2]) {
            confidence = 55;
            direction = 'bearish';
            reason = 'RSI falling below 50';
        }
        
        return { confidence, direction, reason };
    },
    
    supportResistance: (data) => {
        // More sophisticated S/R detection
        const recentData = data.historical.slice(-100);
        const levels = findSupportResistanceLevels(recentData);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        const threshold = (Math.max(...recentData.map(d => d.high)) - 
                         Math.min(...recentData.map(d => d.low))) * 0.02;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        for (const level of levels) {
            if (Math.abs(currentPrice - level.price) < threshold) {
                if (level.type === 'support' && currentPrice > level.price) {
                    confidence = 75;
                    direction = 'bullish';
                    reason = `Bounce off support at ${level.price.toFixed(2)}`;
                    break;
                } else if (level.type === 'resistance' && currentPrice < level.price) {
                    confidence = 75;
                    direction = 'bearish';
                    reason = `Rejection at resistance ${level.price.toFixed(2)}`;
                    break;
                }
            }
        }
        
        return { confidence, direction, reason };
    },
    
    supplyDemand: (data) => {
        // Identify supply/demand zones based on price reactions
        const recentData = data.historical.slice(-200);
        const zones = identifySupplyDemandZones(recentData);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        for (const zone of zones) {
            if (currentPrice >= zone.start && currentPrice <= zone.end) {
                if (zone.type === 'demand') {
                    confidence = 70;
                    direction = 'bullish';
                    reason = `Price in demand zone (${zone.start.toFixed(2)}-${zone.end.toFixed(2)})`;
                } else {
                    confidence = 70;
                    direction = 'bearish';
                    reason = `Price in supply zone (${zone.start.toFixed(2)}-${zone.end.toFixed(2)})`;
                }
                break;
            }
        }
        
        return { confidence, direction, reason };
    },
    
    reversal: (data) => {
        const recentCandles = data.historical.slice(-5);
        const patterns = checkReversalPatterns(recentCandles);
        
        if (patterns.length > 0) {
            const strongestPattern = patterns.reduce((prev, current) => 
                (prev.confidence > current.confidence) ? prev : current
            );
            
            return {
                confidence: strongestPattern.confidence,
                direction: strongestPattern.direction,
                reason: strongestPattern.name
            };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    scalping: (data) => {
        // Focus on very short-term patterns (last 3-5 candles)
        const recentCandles = data.historical.slice(-5);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        // Check for inside bar breakout
        if (recentCandles.length >= 3) {
            const motherBar = recentCandles[recentCandles.length - 3];
            const insideBar = recentCandles[recentCandles.length - 2];
            
            if (insideBar.high < motherBar.high && insideBar.low > motherBar.low) {
                if (currentPrice > motherBar.high) {
                    return { confidence: 60, direction: 'bullish', reason: 'Inside bar breakout (bullish)' };
                } else if (currentPrice < motherBar.low) {
                    return { confidence: 60, direction: 'bearish', reason: 'Inside bar breakout (bearish)' };
                }
            }
        }
        
        // Check for micro double top/bottom
        if (recentCandles.length >= 5) {
            const top1 = recentCandles[recentCandles.length - 5].high;
            const top2 = recentCandles[recentCandles.length - 3].high;
            const bottom1 = recentCandles[recentCandles.length - 5].low;
            const bottom2 = recentCandles[recentCandles.length - 3].low;
            
            if (Math.abs(top1 - top2) / top1 < 0.005 && currentPrice < recentCandles[recentCandles.length - 2].low) {
                return { confidence: 65, direction: 'bearish', reason: 'Micro double top pattern' };
            }
            
            if (Math.abs(bottom1 - bottom2) / bottom1 < 0.005 && currentPrice > recentCandles[recentCandles.length - 2].high) {
                return { confidence: 65, direction: 'bullish', reason: 'Micro double bottom pattern' };
            }
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    martingale: (data) => {
        // Adjust strategy based on recent win/loss streak
        if (tradeHistory.length < 3) return { confidence: 0, direction: 'neutral', reason: '' };
        
        const lastTrades = tradeHistory.slice(-3);
        const losingStreak = lastTrades.filter(t => !t.profit).length;
        
        if (losingStreak >= 2) {
            const lastSignal = lastTrades[lastTrades.length - 1];
            return {
                confidence: 55,
                direction: lastSignal.direction === 'BUY' ? 'SELL' : 'BUY',
                reason: `Martingale adjustment after ${losingStreak} losses`
            };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    neuralNetwork: (data) => {
        // Simplified neural network approach (in a real app, this would use a trained model)
        const features = extractFeatures(data);
        
        // Mock prediction based on feature weights
        const bullishScore = features.reduce((sum, f) => sum + (f.bullishWeight * f.value), 0);
        const bearishScore = features.reduce((sum, f) => sum + (f.bearishWeight * f.value), 0);
        
        if (bullishScore > bearishScore + 0.2) {
            return { confidence: Math.min(80, bullishScore * 10), direction: 'bullish', reason: 'Neural net bullish bias' };
        } else if (bearishScore > bullishScore + 0.2) {
            return { confidence: Math.min(80, bearishScore * 10), direction: 'bearish', reason: 'Neural net bearish bias' };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    bigMoneyFlow: (data) => {
        // Analyze tick data for large transactions
        const largeTicks = data.realtime.filter(t => t.size > 100); // Assuming size indicates volume
        
        if (largeTicks.length === 0) return { confidence: 0, direction: 'neutral', reason: '' };
        
        const buyVolume = largeTicks.filter(t => t.tickDirection === 'PlusTick').reduce((sum, t) => sum + t.size, 0);
        const sellVolume = largeTicks.filter(t => t.tickDirection === 'MinusTick').reduce((sum, t) => sum + t.size, 0);
        
        const ratio = buyVolume / (buyVolume + sellVolume);
        
        if (ratio > 0.7) {
            return { confidence: 70, direction: 'bullish', reason: 'Large buy volume detected' };
        } else if (ratio < 0.3) {
            return { confidence: 70, direction: 'bearish', reason: 'Large sell volume detected' };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    deltaGamma: (data) => {
        // Simplified delta/gamma analysis (in a real app, this would use options data)
        const recentTicks = data.realtime.slice(-100);
        const upTicks = recentTicks.filter(t => t.tickDirection === 'PlusTick').length;
        const downTicks = recentTicks.filter(t => t.tickDirection === 'MinusTick').length;
        
        const delta = (upTicks - downTicks) / recentTicks.length;
        const gamma = Math.abs(delta - ((upTicks - downTicks) / recentTicks.length));
        
        if (delta > 0.2 && gamma < 0.1) {
            return { confidence: 65, direction: 'bullish', reason: 'Positive delta with low gamma' };
        } else if (delta < -0.2 && gamma < 0.1) {
            return { confidence: 65, direction: 'bearish', reason: 'Negative delta with low gamma' };
        } else if (gamma > 0.3) {
            return { confidence: 60, direction: delta > 0 ? 'bullish' : 'bearish', reason: 'High gamma suggests continuation' };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    patternRecognition: (data) => {
        const recentData = data.historical.slice(-50);
        const patterns = detectChartPatterns(recentData);
        
        if (patterns.length > 0) {
            const strongestPattern = patterns.reduce((prev, current) => 
                (prev.confidence > current.confidence) ? prev : current
            );
            
            return {
                confidence: strongestPattern.confidence,
                direction: strongestPattern.direction,
                reason: strongestPattern.name
            };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    fibonacci: (data) => {
        const recentData = data.historical.slice(-100);
        const swingHigh = Math.max(...recentData.map(d => d.high));
        const swingLow = Math.min(...recentData.map(d => d.low));
        const range = swingHigh - swingLow;
        
        const levels = {
            '0.236': swingHigh - range * 0.236,
            '0.382': swingHigh - range * 0.382,
            '0.5': swingHigh - range * 0.5,
            '0.618': swingHigh - range * 0.618,
            '0.786': swingHigh - range * 0.786
        };
        
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        const threshold = range * 0.02;
        
        for (const [level, price] of Object.entries(levels)) {
            if (Math.abs(currentPrice - price) < threshold) {
                // Check for bounce or break
                const prevPrice = data.realtime[data.realtime.length - 2].quote;
                
                if (currentPrice > price && prevPrice <= price) {
                    return { 
                        confidence: 70, 
                        direction: 'bullish', 
                        reason: `Bounce off Fibonacci ${level} level (${price.toFixed(2)})` 
                    };
                } else if (currentPrice < price && prevPrice >= price) {
                    return { 
                        confidence: 70, 
                        direction: 'bearish', 
                        reason: `Rejection at Fibonacci ${level} level (${price.toFixed(2)})` 
                    };
                }
            }
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    vwap: (data) => {
        const recentData = data.historical.slice(-100);
        const vwap = calculateVWAP(recentData);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        if (currentPrice > vwap && data.realtime[data.realtime.length - 2].quote <= vwap) {
            return { confidence: 65, direction: 'bullish', reason: 'Price crossed above VWAP' };
        } else if (currentPrice < vwap && data.realtime[data.realtime.length - 2].quote >= vwap) {
            return { confidence: 65, direction: 'bearish', reason: 'Price crossed below VWAP' };
        } else if (currentPrice > vwap) {
            return { confidence: 55, direction: 'bullish', reason: 'Price above VWAP' };
        } else if (currentPrice < vwap) {
            return { confidence: 55, direction: 'bearish', reason: 'Price below VWAP' };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    multiTimeframe: (data) => {
        // Analyze higher timeframe trends (simplified)
        const dailyData = data.historical.filter((_, i) => i % 1440 === 0); // Approximate daily
        const weeklyData = data.historical.filter((_, i) => i % (1440 * 5) === 0); // Approximate weekly
        
        if (dailyData.length < 20 || weeklyData.length < 10) {
            return { confidence: 0, direction: 'neutral', reason: '' };
        }
        
        const dailyTrend = talib.MA(dailyData.slice(-20).map(d => d.close), 20);
        const weeklyTrend = talib.MA(weeklyData.slice(-10).map(d => d.close), 10);
        
        const dailyDirection = dailyTrend[dailyTrend.length - 1] > dailyTrend[dailyTrend.length - 2] ? 'bullish' : 'bearish';
        const weeklyDirection = weeklyTrend[weeklyTrend.length - 1] > weeklyTrend[weeklyTrend.length - 2] ? 'bullish' : 'bearish';
        
        if (dailyDirection === weeklyDirection) {
            return { 
                confidence: 75, 
                direction: dailyDirection, 
                reason: `Multi-timeframe alignment (${dailyDirection} daily & weekly)` 
            };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    orderBook: (data) => {
        // Simulated order book analysis (real implementation would use actual order book data)
        const recentTicks = data.realtime.slice(-100);
        const bidVolume = recentTicks.filter(t => t.tickDirection === 'PlusTick').length;
        const askVolume = recentTicks.filter(t => t.tickDirection === 'MinusTick').length;
        
        if (bidVolume > askVolume * 1.5) {
            return { confidence: 60, direction: 'bullish', reason: 'Strong bid volume' };
        } else if (askVolume > bidVolume * 1.5) {
            return { confidence: 60, direction: 'bearish', reason: 'Strong ask volume' };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    historicalSuccess: (data) => {
        if (tradeHistory.length < 10) return { confidence: 0, direction: 'neutral', reason: '' };
        
        // Calculate success rate for each strategy
        const strategyStats = {};
        for (const trade of tradeHistory) {
            if (!strategyStats[trade.strategy]) {
                strategyStats[trade.strategy] = { wins: 0, total: 0 };
            }
            strategyStats[trade.strategy].total++;
            if (trade.profit) strategyStats[trade.strategy].wins++;
        }
        
        // Find the most successful strategy recently
        let bestStrategy = null;
        let bestWinRate = 0;
        
        for (const [strategy, stats] of Object.entries(strategyStats)) {
            const winRate = stats.wins / stats.total;
            if (winRate > bestWinRate) {
                bestWinRate = winRate;
                bestStrategy = strategy;
            }
        }
        
        if (bestStrategy && bestWinRate > 0.6) {
            // Get the last signal from this strategy
            const lastSignal = tradeHistory
                .filter(t => t.strategy === bestStrategy)
                .sort((a, b) => b.timestamp - a.timestamp)[0];
            
            if (lastSignal) {
                return {
                    confidence: Math.min(80, bestWinRate * 100),
                    direction: lastSignal.direction === 'BUY' ? 'bullish' : 'bearish',
                    reason: `Historical success (${(bestWinRate * 100).toFixed(0)}% win rate for ${bestStrategy})`
                };
            }
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    },
    
    selfLearning: (data) => {
        // Adaptive strategy that adjusts weights based on recent performance
        if (tradeHistory.length < 20) return { confidence: 0, direction: 'neutral', reason: '' };
        
        // Calculate recent performance for each strategy
        const recentTrades = tradeHistory.slice(-20);
        const strategyPerformance = {};
        
        for (const trade of recentTrades) {
            if (!strategyPerformance[trade.strategy]) {
                strategyPerformance[trade.strategy] = { wins: 0, total: 0 };
            }
            strategyPerformance[trade.strategy].total++;
            if (trade.profit) strategyPerformance[trade.strategy].wins++;
        }
        
        // Adjust weights based on performance
        for (const [strategy, stats] of Object.entries(strategyPerformance)) {
            const winRate = stats.wins / stats.total;
            strategyWeights[strategy] = Math.max(0.5, Math.min(1.5, winRate * 1.5));
        }
        
        // Get weighted signals from all strategies
        const weightedSignals = [];
        for (const [strategy, fn] of Object.entries(strategies)) {
            if (strategy === 'selfLearning') continue;
            
            const signal = fn(data);
            if (signal.confidence > 0) {
                weightedSignals.push({
                    ...signal,
                    weight: strategyWeights[strategy] || 1.0
                });
            }
        }
        
        if (weightedSignals.length === 0) {
            return { confidence: 0, direction: 'neutral', reason: '' };
        }
        
        // Calculate weighted average
        let bullishScore = 0;
        let bearishScore = 0;
        let totalWeight = 0;
        
        for (const signal of weightedSignals) {
            if (signal.direction === 'bullish') {
                bullishScore += signal.confidence * signal.weight;
            } else {
                bearishScore += signal.confidence * signal.weight;
            }
            totalWeight += signal.weight;
        }
        
        const normalizedBullish = bullishScore / totalWeight;
        const normalizedBearish = bearishScore / totalWeight;
        
        if (normalizedBullish > normalizedBearish + 10) {
            return { 
                confidence: Math.min(90, normalizedBullish), 
                direction: 'bullish', 
                reason: 'Self-learning model bullish bias' 
            };
        } else if (normalizedBearish > normalizedBullish + 10) {
            return { 
                confidence: Math.min(90, normalizedBearish), 
                direction: 'bearish', 
                reason: 'Self-learning model bearish bias' 
            };
        }
        
        return { confidence: 0, direction: 'neutral', reason: '' };
    }
};

// Technical Indicator Implementations
const indicators = {
    rsi: (data) => {
        const closes = data.historical.slice(-14).map(d => d.close);
        const rsiValues = talib.RSI(closes, 14);
        const currentRSI = rsiValues[rsiValues.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentRSI > 70) {
            confidence = 70;
            direction = 'bearish';
            reason = 'Overbought (RSI > 70)';
        } else if (currentRSI < 30) {
            confidence = 70;
            direction = 'bullish';
            reason = 'Oversold (RSI < 30)';
        } else if (currentRSI > 50 && rsiValues[rsiValues.length - 1] > rsiValues[rsiValues.length - 2]) {
            confidence = 55;
            direction = 'bullish';
            reason = 'RSI rising above 50';
        } else if (currentRSI < 50 && rsiValues[rsiValues.length - 1] < rsiValues[rsiValues.length - 2]) {
            confidence = 55;
            direction = 'bearish';
            reason = 'RSI falling below 50';
        }
        
        return { confidence, direction, reason };
    },
    
    macd: (data) => {
        const closes = data.historical.map(d => d.close);
        const macd = talib.MACD(closes, 12, 26, 9);
        
        const currentMACD = macd.MACD[macd.MACD.length - 1];
        const currentSignal = macd.signal[macd.signal.length - 1];
        const currentHist = macd.histogram[macd.histogram.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentMACD > currentSignal && macd.MACD[macd.MACD.length - 2] <= macd.signal[macd.signal.length - 2]) {
            confidence = 75;
            direction = 'bullish';
            reason = 'MACD crossover above signal line';
        } else if (currentMACD < currentSignal && macd.MACD[macd.MACD.length - 2] >= macd.signal[macd.signal.length - 2]) {
            confidence = 75;
            direction = 'bearish';
            reason = 'MACD crossover below signal line';
        } else if (currentHist > 0 && currentHist > macd.histogram[macd.histogram.length - 2]) {
            confidence = 60;
            direction = 'bullish';
            reason = 'MACD histogram increasing';
        } else if (currentHist < 0 && currentHist < macd.histogram[macd.histogram.length - 2]) {
            confidence = 60;
            direction = 'bearish';
            reason = 'MACD histogram decreasing';
        }
        
        return { confidence, direction, reason };
    },
    
    bollinger: (data) => {
        const closes = data.historical.slice(-20).map(d => d.close);
        const bb = talib.BBANDS(closes, 20, 2);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentPrice > bb.upper[bb.upper.length - 1]) {
            confidence = 70;
            direction = 'bearish';
            reason = 'Price above upper Bollinger band';
        } else if (currentPrice < bb.lower[bb.lower.length - 1]) {
            confidence = 70;
            direction = 'bullish';
            reason = 'Price below lower Bollinger band';
        } else if (currentPrice > bb.middle[bb.middle.length - 1] && 
                  data.realtime[data.realtime.length - 2].quote <= bb.middle[bb.middle.length - 1]) {
            confidence = 60;
            direction = 'bullish';
            reason = 'Price crossed above middle band';
        } else if (currentPrice < bb.middle[bb.middle.length - 1] && 
                  data.realtime[data.realtime.length - 2].quote >= bb.middle[bb.middle.length - 1]) {
            confidence = 60;
            direction = 'bearish';
            reason = 'Price crossed below middle band';
        }
        
        return { confidence, direction, reason };
    },
    
    ema: (data) => {
        const closes = data.historical.map(d => d.close);
        const ema20 = talib.EMA(closes, 20);
        const ema50 = talib.EMA(closes, 50);
        const ema200 = talib.EMA(closes, 200);
        
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        // Check EMA crossovers
        if (ema20[ema20.length - 1] > ema50[ema50.length - 1] && 
            ema20[ema20.length - 2] <= ema50[ema50.length - 2]) {
            confidence = 75;
            direction = 'bullish';
            reason = 'EMA 20 crossed above EMA 50';
        } else if (ema20[ema20.length - 1] < ema50[ema50.length - 1] && 
                  ema20[ema20.length - 2] >= ema50[ema50.length - 2]) {
            confidence = 75;
            direction = 'bearish';
            reason = 'EMA 20 crossed below EMA 50';
        }
        
        // Check price relative to EMAs
        if (currentPrice > ema20[ema20.length - 1] && 
            currentPrice > ema50[ema50.length - 1] && 
            currentPrice > ema200[ema200.length - 1]) {
            confidence = Math.max(confidence, 65);
            direction = 'bullish';
            reason = 'Price above all key EMAs (20, 50, 200)';
        } else if (currentPrice < ema20[ema20.length - 1] && 
                  currentPrice < ema50[ema50.length - 1] && 
                  currentPrice < ema200[ema200.length - 1]) {
            confidence = Math.max(confidence, 65);
            direction = 'bearish';
            reason = 'Price below all key EMAs (20, 50, 200)';
        }
        
        return { confidence, direction, reason };
    },
    
    stochastic: (data) => {
        const closes = data.historical.map(d => d.close);
        const highs = data.historical.map(d => d.high);
        const lows = data.historical.map(d => d.low);
        
        const stoch = talib.STOCH(highs, lows, closes, 14, 3, 3);
        const currentK = stoch.slowK[stoch.slowK.length - 1];
        const currentD = stoch.slowD[stoch.slowD.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentK > 80 && currentD > 80) {
            confidence = 70;
            direction = 'bearish';
            reason = 'Stochastic overbought (>80)';
        } else if (currentK < 20 && currentD < 20) {
            confidence = 70;
            direction = 'bullish';
            reason = 'Stochastic oversold (<20)';
        } else if (currentK > currentD && stoch.slowK[stoch.slowK.length - 2] <= stoch.slowD[stoch.slowD.length - 2]) {
            confidence = 65;
            direction = 'bullish';
            reason = 'Stochastic %K crossed above %D';
        } else if (currentK < currentD && stoch.slowK[stoch.slowK.length - 2] >= stoch.slowD[stoch.slowD.length - 2]) {
            confidence = 65;
            direction = 'bearish';
            reason = 'Stochastic %K crossed below %D';
        }
        
        return { confidence, direction, reason };
    },
    
    parabolicSAR: (data) => {
        const highs = data.historical.map(d => d.high);
        const lows = data.historical.map(d => d.low);
        const sar = talib.SAR(highs, lows, 0.02, 0.2);
        
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        const currentSAR = sar[sar.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentPrice > currentSAR && data.realtime[data.realtime.length - 2].quote <= sar[sar.length - 2]) {
            confidence = 75;
            direction = 'bullish';
            reason = 'Price crossed above Parabolic SAR';
        } else if (currentPrice < currentSAR && data.realtime[data.realtime.length - 2].quote >= sar[sar.length - 2]) {
            confidence = 75;
            direction = 'bearish';
            reason = 'Price crossed below Parabolic SAR';
        } else if (currentPrice > currentSAR) {
            confidence = 60;
            direction = 'bullish';
            reason = 'Price above Parabolic SAR';
        } else if (currentPrice < currentSAR) {
            confidence = 60;
            direction = 'bearish';
            reason = 'Price below Parabolic SAR';
        }
        
        return { confidence, direction, reason };
    },
    
    atr: (data) => {
        const highs = data.historical.map(d => d.high);
        const lows = data.historical.map(d => d.low);
        const closes = data.historical.map(d => d.close);
        
        const atr = talib.ATR(highs, lows, closes, 14);
        const currentATR = atr[atr.length - 1];
        const avgATR = atr.reduce((sum, val) => sum + val, 0) / atr.length;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentATR > avgATR * 1.5) {
            confidence = 70;
            direction = data.realtime[data.realtime.length - 1].quote > 
                       data.realtime[data.realtime.length - 2].quote ? 'bullish' : 'bearish';
            reason = 'High volatility (ATR > 1.5x average)';
        } else if (currentATR < avgATR * 0.5) {
            confidence = 60;
            direction = 'neutral';
            reason = 'Low volatility (ATR < 0.5x average)';
        }
        
        return { confidence, direction, reason };
    },
    
    ichimoku: (data) => {
        const highs = data.historical.map(d => d.high);
        const lows = data.historical.map(d => d.low);
        
        const ichimoku = talib.ICHIMOKU(highs, lows, 9, 26, 52);
        const currentPrice = data.realtime[data.realtime.length - 1].quote;
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        // Tenkan/Kijun crossover
        if (ichimoku.tenkan[ichimoku.tenkan.length - 1] > ichimoku.kijun[ichimoku.kijun.length - 1] && 
            ichimoku.tenkan[ichimoku.tenkan.length - 2] <= ichimoku.kijun[ichimoku.kijun.length - 2]) {
            confidence = 75;
            direction = 'bullish';
            reason = 'Tenkan-sen crossed above Kijun-sen';
        } else if (ichimoku.tenkan[ichimoku.tenkan.length - 1] < ichimoku.kijun[ichimoku.kijun.length - 1] && 
                  ichimoku.tenkan[ichimoku.tenkan.length - 2] >= ichimoku.kijun[ichimoku.kijun.length - 2]) {
            confidence = 75;
            direction = 'bearish';
            reason = 'Tenkan-sen crossed below Kijun-sen';
        }
        
        // Price relative to cloud
        const currentSpanA = ichimoku.senkouSpanA[ichimoku.senkouSpanA.length - 26];
        const currentSpanB = ichimoku.senkouSpanB[ichimoku.senkouSpanB.length - 26];
        
        if (currentPrice > currentSpanA && currentPrice > currentSpanB) {
            confidence = Math.max(confidence, 70);
            direction = 'bullish';
            reason = 'Price above Ichimoku cloud';
        } else if (currentPrice < currentSpanA && currentPrice < currentSpanB) {
            confidence = Math.max(confidence, 70);
            direction = 'bearish';
            reason = 'Price below Ichimoku cloud';
        } else if (currentSpanA > currentSpanB && currentPrice > currentSpanA) {
            confidence = Math.max(confidence, 65);
            direction = 'bullish';
            reason = 'Price in bullish Ichimoku cloud';
        } else if (currentSpanA < currentSpanB && currentPrice < currentSpanB) {
            confidence = Math.max(confidence, 65);
            direction = 'bearish';
            reason = 'Price in bearish Ichimoku cloud';
        }
        
        return { confidence, direction, reason };
    },
    
    adx: (data) => {
        const highs = data.historical.map(d => d.high);
        const lows = data.historical.map(d => d.low);
        const closes = data.historical.map(d => d.close);
        
        const adx = talib.ADX(highs, lows, closes, 14);
        const currentADX = adx[adx.length - 1];
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (currentADX > 25) {
            const plusDI = talib.PLUS_DI(highs, lows, closes, 14);
            const minusDI = talib.MINUS_DI(highs, lows, closes, 14);
            
            if (plusDI[plusDI.length - 1] > minusDI[minusDI.length - 1]) {
                confidence = 70;
                direction = 'bullish';
                reason = 'Strong trend (ADX > 25) with +DI > -DI';
            } else {
                confidence = 70;
                direction = 'bearish';
                reason = 'Strong trend (ADX > 25) with -DI > +DI';
            }
        } else if (currentADX < 20) {
            confidence = 60;
            direction = 'neutral';
            reason = 'Weak trend (ADX < 20)';
        }
        
        return { confidence, direction, reason };
    },
    
    volume: (data) => {
        const recentTicks = data.realtime.slice(-100);
        const buyVolume = recentTicks.filter(t => t.tickDirection === 'PlusTick').length;
        const sellVolume = recentTicks.filter(t => t.tickDirection === 'MinusTick').length;
        const volumeRatio = buyVolume / (buyVolume + sellVolume);
        
        let confidence = 0;
        let direction = 'neutral';
        let reason = '';
        
        if (volumeRatio > 0.7) {
            confidence = 65;
            direction = 'bullish';
            reason = 'Strong buying volume (70%+)';
        } else if (volumeRatio < 0.3) {
            confidence = 65;
            direction = 'bearish';
            reason = 'Strong selling volume (70%+)';
        } else if (volumeRatio > 0.6 && 
                  recentTicks[recentTicks.length - 1].quote > recentTicks[recentTicks.length - 2].quote) {
            confidence = 60;
            direction = 'bullish';
            reason = 'Increasing price with buying volume';
        } else if (volumeRatio < 0.4 && 
                  recentTicks[recentTicks.length - 1].quote < recentTicks[recentTicks.length - 2].quote) {
            confidence = 60;
            direction = 'bearish';
            reason = 'Decreasing price with selling volume';
        }
        
        return { confidence, direction, reason };
    }
};

// Helper Functions
function findSupportResistanceLevels(data) {
    // Implementation of support/resistance detection
    // This is a simplified version - in production you'd want a more sophisticated algorithm
    const levels = [];
    const sensitivity = 0.005; // 0.5%
    
    // Find potential levels by looking for areas where price reversed multiple times
    for (let i = 2; i < data.length - 2; i++) {
        // Check for resistance
        if (data[i].high > data[i-1].high && data[i].high > data[i+1].high &&
            Math.abs(data[i].high - data[i-2].high) < data[i].high * sensitivity &&
            Math.abs(data[i].high - data[i+2].high) < data[i].high * sensitivity) {
            levels.push({ price: data[i].high, type: 'resistance' });
        }
        
        // Check for support
        if (data[i].low < data[i-1].low && data[i].low < data[i+1].low &&
            Math.abs(data[i].low - data[i-2].low) < data[i].low * sensitivity &&
            Math.abs(data[i].low - data[i+2].low) < data[i].low * sensitivity) {
            levels.push({ price: data[i].low, type: 'support' });
        }
    }
    
    // Merge nearby levels
    const mergedLevels = [];
    levels.sort((a, b) => a.price - b.price);
    
    for (const level of levels) {
        const nearbyLevel = mergedLevels.find(l => Math.abs(l.price - level.price) < level.price * sensitivity);
        if (nearbyLevel) {
            nearbyLevel.strength++;
        } else {
            mergedLevels.push({ ...level, strength: 1 });
        }
    }
    
    // Filter for significant levels (touched at least twice)
    return mergedLevels.filter(l => l.strength >= 2);
}

function identifySupplyDemandZones(data) {
    // Simplified supply/demand zone detection
    const zones = [];
    
    // Look for strong moves followed by consolidation
    for (let i = 20; i < data.length - 10; i++) {
        const moveUp = data[i].close > data[i-5].close * 1.03; // 3% move up
        const moveDown = data[i].close < data[i-5].close * 0.97; // 3% move down
        
        if (moveUp || moveDown) {
            // Look for consolidation after the move
            let consolidation = true;
            for (let j = i; j < i + 10 && j < data.length; j++) {
                if (Math.abs(data[j].close - data[i].close) > data[i].close * 0.01) {
                    consolidation = false;
                    break;
                }
            }
            
            if (consolidation) {
                const range = {
                    start: Math.min(...data.slice(i, i+10).map(d => d.low)),
                    end: Math.max(...data.slice(i, i+10).map(d => d.high)),
                    type: moveUp ? 'demand' : 'supply'
                };
                
                // Check if this zone overlaps with an existing one
                const existingZone = zones.find(z => 
                    (range.start >= z.start && range.start <= z.end) ||
                    (range.end >= z.start && range.end <= z.end)
                );
                
                if (!existingZone) {
                    zones.push(range);
                }
            }
        }
    }
    
    return zones;
}

function detectChartPatterns(data) {
    // Simplified pattern detection (in production, use a more robust algorithm)
    const patterns = [];
    
    // Head and Shoulders
    if (data.length >= 5) {
        const leftShoulder = data[data.length - 5].high;
        const head = data[data.length - 3].high;
        const rightShoulder = data[data.length - 1].high;
        const neckline = Math.min(data[data.length - 4].low, data[data.length - 2].low);
        
        if (head > leftShoulder && head > rightShoulder &&
            Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.01 && // Shoulders roughly equal
            data[data.length - 1].close < neckline) {
            patterns.push({
                name: 'Head and Shoulders',
                confidence: 75,
                direction: 'bearish'
            });
        }
    }
    
    // Inverse Head and Shoulders
    if (data.length >= 5) {
        const leftShoulder = data[data.length - 5].low;
        const head = data[data.length - 3].low;
        const rightShoulder = data[data.length - 1].low;
        const neckline = Math.max(data[data.length - 4].high, data[data.length - 2].high);
        
        if (head < leftShoulder && head < rightShoulder &&
            Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.01 && // Shoulders roughly equal
            data[data.length - 1].close > neckline) {
            patterns.push({
                name: 'Inverse Head and Shoulders',
                confidence: 75,
                direction: 'bullish'
            });
        }
    }
    
    // Double Top
    if (data.length >= 3) {
        const firstTop = data[data.length - 3].high;
        const secondTop = data[data.length - 1].high;
        const trough = data[data.length - 2].low;
        
        if (Math.abs(firstTop - secondTop) / firstTop < 0.01 && // Tops roughly equal
            data[data.length - 1].close < trough) {
            patterns.push({
                name: 'Double Top',
                confidence: 70,
                direction: 'bearish'
            });
        }
    }
    
    // Double Bottom
    if (data.length >= 3) {
        const firstBottom = data[data.length - 3].low;
        const secondBottom = data[data.length - 1].low;
        const peak = data[data.length - 2].high;
        
        if (Math.abs(firstBottom - secondBottom) / firstBottom < 0.01 && // Bottoms roughly equal
            data[data.length - 1].close > peak) {
            patterns.push({
                name: 'Double Bottom',
                confidence: 70,
                direction: 'bullish'
            });
        }
    }
    
    // Triangles
    if (data.length >= 10) {
        const highs = data.slice(-10).map(d => d.high);
        const lows = data.slice(-10).map(d => d.low);
        
        const maxHigh = Math.max(...highs);
        const minHigh = Math.min(...highs);
        const maxLow = Math.max(...lows);
        const minLow = Math.min(...lows);
        
        // Ascending Triangle
        if ((maxHigh - minHigh) / maxHigh < 0.01 && // Flat top
            (maxLow - minLow) / maxLow > 0.03) { // Rising bottom
            patterns.push({
                name: 'Ascending Triangle',
                confidence: 65,
                direction: 'bullish'
            });
        }
        
        // Descending Triangle
        if ((maxLow - minLow) / maxLow < 0.01 && // Flat bottom
            (maxHigh - minHigh) / maxHigh > 0.03) { // Falling top
            patterns.push({
                name: 'Descending Triangle',
                confidence: 65,
                direction: 'bearish'
            });
        }
        
        // Symmetrical Triangle
        if ((maxHigh - minHigh) / maxHigh > 0.02 && 
            (maxLow - minLow) / maxLow > 0.02 &&
            (maxHigh - minHigh) / (maxLow - minLow) > 0.8 &&
            (maxHigh - minHigh) / (maxLow - minLow) < 1.2) {
            patterns.push({
                name: 'Symmetrical Triangle',
                confidence: 60,
                direction: data[data.length - 1].close > (maxHigh + minLow)/2 ? 'bullish' : 'bearish'
            });
        }
    }
    
    return patterns;
}

function checkReversalPatterns(candles) {
    const patterns = [];
    
    // Hammer
    if (candles.length >= 1) {
        const candle = candles[candles.length - 1];
        const bodySize = Math.abs(candle.open - candle.close);
        const lowerWick = candle.close > candle.open ? 
            candle.close - candle.low : candle.open - candle.low;
        const upperWick = candle.high - (candle.close > candle.open ? candle.close : candle.open);
        
        if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
            patterns.push({
                name: 'Hammer',
                confidence: 70,
                direction: 'bullish'
            });
        }
    }
    
    // Shooting Star
    if (candles.length >= 1) {
        const candle = candles[candles.length - 1];
        const bodySize = Math.abs(candle.open - candle.close);
        const lowerWick = candle.close > candle.open ? 
            candle.close - candle.low : candle.open - candle.low;
        const upperWick = candle.high - (candle.close > candle.open ? candle.close : candle.open);
        
        if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
            patterns.push({
                name: 'Shooting Star',
                confidence: 70,
                direction: 'bearish'
            });
        }
    }
    
    // Engulfing
    if (candles.length >= 2) {
        const prevCandle = candles[candles.length - 2];
        const currentCandle = candles[candles.length - 1];
        
        if (prevCandle.close > prevCandle.open && // Previous was bullish
            currentCandle.open > currentCandle.close && // Current is bearish
            currentCandle.open > prevCandle.close && 
            currentCandle.close < prevCandle.open) {
            patterns.push({
                name: 'Bearish Engulfing',
                confidence: 75,
                direction: 'bearish'
            });
        } else if (prevCandle.close < prevCandle.open && // Previous was bearish
                  currentCandle.open < currentCandle.close && // Current is bullish
                  currentCandle.open < prevCandle.close && 
                  currentCandle.close > prevCandle.open) {
            patterns.push({
                name: 'Bullish Engulfing',
                confidence: 75,
                direction: 'bullish'
            });
        }
    }
    
    // Morning Star
    if (candles.length >= 3) {
        const first = candles[candles.length - 3];
        const second = candles[candles.length - 2];
        const third = candles[candles.length - 1];
        
        if (first.close < first.open && // First is bearish
            Math.abs(second.close - second.open) / second.open < 0.01 && // Second is doji
            third.close > third.open && // Third is bullish
            third.close > (first.open + first.close)/2) { // Closes above midpoint of first
            patterns.push({
                name: 'Morning Star',
                confidence: 80,
                direction: 'bullish'
            });
        }
    }
    
    // Evening Star
    if (candles.length >= 3) {
        const first = candles[candles.length - 3];
        const second = candles[candles.length - 2];
        const third = candles[candles.length - 1];
        
        if (first.close > first.open && // First is bullish
            Math.abs(second.close - second.open) / second.open < 0.01 && // Second is doji
            third.close < third.open && // Third is bearish
            third.close < (first.open + first.close)/2) { // Closes below midpoint of first
            patterns.push({
                name: 'Evening Star',
                confidence: 80,
                direction: 'bearish'
            });
        }
    }
    
    return patterns;
}

function calculateVWAP(data) {
    let cumulativeVolume = 0;
    let cumulativePV = 0;
    
    for (const bar of data) {
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumulativePV += typicalPrice * bar.volume;
        cumulativeVolume += bar.volume;
    }
    
    return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
}

function extractFeatures(data) {
    // Extract features for neural network (simplified)
    const closes = data.historical.slice(-50).map(d => d.close);
    const returns = [];
    
    for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i-1]) / closes[i-1]);
    }
    
    return [
        { name: 'mean_return', value: returns.reduce((a, b) => a + b, 0) / returns.length, bullishWeight: 0.5, bearishWeight: -0.5 },
        { name: 'volatility', value: Math.sqrt(returns.reduce((sq, n) => sq + Math.pow(n, 2), 0) / returns.length), bullishWeight: -0.3, bearishWeight: -0.3 },
        { name: 'skewness', value: returns.reduce((sum, r) => sum + Math.pow(r, 3), 0) / (returns.length * Math.pow(volatility, 3)), bullishWeight: 0.7, bearishWeight: -0.7 },
        // Add more features as needed
    ];
}

// Initialize API Connection
function initializeAPI() {
    api = new DerivAPIBrowser({ endpoint: API_ENDPOINT, appId: APP_ID });
    document.getElementById('executeBtn').addEventListener('click', () => {
        const direction = document.getElementById('signalDirection').textContent;
        if (direction !== '--') {
            executeTrade(direction);
        }
    });
}

// Signal Display
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

// Trade Execution
async function executeTrade(direction) {
    const now = Date.now();
    if (now - lastSignalTime < 30000) { // 30-second cooldown
        return;
    }
    lastSignalTime = now;
    
    const amount = parseFloat(document.getElementById('tradeAmount').value);
    const maxTrades = parseInt(document.getElementById('maxTrades').value);
    
    if (tradeHistory.length >= maxTrades) {
        handleError('Trade limit reached', new Error(`Maximum ${maxTrades} trades reached`));
        return;
    }
    
    try {
        const response = await api.buy({
            price: amount,
            amount: amount,
            basis: 'stake',
            contract_type: `${direction.toLowerCase()}`,
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
            strategy: 'combined',
            profit: response.buy.profit > 0
        };
        
        tradeHistory.push(trade);
        logTrade(trade);
        
    } catch (error) {
        handleError('Trade execution failed', error);
    }
}

function logTrade(trade) {
    const logEntry = document.createElement('div');
    logEntry.className = `trade-log ${trade.direction.toLowerCase()} ${trade.profit ? 'profit' : 'loss'}`;
    logEntry.innerHTML = `
        <span class="time">${trade.timestamp.toLocaleTimeString()}</span>
        <span class="direction">${trade.direction}</span>
        <span class="amount">${trade.amount} ${currentAccount.currency}</span>
        <span class="instrument">${trade.instrument}</span>
        <span class="outcome">${trade.profit ? 'WIN' : 'LOSS'}</span>
    `;
    document.getElementById('tradeLogs').prepend(logEntry);
}

// Error Handling
function handleError(context, error) {
    console.error(context, error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `${context}: ${error.message}`;
    document.getElementById('tradeLogs').prepend(errorDiv);
}

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    initializeAPI();
    
    // Initialize strategy performance tracking
    for (const strategy of Object.keys(strategies)) {
        strategyPerformance[strategy] = { wins: 0, losses: 0 };
    }
});
