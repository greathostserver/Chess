// Simple chess logic + basic AI minimax
const PIECES = {
  r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',
  R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'
};
let board = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
];
let selected = null;

function draw(){
  const b=document.getElementById("board");
  b.innerHTML="";
  for(let i=0;i<8;i++){
    for(let j=0;j<8;j++){
      let sq=document.createElement("div");
      sq.className="square "+((i+j)%2?"black":"white");
      sq.dataset.i=i; sq.dataset.j=j;
      sq.textContent=PIECES[board[i][j]]||"";
      sq.onclick=()=>clickSquare(i,j);
      b.appendChild(sq);
    }
  }
}
function clickSquare(i,j){
  if(selected){
    board[j][i]; 
    move(selected.i,selected.j,i,j);
    selected=null;
    draw();
    setTimeout(aiMove,200);
  } else {
    if(board[i][j]) selected={i,j};
  }
}
function move(i1,j1,i2,j2){
  board[i2][j2]=board[i1][j1];
  board[i1][j1]="";
}
function aiMove(){
  // random AI for now placeholder
  let moves=[];
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    if(board[i][j] && board[i][j]===board[i][j].toLowerCase()){
      // try simple forward move
      let ni=i+1;
      if(ni<8 && board[ni][j]=="") moves.push([i,j,ni,j]);
    }
  }
  if(moves.length){
    let m=moves[Math.floor(Math.random()*moves.length)];
    move(m[0],m[1],m[2],m[3]);
    draw();
  }
}
draw();
