class ChessBoard {
    constructor() {
        this.chess = new Chess();
        this.boardElement = document.getElementById('chessboard');
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.boardFlipped = false;
    }

    init() {
        this.drawBoard();
        this.updatePieces();
    }

    drawBoard() {
        console.log('Drawing chess board...');
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
                const squareName = files[fileIndex] + ranks[rankIndex];
                square.dataset.square = squareName;
                
                // مختصات
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
                
                square.addEventListener('click', () => this.handleSquareClick(squareName));
                row.appendChild(square);
            }
            
            this.boardElement.appendChild(row);
        }
    }

    handleSquareClick(square) {
        console.log('Square clicked:', square);
        const piece = this.chess.get(square);
        
        // اگر مربعی انتخاب شده بود
        if (this.selectedSquare && this.selectedSquare !== square) {
            const move = this.tryMove(this.selectedSquare, square);
            if (move) {
                if (typeof window.chessGame.handleMove === 'function') {
                    window.chessGame.handleMove(move);
                }
                return;
            }
        }
        
        // اگر روی مهره خودی کلیک شد
        if (piece && this.isPlayerPiece(piece)) {
            this.selectedSquare = square;
            this.possibleMoves = this.chess.moves({
                square: square,
                verbose: true
            });
            
            this.clearHighlights();
            this.highlightSquare(square, 'selected');
            this.highlightPossibleMoves();
        } else {
            this.clearSelection();
        }
    }

    tryMove(from, to) {
        const moves = this.chess.moves({ verbose: true });
        return moves.find(move => move.from === from && move.to === to);
    }

    executeMove(move) {
        const result = this.chess.move(move);
        if (result) {
            this.clearSelection();
            this.updatePieces();
            return result;
        }
        return null;
    }

    updatePieces() {
        // پاک کردن مهره‌های قبلی
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
        
        // اضافه کردن مهره‌های جدید
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
                        squareElement.appendChild(pieceElement);
                    }
                }
            }
        }
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

    highlightSquare(square, className) {
        const element = this.getSquareElement(square);
        if (element) element.classList.add(className);
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

    clearSelection() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.clearHighlights();
    }

    isPlayerPiece(piece) {
        // فرض می‌کنیم همیشه نوبت بازیکن است (برای تست)
        return true;
    }

    flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        this.drawBoard();
        this.updatePieces();
    }

    resetBoard() {
        this.chess.reset();
        this.clearSelection();
        this.updatePieces();
    }

    getGameState() {
        return {
            fen: this.chess.fen(),
            isCheck: this.chess.isCheck(),
            isCheckmate: this.chess.isCheckmate(),
            isDraw: this.chess.isDraw(),
            turn: this.chess.turn()
        };
    }
}
