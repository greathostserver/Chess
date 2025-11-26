class ChessGame {
    constructor() {
        this.chessBoard = new ChessBoard();
        this.chessAI = new ChessAI();
        this.isPlayerWhite = true;
        this.gameActive = true;
        
        this.init();
    }

    async init() {
        console.log('Initializing chess game...');
        
        await this.chessAI.init();
        this.chessBoard.init();
        
        this.setupEventListeners();
        this.updateGameStatus();
        
        console.log('Chess game ready!');
    }

    setupEventListeners() {
        // دکمه‌های کنترل
        document.getElementById('newGame').addEventListener('click', () => this.newGame());
        document.getElementById('undoMove').addEventListener('click', () => this.undoMove());
        document.getElementById('hint').addEventListener('click', () => this.getHint());
        document.getElementById('flipBoard').addEventListener('click', () => this.flipBoard());
        
        // تنظیمات
        document.getElementById('playerColor').addEventListener('change', (e) => {
            this.isPlayerWhite = e.target.value === 'white';
        });
        
        document.getElementById('aiLevel').addEventListener('change', (e) => {
            this.chessAI.setLevel(parseInt(e.target.value));
        });
        
        document.getElementById('boardTheme').addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
    }

    handleMove(move) {
        if (!this.gameActive) return null;
        
        console.log('Handling move:', move);
        const result = this.chessBoard.executeMove(move);
        
        if (result) {
            this.updateGameStatus();
            
            // اگر بازی تمام نشده، نوبت حریف (AI)
            if (this.gameActive) {
                setTimeout(() => this.makeAIMove(), 500);
            }
        }
        
        return result;
    }

    async makeAIMove() {
        console.log('AI thinking...');
        const fen = this.chessBoard.chess.fen();
        const bestMove = await this.chessAI.getBestMove(fen);
        
        if (bestMove) {
            const move = {
                from: bestMove.from,
                to: bestMove.to,
                promotion: bestMove.promotion
            };
            
            const result = this.chessBoard.chess.move(move);
            if (result) {
                this.chessBoard.updatePieces();
                this.updateGameStatus();
            }
        }
    }

    async getHint() {
        const fen = this.chessBoard.chess.fen();
        const hint = await this.chessAI.getHint(fen);
        
        if (hint) {
            alert(`پیشنهاد حرکت: از ${hint.from} به ${hint.to}`);
        }
    }

    updateGameStatus() {
        const state = this.chessBoard.getGameState();
        const statusElement = document.getElementById('gameStatus');
        
        if (state.isCheckmate) {
            statusElement.className = 'alert alert-danger';
            statusElement.textContent = `کیش و مات! ${state.turn === 'w' ? 'سیاه' : 'سفید'} برنده شد!`;
            this.gameActive = false;
        } else if (state.isDraw) {
            statusElement.className = 'alert alert-warning';
            statusElement.textContent = 'بازی مساوی شد!';
            this.gameActive = false;
        } else if (state.isCheck) {
            statusElement.className = 'alert alert-warning';
            statusElement.textContent = `کیش! نوبت ${state.turn === 'w' ? 'سفید' : 'سیاه'}`;
        } else {
            statusElement.className = 'alert alert-info';
            statusElement.textContent = `نوبت: ${state.turn === 'w' ? 'سفید' : 'سیاه'}`;
        }
    }

    newGame() {
        this.chessBoard.resetBoard();
        this.gameActive = true;
        this.updateGameStatus();
    }

    undoMove() {
        // پیاده‌سازی ساده
        alert('قابلیت پس‌گیری حرکت در نسخه آزمایشی فعال نیست');
    }

    flipBoard() {
        this.chessBoard.flipBoard();
    }
}
