class ChessAI {
    constructor() {
        this.stockfish = null;
        this.isInitialized = false;
        this.onMessageCallback = null;
        this.onEvaluationCallback = null;
        this.currentLevel = 2;
    }

    async init() {
        return new Promise((resolve, reject) => {
            try {
                // استفاده از Stockfish از CDN
                this.stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
                
                this.stockfish.onmessage = (event) => {
                    this.handleStockfishMessage(event.data);
                };
                
                this.stockfish.onerror = (error) => {
                    console.error('Stockfish error:', error);
                    reject(error);
                };
                
                // تنظیمات اولیه
                this.stockfish.postMessage('uci');
                this.stockfish.postMessage('isready');
                
                setTimeout(() => {
                    this.isInitialized = true;
                    this.setLevel(this.currentLevel);
                    resolve();
                }, 1000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    setLevel(level) {
        if (!this.isInitialized) return;
        
        this.currentLevel = level;
        const skillLevel = Math.max(0, Math.min(20, (level - 1) * 5));
        
        this.stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`);
        this.stockfish.postMessage('setoption name Contempt value 0');
        this.stockfish.postMessage('setoption name Min Split Depth value 0');
        this.stockfish.postMessage('setoption name Threads value 2');
        this.stockfish.postMessage('setoption name Hash value 32');
    }

    setMessageCallback(callback) {
        this.onMessageCallback = callback;
    }

    setEvaluationCallback(callback) {
        this.onEvaluationCallback = callback;
    }

    handleStockfishMessage(message) {
        if (this.onMessageCallback) {
            this.onMessageCallback(message);
        }

        if (message.startsWith('bestmove') && this.onMessageCallback) {
            const bestMove = message.split(' ')[1];
            if (bestMove && bestMove !== 'null') {
                this.onMessageCallback({
                    type: 'bestmove',
                    move: bestMove,
                    from: bestMove.substring(0, 2),
                    to: bestMove.substring(2, 4),
                    promotion: bestMove.substring(4, 5) || 'q'
                });
            }
        }
        
        if (message.startsWith('info') && message.includes('score cp')) {
            this.processEvaluation(message);
        }
        
        if (message.startsWith('info') && message.includes('pv')) {
            this.processPV(message);
        }
    }

    processEvaluation(message) {
        if (!this.onEvaluationCallback) return;
        
        const scoreMatch = message.match(/score cp (-?\d+)/);
        const mateMatch = message.match(/score mate (-?\d+)/);
        
        if (scoreMatch) {
            const score = parseInt(scoreMatch[1]) / 100;
            this.onEvaluationCallback({
                type: 'cp',
                score: score,
                formatted: this.formatScore(score)
            });
        } else if (mateMatch) {
            const moves = parseInt(mateMatch[1]);
            this.onEvaluationCallback({
                type: 'mate',
                moves: moves,
                formatted: `کیش و مات در ${Math.abs(moves)} حرکت`
            });
        }
    }

    processPV(message) {
        const pvMatch = message.match(/pv (\S+)/);
        const depthMatch = message.match(/depth (\d+)/);
        
        if (pvMatch && depthMatch && this.onMessageCallback) {
            const bestMove = pvMatch[1];
            const depth = parseInt(depthMatch[1]);
            
            this.onMessageCallback({
                type: 'pv',
                move: bestMove,
                depth: depth,
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4)
            });
        }
    }

    formatScore(score) {
        if (Math.abs(score) < 0.5) return 'برابر';
        
        const absScore = Math.abs(score);
        const side = score > 0 ? 'سفید' : 'سیاه';
        const advantage = absScore < 1 ? 'برتری جزئی' : 
                         absScore < 3 ? 'برتری' : 
                         absScore < 5 ? 'برتری واضح' : 'برتری قاطع';
        
        return `${side} ${advantage} (${score > 0 ? '+' : ''}${score.toFixed(1)})`;
    }

    getBestMove(fen, time = 3000) {
        return new Promise((resolve) => {
            if (!this.isInitialized) {
                resolve(null);
                return;
            }

            const timeoutId = setTimeout(() => {
                this.stockfish.postMessage('stop');
                resolve(null);
            }, time + 1000);

            const messageHandler = (message) => {
                if (message.type === 'bestmove') {
                    clearTimeout(timeoutId);
                    this.setMessageCallback(null);
                    resolve(message);
                }
            };

            this.setMessageCallback(messageHandler);
            this.stockfish.postMessage(`position fen ${fen}`);
            
            const levelTimes = {1: 1000, 2: 2000, 3: 3000, 4: 5000};
            const moveTime = levelTimes[this.currentLevel] || time;
            this.stockfish.postMessage(`go movetime ${moveTime}`);
        });
    }

    getHint(fen) {
        return new Promise((resolve) => {
            if (!this.isInitialized) {
                resolve(null);
                return;
            }

            const messageHandler = (message) => {
                if (message.type === 'pv') {
                    this.setMessageCallback(null);
                    resolve(message);
                }
            };

            this.setMessageCallback(messageHandler);
            this.stockfish.postMessage(`position fen ${fen}`);
            this.stockfish.postMessage('go depth 8');
            
            // توقف بعد از 2 ثانیه
            setTimeout(() => {
                this.stockfish.postMessage('stop');
                this.setMessageCallback(null);
            }, 2000);
        });
    }

    getEvaluation(fen) {
        return new Promise((resolve) => {
            if (!this.isInitialized) {
                resolve(null);
                return;
            }

            let bestScore = null;
            let depth = 0;

            const messageHandler = (message) => {
                if (message.type === 'cp' || message.type === 'mate') {
                    bestScore = message;
                    depth++;
                }
                
                if (depth >= 3) { // پس از ۳ عمق، بهترین ارزیابی را برگردان
                    this.setMessageCallback(null);
                    resolve(bestScore);
                }
            };

            this.setMessageCallback(messageHandler);
            this.stockfish.postMessage(`position fen ${fen}`);
            this.stockfish.postMessage('go depth 15');
            
            // توقف بعد از ۳ ثانیه
            setTimeout(() => {
                this.stockfish.postMessage('stop');
                this.setMessageCallback(null);
                resolve(bestScore);
            }, 3000);
        });
    }

    analyzePosition(fen, depth = 15) {
        return new Promise((resolve) => {
            if (!this.isInitialized) {
                resolve(null);
                return;
            }

            const analysis = {
                bestMove: null,
                evaluation: null,
                pv: [],
                depth: 0
            };

            const messageHandler = (message) => {
                switch (message.type) {
                    case 'bestmove':
                        analysis.bestMove = message;
                        break;
                    case 'cp':
                    case 'mate':
                        analysis.evaluation = message;
                        break;
                    case 'pv':
                        analysis.pv.push(message);
                        analysis.depth = Math.max(analysis.depth, message.depth);
                        break;
                }
            };

            this.setMessageCallback(messageHandler);
            this.stockfish.postMessage(`position fen ${fen}`);
            this.stockfish.postMessage(`go depth ${depth}`);
            
            setTimeout(() => {
                this.stockfish.postMessage('stop');
                this.setMessageCallback(null);
                resolve(analysis);
            }, 5000);
        });
    }

    getOpeningName(fen) {
        // پایگاه داده ساده openings (می‌توانید گسترش دهید)
        const openings = {
            'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3': 'بازی باز - شروع وین',
            'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3': 'بازی بسته - دفاع هندی',
            'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': 'سیسیلی - واریاسیون اصلی'
        };
        
        return openings[fen] || 'نامشخص';
    }

    getGamePhase(fen) {
        const game = new Chess(fen);
        const pieces = game.fen().split(' ')[0];
        
        const queenCount = (pieces.match(/q/gi) || []).length;
        const minorPiecesCount = (pieces.match(/[bn]/gi) || []).length;
        const pawnCount = (pieces.match(/p/gi) || []).length;
        
        if (queenCount === 2 && minorPiecesCount >= 4) return 'افتتاحیه';
        if (queenCount >= 1 && pawnCount >= 8) return 'میانه بازی';
        if (queenCount <= 1 && minorPiecesCount <= 4) return 'اندگیم';
        return 'انتهای بازی';
    }

    destroy() {
        if (this.stockfish) {
            this.stockfish.terminate();
            this.stockfish = null;
        }
        this.isInitialized = false;
    }
}

// کلاس کمکی برای مدیریت سطوح مختلف AI
class AIDifficultyManager {
    constructor() {
        this.levels = {
            1: { name: 'مبتدی', depth: 2, skill: 0, time: 1000 },
            2: { name: 'متوسط', depth: 4, skill: 10, time: 2000 },
            3: { name: 'حرفه‌ای', depth: 6, skill: 15, time: 3000 },
            4: { name: 'استاد', depth: 8, skill: 20, time: 5000 }
        };
    }

    getLevelConfig(level) {
        return this.levels[level] || this.levels[2];
    }

    getMoveTime(level) {
        return this.getLevelConfig(level).time;
    }

    getDepth(level) {
        return this.getLevelConfig(level).depth;
    }

    getAllLevels() {
        return Object.entries(this.levels).map(([id, config]) => ({
            id: parseInt(id),
            name: config.name,
            depth: config.depth
        }));
    }
}
