class ChessGame {
    constructor() {
        this.chessBoard = new ChessBoard();
        this.chessAI = new ChessAI();
        this.difficultyManager = new AIDifficultyManager();
        
        this.isPlayerWhite = true;
        this.gameActive = true;
        this.moveHistoryElement = document.getElementById('moveHistory');
        this.gameStatusElement = document.getElementById('gameStatus');
        this.evaluationElement = document.getElementById('evaluation');
        
        this.init();
    }

    async init() {
        // مقداردهی اولیه
        this.chessBoard.init();
        await this.chessAI.init();
        
        // تنظیم callback های AI
        this.chessAI.setMessageCallback(this.handleAIMessage.bind(this));
        this.chessAI.setEvaluationCallback(this.handleEvaluation.bind(this));
        
        this.setupUIEventListeners();
        this.updateGameStatus();
        
        console.log('Chess game initialized successfully');
    }

    setupUIEventListeners() {
        // دکمه‌های کنترل
        document.getElementById('newGame').addEventListener('click', () => this.newGame());
        document.getElementById('undoMove').addEventListener('click', () => this.undoMove());
        document.getElementById('saveGame').addEventListener('click', () => this.saveGame());
        document.getElementById('loadGame').addEventListener('click', () => this.loadGame());
        document.getElementById('flipBoard').addEventListener('click', () => this.flipBoard());
        document.getElementById('hint').addEventListener('click', () => this.getHint());
        
        // تنظیمات
        document.getElementById('playerColor').addEventListener('change', (e) => {
            this.isPlayerWhite = e.target.value === 'white';
            this.newGame();
        });
        
        document.getElementById('aiLevel').addEventListener('change', (e) => {
            this.chessAI.setLevel(parseInt(e.target.value));
        });
        
        document.getElementById('boardTheme').addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
        
        // تایمر
        document.getElementById('startTimer').addEventListener('click', () => this.startTimer());
        
        // رویداد حرکت
        this.chessBoard.chess.move = this.handleMove.bind(this);
    }

    handleMove(move) {
        if (!this.gameActive) return null;
        
        const result = this.chessBoard.executeMove(move);
        if (result) {
            this.updateMoveHistory();
            this.updateGameStatus();
            this.getEvaluation();
            
            // اگر نوبت AI است
            if (this.isAITurn()) {
                this.makeAIMove();
            }
        }
        return result;
    }

    handleAIMessage(message) {
        switch (message.type) {
            case 'bestmove':
                this.executeAIMove(message);
                break;
            case 'pv':
                this.showHint(message);
                break;
        }
    }

    handleEvaluation(evaluation) {
        this.updateEvaluation(evaluation);
    }

    isAITurn() {
        const currentTurn = this.chessBoard.chess.turn();
        return (currentTurn === 'w' && !this.isPlayerWhite) || 
               (currentTurn === 'b' && this.isPlayerWhite);
    }

    async makeAIMove() {
        if (!this.gameActive) return;
        
        const fen = this.chessBoard.chess.fen();
        const bestMove = await this.chessAI.getBestMove(fen);
        
        if (bestMove) {
            this.executeAIMove(bestMove);
        }
    }

    executeAIMove(moveData) {
        const move = {
            from: moveData.from,
            to: moveData.to,
            promotion: moveData.promotion
        };
        
        const result = this.chessBoard.chess.move(move);
        if (result) {
            this.chessBoard.updatePieces();
            this.updateMoveHistory();
            this.updateGameStatus();
            this.getEvaluation();
        }
    }

    async getHint() {
        if (!this.gameActive) return;
        
        const fen = this.chessBoard.chess.fen();
        const hint = await this.chessAI.getHint(fen);
        
        if (hint) {
            this.showHint(hint);
        }
    }

    showHint(hint) {
        const modal = new bootstrap.Modal(document.getElementById('hintModal'));
        document.getElementById('hintText').textContent = 
            `پیشنهاد حرکت: از ${hint.from} به ${hint.to} (عمق تحلیل: ${hint.depth})`;
        modal.show();
    }

    async getEvaluation() {
        const fen = this.chessBoard.chess.fen();
        const evaluation = await this.chessAI.getEvaluation(fen);
        
        if (evaluation) {
            this.updateEvaluation(evaluation);
        }
    }

    updateEvaluation(evaluation) {
        let text, className;
        
        if (evaluation.type === 'mate') {
            text = evaluation.formatted;
            className = evaluation.moves > 0 ? 'text-success' : 'text-danger';
        } else {
            text = evaluation.formatted;
            const score = evaluation.score;
            className = Math.abs(score) < 0.5 ? 'text-success' : 
                       score > 0 ? 'text-primary' : 'text-dark';
        }
        
        this.evaluationElement.innerHTML = `<small class="${className}">${text}</small>`;
    }

    updateMoveHistory() {
        this.moveHistoryElement.innerHTML = '';
        const moves = this.chessBoard.chess.history({ verbose: true });
        
        for (let i = 0; i < moves.length; i += 2) {
            const moveRow = this.createMoveRow(i, moves);
            this.moveHistoryElement.appendChild(moveRow);
        }
        
        this.moveHistoryElement.scrollTop = this.moveHistoryElement.scrollHeight;
    }

    createMoveRow(index, moves) {
        const moveRow = document.createElement('div');
        moveRow.className = 'move-row d-flex justify-content-between align-items-center mb-1 p-2 border-bottom';
        
        const moveNumber = document.createElement('span');
        moveNumber.className = 'text-muted me-3';
        moveNumber.textContent = `${Math.floor(index/2) + 1}.`;
        
        const whiteMove = this.createMoveButton(moves[index], 'primary');
        const blackMove = moves[index + 1] ? 
            this.createMoveButton(moves[index + 1], 'dark') : 
            this.createEmptyMoveButton();
        
        moveRow.appendChild(moveNumber);
        moveRow.appendChild(whiteMove);
        moveRow.appendChild(blackMove);
        
        return moveRow;
    }

    createMoveButton(move, color) {
        const button = document.createElement('button');
        button.className = `btn btn-sm btn-outline-${color} me-2 flex-fill`;
        button.textContent = move.san;
        button.addEventListener('click', () => this.showMoveDetails(move));
        return button;
    }

    createEmptyMoveButton() {
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-outline-secondary me-2 flex-fill';
        button.textContent = '...';
        button.disabled = true;
        return button;
    }

    updateGameStatus() {
        const state = this.chessBoard.getGameState();
        
        if (state.isCheckmate) {
            this.showGameOver(`کیش و مات! ${state.turn === 'w' ? 'سیاه' : 'سفید'} برنده شد!`, 'danger');
        } else if (state.isDraw) {
            this.showGameOver(this.getDrawReason(), 'warning');
        } else if (state.isCheck) {
            this.showCheck(state.turn);
        } else {
            this.showNormalTurn(state.turn);
        }
    }

    showGameOver(message, type) {
        this.gameStatusElement.className = `alert alert-${type}`;
        this.gameStatusElement.textContent = message;
        this.gameActive = false;
    }

    showCheck(turn) {
        this.gameStatusElement.className = 'alert alert-warning';
        this.gameStatusElement.textContent = `کیش! نوبت ${turn === 'w' ? 'سفید' : 'سیاه'}`;
        this.gameActive = true;
    }

    showNormalTurn(turn) {
        this.gameStatusElement.className = 'alert alert-info';
        this.gameStatusElement.textContent = `نوبت: ${turn === 'w' ? 'سفید' : 'سیاه'}`;
        this.gameActive = true;
    }

    getDrawReason() {
        if (this.chessBoard.chess.isStalemate()) return 'پات! بازی مساوی شد.';
        if (this.chessBoard.chess.isThreefoldRepetition()) return 'تکرار سه‌باره حرکت! بازی مساوی شد.';
        if (this.chessBoard.chess.isInsufficientMaterial()) return 'ماده ناکافی! بازی مساوی شد.';
        return 'بازی مساوی شد!';
    }

    newGame() {
        this.chessBoard.resetBoard();
        this.gameActive = true;
        this.updateMoveHistory();
        this.updateGameStatus();
        this.evaluationElement.innerHTML = '<small class="text-success">ارزیابی: برابر</small>';
        
        if (!this.isPlayerWhite) {
            setTimeout(() => this.makeAIMove(), 1000);
        }
    }

    undoMove() {
        try {
            if (this.chessBoard.chess.history().length >= 2) {
                this.chessBoard.chess.undo();
                this.chessBoard.chess.undo();
                this.chessBoard.updatePieces();
                this.updateMoveHistory();
                this.updateGameStatus();
                this.getEvaluation();
            }
        } catch (error) {
            console.error('Error undoing move:', error);
        }
    }

    flipBoard() {
        this.chessBoard.flipBoard();
    }

    saveGame() {
        const gameData = {
            fen: this.chessBoard.chess.fen(),
            pgn: this.chessBoard.chess.pgn(),
            history: this.chessBoard.chess.history(),
            timestamp: new Date().toISOString(),
            playerColor: this.isPlayerWhite ? 'white' : 'black',
            aiLevel: document.getElementById('aiLevel').value
        };
        
        this.downloadJSON(gameData, `chess-game-${new Date().toISOString().split('T')[0]}.json`);
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadGame() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const gameData = JSON.parse(event.target.result);
                    this.loadGameData(gameData);
                } catch (error) {
                    alert('خطا در بارگذاری بازی!');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    loadGameData(gameData) {
        this.chessBoard.loadGame(gameData.fen);
        
        if (gameData.playerColor) {
            this.isPlayerWhite = gameData.playerColor === 'white';
            document.getElementById('playerColor').value = gameData.playerColor;
        }
        
        if (gameData.aiLevel) {
            document.getElementById('aiLevel').value = gameData.aiLevel;
            this.chessAI.setLevel(parseInt(gameData.aiLevel));
        }
        
        this.updateMoveHistory();
        this.updateGameStatus();
        this.getEvaluation();
    }

    startTimer() {
        // پیاده‌سازی تایمر (همانند قبل)
        console.log('Timer started');
    }

    showMoveDetails(move) {
        const modal = new bootstrap.Modal(document.getElementById('hintModal'));
        document.getElementById('hintText').textContent = 
            `حرکت: ${move.san}\nاز: ${move.from}\nبه: ${move.to}\nنوع: ${this.getMoveType(move.flags)}`;
        modal.show();
    }

    getMoveType(flags) {
        const types = {
            'n': 'حرکت معمولی',
            'b': 'حرکت اسب',
            'e': 'ان پاسان',
            'c': 'زدن مهره',
            'p': 'ارتقا پیاده',
            'k': 'قلعه کوتاه',
            'q': 'قلعه بلند'
        };
        return types[flags] || 'حرکت ناشناخته';
    }

    destroy() {
        this.chessAI.destroy();
    }
}

// راه‌اندازی بازی
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGame();
});
