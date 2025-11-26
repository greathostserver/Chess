class ChessGame {
    constructor() {
        this.chess = new Chess();
        this.boardElement = document.getElementById('chessboard');
        this.moveHistoryElement = document.getElementById('moveHistory');
        this.gameStatusElement = document.getElementById('gameStatus');
        this.evaluationElement = document.getElementById('evaluation');
        
        // استفاده از Stockfish از CDN
        this.stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
        this.stockfish.onmessage = this.handleStockfishMessage.bind(this);
        
        this.isPlayerWhite = true;
        this.gameActive = true;
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.boardFlipped = false;
        this.draggedPiece = null;
        
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
        
        // Drag and Drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        this.boardElement.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('piece')) {
                const square = e.target.parentElement.dataset.square;
                const piece = this.chess.get(square);
                
                if (piece && this.gameActive && 
                    ((piece.color === 'w' && this.isPlayerWhite) || 
                     (piece.color === 'b' && !this.isPlayerWhite))) {
                    this.draggedPiece = square;
                    e.target.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', square);
                    this.handleSquareClick(square);
                } else {
                    e.preventDefault();
                }
            }
        });

        this.boardElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.target.classList.contains('square')) {
                e.target.classList.add('drag-over');
            }
        });

        this.boardElement.addEventListener('dragleave', (e) => {
            e.target.classList.remove('drag-over');
        });

        this.boardElement.addEventListener('drop', (e) => {
            e.preventDefault();
            e.target.classList.remove('drag-over');
            
            if (e.target.classList.contains('square') && this.draggedPiece) {
                const fromSquare = this.draggedPiece;
                const toSquare = e.target.dataset.square;
                this.draggedPiece = null;
                
                const move = this.tryMove(fromSquare, toSquare);
                if (move) {
                    this.makeMove(move);
                }
            }
            
            // حذف حالت dragging از تمام مهره‌ها
            document.querySelectorAll('.piece.dragging').forEach(piece => {
                piece.classList.remove('dragging');
            });
        });

        this.boardElement.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.square.drag-over').forEach(square => {
                square.classList.remove('drag-over');
            });
        });
    }

    initializeStockfish() {
        this.stockfish.postMessage('uci');
        this.setStockfishLevel(2); // سطح متوسط پیش‌فرض
        
        // تنظیمات اولیه Stockfish
        setTimeout(() => {
            this.stockfish.postMessage('setoption name Contempt value 0');
            this.stockfish.postMessage('setoption name Min Split Depth value 0');
            this.stockfish.postMessage('setoption name Threads value 1');
            this.stockfish.postMessage('setoption name Hash value 16');
        }, 100);
    }

    setStockfishLevel(level) {
        const depths = {1: 2, 2: 4, 3: 6, 4: 8};
        const depth = depths[level] || 4;
        
        const skillLevel = Math.max(0, Math.min(20, (level - 1) * 5));
        this.stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`);
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
                    const squareElement = this.getSquareElement(square);
                    if (squareElement) {
                        const pieceElement = document.createElement('div');
                        pieceElement.className = `piece ${piece.color}`;
                        pieceElement.textContent = this.getPieceSymbol(piece.type, piece.color);
                        pieceElement.draggable = true;
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
        try {
            const move = {
                from: from,
                to: to,
                promotion: 'q' // پیش‌فرض ارتقا به وزیر
            };
            
            // بررسی حرکت معتبر
            const possibleMoves = this.chess.moves({ square: from, verbose: true });
            const validMove = possibleMoves.find(m => m.from === from && m.to === to);
            
            return validMove || null;
        } catch (error) {
            return null;
        }
    }

    makeMove(move) {
        try {
            const result = this.chess.move(move);
            if (result) {
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
                        setTimeout(() => this.makeAIMove(), 500);
                    }
                }
            }
        } catch (error) {
            console.error('خطا در انجام حرکت:', error);
        }
    }

    makeAIMove() {
        if (!this.gameActive) return;
        
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        
        // تنظیم زمان براساس سطح
        const level = parseInt(document.getElementById('aiLevel').value);
        const times = {1: 1000, 2: 2000, 3: 3000, 4: 5000};
        const time = times[level] || 2000;
        
        this.stockfish.postMessage(`go movetime ${time}`);
    }

    handleStockfishMessage(event) {
        const message = event.data;
        
        if (message.startsWith('bestmove')) {
            const parts = message.split(' ');
            if (parts.length > 1 && parts[1] !== 'null') {
                const bestMove = parts[1];
                this.executeAIMove(bestMove);
            }
        } else if (message.startsWith('info') && message.includes('score cp')) {
            this.processEvaluation(message);
        } else if (message.startsWith('info') && message.includes('pv')) {
            this.processHint(message);
        }
    }

    executeAIMove(bestMove) {
        try {
            const move = {
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4),
                promotion: bestMove.substring(4, 5) || 'q'
            };
            
            const result = this.chess.move(move);
            if (result) {
                this.updatePieces();
                this.updateMoveHistory();
                this.updateGameStatus();
                this.getEvaluation();
            }
        } catch (error) {
            console.error('خطا در اجرای حرکت هوش مصنوعی:', error);
        }
    }

    processEvaluation(message) {
        const scoreMatch = message.match(/score cp (-?\d+)/);
        if (scoreMatch) {
            const score = parseInt(scoreMatch[1]) / 100;
            this.updateEvaluation(score);
        }
    }

    processHint(message) {
        const pvMatch = message.match(/pv (\S+)/);
        if (pvMatch) {
            const bestMove = pvMatch[1];
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);
            
            // نمایش راهنمایی در Modal
            const hintModal = new bootstrap.Modal(document.getElementById('hintModal'));
            document.getElementById('hintText').textContent = 
                `پیشنهاد حرکت: از ${from} به ${to}`;
            hintModal.show();
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
            const className = move.flags.includes('c') || move.flags.includes('e') ? 
                'possible-capture' : 'possible-move';
            this.highlightSquare(move.to, className);
        });
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'possible-move', 'possible-capture', 'drag-over');
        });
    }

    updateMoveHistory() {
        this.moveHistoryElement.innerHTML = '';
        const moves = this.chess.history({ verbose: true });
        
        for (let i = 0; i < moves.length; i += 2) {
            const moveRow = document.createElement('div');
            moveRow.className = 'move-row d-flex justify-content-between align-items-center mb-1 p-2 border-bottom';
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'text-muted me-3';
            moveNumber.textContent = `${Math.floor(i/2) + 1}.`;
            
            const whiteMove = document.createElement('button');
            whiteMove.className = 'btn btn-sm btn-outline-primary me-2 flex-fill';
            whiteMove.textContent = moves[i].san;
            whiteMove.addEventListener('click', () => this.showMoveDetails(moves[i]));
            
            const blackMove = document.createElement('button');
            blackMove.className = 'btn btn-sm btn-outline-dark flex-fill';
            
            if (moves[i + 1]) {
                blackMove.textContent = moves[i + 1].san;
                blackMove.addEventListener('click', () => this.showMoveDetails(moves[i + 1]));
            } else {
                blackMove.textContent = '...';
                blackMove.disabled = true;
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
            this.gameStatusElement.textContent = this.getDrawReason();
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

    getDrawReason() {
        if (this.chess.isStalemate()) return 'پات! بازی مساوی شد.';
        if (this.chess.isThreefoldRepetition()) return 'تکرار سه‌باره حرکت! بازی مساوی شد.';
        if (this.chess.isInsufficientMaterial()) return 'ماده ناکافی! بازی مساوی شد.';
        return 'بازی مساوی شد!';
    }

    updateEvaluation(score) {
        let evaluationText = 'برابر';
        let evaluationClass = 'text-success';
        
        if (score > 2) {
            evaluationText = `امتیاز سفید: +${score.toFixed(1)}`;
            evaluationClass = 'text-primary';
        } else if (score < -2) {
            evaluationText = `امتیاز سیاه: +${Math.abs(score).toFixed(1)}`;
            evaluationClass = 'text-dark';
        } else if (score > 0.5) {
            evaluationText = `سفید بهتر: +${score.toFixed(1)}`;
            evaluationClass = 'text-info';
        } else if (score < -0.5) {
            evaluationText = `سیاه بهتر: +${Math.abs(score).toFixed(1)}`;
            evaluationClass = 'text-secondary';
        }
        
        this.evaluationElement.innerHTML = `<small class="${evaluationClass}">${evaluationText}</small>`;
    }

    getEvaluation() {
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        this.stockfish.postMessage('eval');
    }

    getHint() {
        if (!this.gameActive) return;
        
        this.stockfish.postMessage(`position fen ${this.chess.fen()}`);
        this.stockfish.postMessage('go depth 6');
        
        setTimeout(() => {
            this.stockfish.postMessage('stop');
        }, 1000);
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
        this.evaluationElement.innerHTML = '<small class="text-success">ارزیابی: برابر</small>';
        
        // اگر کاربر سیاه بازی می‌کند، هوش مصنوعی حرکت اول را انجام دهد
        if (!this.isPlayerWhite) {
            setTimeout(() => this.makeAIMove(), 1000);
        }
    }

    undoMove() {
        try {
            // حداقل دو حرکت برای پس‌گیری وجود دارد
            if (this.chess.history().length >= 2) {
                this.chess.undo();
                this.chess.undo();
                this.updatePieces();
                this.updateMoveHistory();
                this.updateGameStatus();
                this.getEvaluation();
            } else if (this.chess.history().length === 1) {
                this.chess.undo();
                this.updatePieces();
                this.updateMoveHistory();
                this.updateGameStatus();
            }
        } catch (error) {
            console.error('خطا در پس‌گیری حرکت:', error);
        }
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        this.drawBoard();
    }

    saveGame() {
        const gameData = {
            fen: this.chess.fen(),
            pgn: this.chess.pgn(),
            moves: this.chess.history(),
            timestamp: new Date().toISOString(),
            playerColor: this.isPlayerWhite ? 'white' : 'black'
        };
        
        const blob = new Blob([JSON.stringify(gameData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chess-game-${new Date().toISOString().split('T')[0]}.json`;
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
                    
                    if (gameData.fen) {
                        this.chess.load(gameData.fen);
                        if (gameData.playerColor) {
                            this.isPlayerWhite = gameData.playerColor === 'white';
                            document.getElementById('playerColor').value = gameData.playerColor;
                        }
                        
                        this.updatePieces();
                        this.updateMoveHistory();
                        this.updateGameStatus();
                        this.getEvaluation();
                    }
                } catch (error) {
                    alert('خطا در بارگذاری بازی! فایل معتبر نیست.');
                    console.error('Error loading game:', error);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    startTimer() {
        let whiteTime = 600; // 10 دقیقه
        let blackTime = 600;
        let timerInterval = null;
        
        const updateTimerDisplay = () => {
            document.getElementById('whiteTime').textContent = 
                `${Math.floor(whiteTime/60)}:${(whiteTime%60).toString().padStart(2, '0')}`;
            document.getElementById('blackTime').textContent = 
                `${Math.floor(blackTime/60)}:${(blackTime%60).toString().padStart(2, '0')}`;
        };
        
        const stopTimer = () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        };
        
        stopTimer(); // توقف تایمر قبلی
        
        timerInterval = setInterval(() => {
            if (!this.gameActive) {
                stopTimer();
                return;
            }
            
            if (this.chess.turn() === 'w') {
                whiteTime--;
            } else {
                blackTime--;
            }
            
            updateTimerDisplay();
            
            if (whiteTime <= 0) {
                stopTimer();
                this.gameStatusElement.className = 'alert alert-danger';
                this.gameStatusElement.textContent = 'وقت سفید تمام شد! سیاه برنده شد.';
                this.gameActive = false;
            } else if (blackTime <= 0) {
                stopTimer();
                this.gameStatusElement.className = 'alert alert-danger';
                this.gameStatusElement.textContent = 'وقت سیاه تمام شد! سفید برنده شد.';
                this.gameActive = false;
            }
        }, 1000);
        
        updateTimerDisplay();
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
}

// راه‌اندازی بازی وقتی صفحه لود شد
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGame();
});
