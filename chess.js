class ChessBoard {
    constructor() {
        this.chess = new Chess();
        this.boardElement = document.getElementById('chessboard');
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.boardFlipped = false;
        this.draggedPiece = null;
    }

    init() {
        this.drawBoard();
        this.setupEventListeners();
        this.updatePieces();
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
                
                this.addCoordinates(square, rankIndex, fileIndex, files, ranks);
                square.addEventListener('click', (e) => this.handleSquareClick(e));
                row.appendChild(square);
            }
            
            this.boardElement.appendChild(row);
        }
    }

    addCoordinates(square, rankIndex, fileIndex, files, ranks) {
        // اضافه کردن مختصات فایل (حروف)
        if (rankIndex === 7) {
            const fileCoord = document.createElement('div');
            fileCoord.className = 'coordinates coord-file';
            fileCoord.textContent = files[fileIndex];
            square.appendChild(fileCoord);
        }
        
        // اضافه کردن مختصات رنک (اعداد)
        if (fileIndex === 0) {
            const rankCoord = document.createElement('div');
            rankCoord.className = 'coordinates coord-rank';
            rankCoord.textContent = ranks[rankIndex];
            square.appendChild(rankCoord);
        }
    }

    setupEventListeners() {
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        this.boardElement.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.boardElement.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.boardElement.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.boardElement.addEventListener('drop', (e) => this.handleDrop(e));
        this.boardElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
    }

    handleDragStart(e) {
        if (!e.target.classList.contains('piece')) return;
        
        const square = e.target.parentElement.dataset.square;
        const piece = this.chess.get(square);
        
        if (piece && this.isPlayerPiece(piece)) {
            this.draggedPiece = square;
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', square);
            this.handleSquareSelection(square);
        } else {
            e.preventDefault();
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        if (e.target.classList.contains('square')) {
            e.target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        e.target.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        if (e.target.classList.contains('square') && this.draggedPiece) {
            const fromSquare = this.draggedPiece;
            const toSquare = e.target.dataset.square;
            
            this.draggedPiece = null;
            this.handleMove(fromSquare, toSquare);
        }
        
        this.clearDragState();
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.clearDragState();
    }

    clearDragState() {
        document.querySelectorAll('.square.drag-over, .piece.dragging').forEach(el => {
            el.classList.remove('drag-over', 'dragging');
        });
    }

    handleSquareClick(e) {
        const square = e.currentTarget.dataset.square;
        const piece = this.chess.get(square);
        
        if (this.selectedSquare && this.selectedSquare !== square) {
            this.handleMove(this.selectedSquare, square);
            return;
        }
        
        if (piece && this.isPlayerPiece(piece)) {
            this.handleSquareSelection(square);
        } else {
            this.clearSelection();
        }
    }

    handleSquareSelection(square) {
        this.selectedSquare = square;
        this.possibleMoves = this.chess.moves({
            square: square,
            verbose: true
        });
        
        this.clearHighlights();
        this.highlightSquare(square, 'selected');
        this.highlightPossibleMoves();
    }

    handleMove(from, to) {
        const move = this.validateMove(from, to);
        if (move) {
            this.executeMove(move);
        }
    }

    validateMove(from, to) {
        const possibleMoves = this.chess.moves({ square: from, verbose: true });
        return possibleMoves.find(move => move.from === from && move.to === to);
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
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = String.fromCharCode(97 + file) + (8 - rank);
                const piece = this.chess.get(square);
                
                if (piece) {
                    this.createPieceElement(square, piece);
                }
            }
        }
        
        this.highlightPossibleMoves();
    }

    createPieceElement(square, piece) {
        const squareElement = this.getSquareElement(square);
        if (!squareElement) return;
        
        const pieceElement = document.createElement('div');
        pieceElement.className = `piece ${piece.color}`;
        pieceElement.textContent = this.getPieceSymbol(piece.type, piece.color);
        pieceElement.draggable = true;
        squareElement.appendChild(pieceElement);
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
            square.classList.remove('selected', 'possible-move', 'possible-capture');
        });
    }

    clearSelection() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.clearHighlights();
    }

    isPlayerPiece(piece) {
        const isWhiteTurn = this.chess.turn() === 'w';
        return (piece.color === 'w' && isWhiteTurn) || (piece.color === 'b' && !isWhiteTurn);
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
            pgn: this.chess.pgn(),
            history: this.chess.history({ verbose: true }),
            isCheck: this.chess.isCheck(),
            isCheckmate: this.chess.isCheckmate(),
            isDraw: this.chess.isDraw(),
            isStalemate: this.chess.isStalemate(),
            turn: this.chess.turn()
        };
    }

    loadGame(fen) {
        this.chess.load(fen);
        this.updatePieces();
        this.clearSelection();
    }
}
