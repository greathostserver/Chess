class ChessGame {
    constructor() {
        this.chess = new Chess();
        this.boardElement = document.getElementById('chessboard');
        this.moveHistoryElement = document.getElementById('moveHistory');
        this.gameStatusElement = document.getElementById('gameStatus');
        this.evaluationElement = document.getElementById('evaluation');
        
        this.stockfish = new Worker('js/stockfish.js');
        this.stockfish.onmessage = this.handleStockfishMessage.bind(this);
        
        this.isPlayerWhite = true;
        this.gameActive = true;
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.boardFlipped = false;
        
        this.initializeEventListeners();
        this.initializeStockfish();
        this.drawBoard();
        this.updateGameStatus();
    }

    initializeEventListeners() {
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
            this.setStockfishLevel(parseInt(e.target.value));
        });
        
        document.getElementById('boardTheme').addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
        });
        
        // تایمر
        document.getElementById('startTimer').addEventListener('click', () => this.startTimer());
    }

    initializeStockfish() {
        this.stockfish.postMessage('uci');
        this.setStockfishLevel(2); // سطح متوسط پیش‌فرض
    }

    setStockfishLevel(level) {
        const depths = {1: 2, 2: 4, 3: 6, 4: 8};
        const depth = depths[level] || 4;
        
        this.stockfish.postMessage(`setoption name Skill Level value ${level - 1}`);
        this.stockfish.postMessage(`setoption name Contempt value 0`);
        this.stockfish.postMessage(`setoption name Skill Level Maximum Error value 0.1`);
        this.stockfish.postMessage(`setoption name Skill Level Probability value 0.1`);
    }

    drawBoard() {
        this.boardElement.innerHTML = '';
        
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        
        if (this.boardFlipped) {
            files.reverse();
            ranks.reverse();
        }

        for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
            const row = document.createElement('div');
            row.className = 'board-row';
            
            for (let fileIndex = 0; fileIndex < 8; fileIndex++) {
                const square = document.createElement('div');
                const squareColor = (rankIndex + fileIndex) % 2 === 0 ? 'light' : 'dark';
                square.className = `square ${squareColor}`;
                square.dataset.square = files[fileIndex] + ranks[rankIndex];
                
                // اضافه کردن مختصات
                if (rankIndex === 7) {
                    const fileCoord = document.createElement('div');
                    fileCoord.className = 'coordinates coord-file';
                    fileCoord.textContent = files[fileIndex];
                    square.appendChild(fileCoord);
                }
                
                if (fileIndex === 0) {
                    const rankCoord = document.createElement('div');
                    rankCoord.className = 'coordinates coord-rank';
                    rankCoord.textContent = ranks[rankIndex];
                    square.appendChild(rankCoord);
                }
                
                square.addEventListener('click', () => this.handleSquareClick(square.dataset.square));
                row.appendChild(square);
            }
            
            this.boardElement.appendChild(row);
        }
        
        this.updatePieces();
    }

    updatePieces() {
        // پاک کردن مهره‌های قبلی
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
        
        // رسم مهره‌های جدید
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = String.fromCharCode(97 + file) + (8 - rank);
                const piece = this.chess.get(square);
                
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color}`;
                    pieceElement.textContent = this.getPieceSymbol(piece.type, piece.color);
                    pieceElement.draggable = true;
                    
                    pieceElement.addEventListener('dragstart', (e) => {
                        if (this.gameActive && 
                            ((piece.color === 'w' && this.isPlayerWhite) || 
                             (piece.color === 'b' && !this.isPlayerWhite))) {
                            e.dataTransfer.setData('text/plain', square);
                            this.handleSquareClick(square);
                        }
                    });
                    
                    const squareElement = this.getSquareElement(square);
                    if (squareElement) {
                        squareElement.appendChild(pieceElement);
                    }
                }
            }
        }
        
        // برجسته‌سازی حرکت‌های ممکن
        this.highlightPossibleMoves();
    }

    getPieceSymbol(type, color) {
        const symbols = {
            p: { white: '♙', black: '♟' },
            n: { white: '♘', black: '♞' },
            b: { white: '♗', black: '♝' },
            r: { white: '♖', black: '♜' },
            q: { white: '♕', black: '♛' },
            k: { white: '♔', black: '♚' }
        };
        return symbols[type][color];
    }

    getSquareElement(square) {
        return document.querySelector(`[data-square="${square}"]`);
    }

    handleSquareClick(square) {
        if (!this.gameActive) return;
        
        const piece = this.chess.get(square);
        
        // اگر مربعی انتخاب شده بود و کاربر روی مربع دیگری کلیک کرد
        if (this.selectedSquare && this.selectedSquare !== square) {
            const move = this.tryMove(this.selectedSquare, square);
            if (move) {
                this.makeMove(move);
                return;
            }
        }
        
        // اگر کاربر روی مهره خودش کلیک کرد
        if (piece && 
            ((piece.color === 'w' && this.isPlayerWhite) || 
             (piece.color === 'b' && !this.isPlayerWhite))) {
            
            this.selectedSquare = square;
            this.possibleMoves = this.chess.moves({
                square: square,
                verbose: true
            });
            
            this.clearHighlights();
            this.highlightSquare(square, 'selected');
            this.highlightPossibleMoves();
        } else {
            this.selectedSquare = null;
            this.possibleMoves = [];
            this.clearHighlights();
        }
    }

    tryMove(from, to) {
        const moves = this.chess.moves({ verbose: true });
        return moves.find(move => move.from === from && move.to === to);
    }

    makeMove(move) {
        this.chess.move(move);
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.clearHighlights();
        this.updatePieces();
        this.updateMoveHistory();
        this.updateGameStatus();
        
        if (this.gameActive) {
            this.getEvaluation();
            
            // اگر نوبت هوش مصنوعی است
            if ((this.chess.turn() === 'w' && !this.isPlayerWhite) || 
                (this.chess.turn() === 'b' && this.isPlayerWhite)) {
                this.makeAIMove();
            }
        }
    }

    makeAIMove() {
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        this.stockfish.postMessage('go depth 8');
    }

    handleStockfishMessage(event) {
        const message = event.data;
        
        if (message.startsWith('bestmove')) {
            const bestMove = message.split(' ')[1];
            if (bestMove && bestMove !== 'null') {
                setTimeout(() => {
                    const move = this.chess.move({
                        from: bestMove.substring(0, 2),
                        to: bestMove.substring(2, 4),
                        promotion: bestMove.substring(4, 5) || 'q'
                    });
                    
                    if (move) {
                        this.updatePieces();
                        this.updateMoveHistory();
                        this.updateGameStatus();
                        this.getEvaluation();
                    }
                }, 500);
            }
        } else if (message.startsWith('info depth') && message.includes('score cp')) {
            // پردازش ارزیابی موقعیت
            const scoreMatch = message.match(/score cp (-?\d+)/);
            if (scoreMatch) {
                const score = parseInt(scoreMatch[1]) / 100;
                this.updateEvaluation(score);
            }
        }
    }

    highlightSquare(square, className) {
        const squareElement = this.getSquareElement(square);
        if (squareElement) {
            squareElement.classList.add(className);
        }
    }

    highlightPossibleMoves() {
        this.possibleMoves.forEach(move => {
            const className = move.flags.includes('c') ? 'possible-capture' : 'possible-move';
            this.highlightSquare(move.to, className);
        });
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'possible-move', 'possible-capture');
        });
    }

    updateMoveHistory() {
        this.moveHistoryElement.innerHTML = '';
        const moves = this.chess.history({ verbose: true });
        
        for (let i = 0; i < moves.length; i += 2) {
            const moveRow = document.createElement('div');
            moveRow.className = 'move-row d-flex justify-content-between';
            
            const moveNumber = document.createElement('span');
            moveNumber.textContent = `${Math.floor(i/2) + 1}.`;
            moveNumber.className = 'text-muted';
            
            const whiteMove = document.createElement('span');
            whiteMove.textContent = moves[i].san;
            whiteMove.className = 'move';
            whiteMove.addEventListener('click', () => this.showMoveDetails(moves[i]));
            
            const blackMove = document.createElement('span');
            if (moves[i + 1]) {
                blackMove.textContent = moves[i + 1].san;
                blackMove.className = 'move';
                blackMove.addEventListener('click', () => this.showMoveDetails(moves[i + 1]));
            }
            
            moveRow.appendChild(moveNumber);
            moveRow.appendChild(whiteMove);
            moveRow.appendChild(blackMove);
            this.moveHistoryElement.appendChild(moveRow);
        }
        
        this.moveHistoryElement.scrollTop = this.moveHistoryElement.scrollHeight;
    }

    updateGameStatus() {
        if (this.chess.isCheckmate()) {
            this.gameStatusElement.className = 'alert alert-danger';
            this.gameStatusElement.textContent = `کیش و مات! ${this.chess.turn() === 'w' ? 'سیاه' : 'سفید'} برنده شد!`;
            this.gameActive = false;
        } else if (this.chess.isDraw()) {
            this.gameStatusElement.className = 'alert alert-warning';
            this.gameStatusElement.textContent = 'بازی مساوی شد!';
            this.gameActive = false;
        } else if (this.chess.isCheck()) {
            this.gameStatusElement.className = 'alert alert-warning';
            this.gameStatusElement.textContent = `کیش! نوبت ${this.chess.turn() === 'w' ? 'سفید' : 'سیاه'}`;
        } else {
            this.gameStatusElement.className = 'alert alert-info';
            this.gameStatusElement.textContent = `نوبت: ${this.chess.turn() === 'w' ? 'سفید' : 'سیاه'}`;
            this.gameActive = true;
        }
    }

    updateEvaluation(score) {
        let evaluationText = 'برابر';
        let evaluationClass = 'text-success';
        
        if (score > 2) {
            evaluationText = `سفید +${score.toFixed(1)}`;
            evaluationClass = 'text-primary';
        } else if (score < -2) {
            evaluationText = `سیاه +${Math.abs(score).toFixed(1)}`;
            evaluationClass = 'text-dark';
        } else if (score > 0.5) {
            evaluationText = `سفید بهتر +${score.toFixed(1)}`;
            evaluationClass = 'text-info';
        } else if (score < -0.5) {
            evaluationText = `سیاه بهتر +${Math.abs(score).toFixed(1)}`;
            evaluationClass = 'text-secondary';
        }
        
        this.evaluationElement.innerHTML = `<small class="${evaluationClass}">ارزیابی: ${evaluationText}</small>`;
    }

    getEvaluation() {
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        this.stockfish.postMessage('eval');
    }

    getHint() {
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        this.stockfish.postMessage('go depth 6');
        
        setTimeout(() => {
            this.stockfish.postMessage('stop');
        }, 2000);
    }

    newGame() {
        this.chess.reset();
        this.gameActive = true;
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.clearHighlights();
        this.updatePieces();
        this.updateMoveHistory();
        this.updateGameStatus();
        this.evaluationElement.innerHTML = '<small>ارزیابی: برابر</small>';
    }

    undoMove() {
        this.chess.undo();
        this.chess.undo(); // دو بار undo برای برگرداندن حرکت هوش مصنوعی و حرکت کاربر
        this.updatePieces();
        this.updateMoveHistory();
        this.updateGameStatus();
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        this.drawBoard();
    }

    saveGame() {
        const gameData = {
            fen: this.chess.fen(),
            pgn: this.chess.pgn(),
            moves: this.chess.history()
        };
        
        const blob = new Blob([JSON.stringify(gameData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chess-game-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadGame() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const gameData = JSON.parse(event.target.result);
                    this.chess.load(gameData.fen);
                    this.updatePieces();
                    this.updateMoveHistory();
                    this.updateGameStatus();
                } catch (error) {
                    alert('خطا در بارگذاری بازی!');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    startTimer() {
        // پیاده‌سازی تایمر ساده
        let whiteTime = 600; // 10 دقیقه
        let blackTime = 600;
        
        const timer = setInterval(() => {
            if (!this.gameActive) {
                clearInterval(timer);
                return;
            }
            
            if (this.chess.turn() === 'w') {
                whiteTime--;
                document.getElementById('whiteTime').textContent = 
                    `${Math.floor(whiteTime/60)}:${(whiteTime%60).toString().padStart(2, '0')}`;
            } else {
                blackTime--;
                document.getElementById('blackTime').textContent = 
                    `${Math.floor(blackTime/60)}:${(blackTime%60).toString().padStart(2, '0')}`;
            }
            
            if (whiteTime <= 0 || blackTime <= 0) {
                clearInterval(timer);
                this.gameStatusElement.className = 'alert alert-danger';
                this.gameStatusElement.textContent = 'وقت تمام شد!';
                this.gameActive = false;
            }
        }, 1000);
    }

    showMoveDetails(move) {
        // نمایش جزئیات حرکت
        alert(`حرکت: ${move.san}\nاز: ${move.from}\nبه: ${move.to}\nنوع: ${move.flags}`);
    }
}

// راه‌اندازی بازی وقتی صفحه لود شد
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
