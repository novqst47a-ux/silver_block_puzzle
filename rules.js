"use strict";
const Puzzle = (() => {
  // Base shape indices are also the keys used in saved games and photo albums.
  const baseShapes = [
    ["가로 두 칸", [[0,0],[0,1]]],
    ["작은 니은", [[0,0],[1,0],[1,1]]],
    ["세로 세 칸", [[0,0],[1,0],[2,0]]],
    ["한 칸", [[0,0]]],
    ["가로 세 칸", [[0,0],[0,1],[0,2]]],
    ["세로 두 칸", [[0,0],[1,0]]],
    ["작은 네모", [[0,0],[0,1],[1,0],[1,1]]],
    ["기역 모양", [[0,0],[0,1],[1,1]]]
  ];
  function square(side) {
    return Array.from({length:side*side},(_,i)=>[Math.floor(i/side),i%side]);
  }
  // Each larger shape names the base shape whose photo it uses.
  const shapes = [
    ...baseShapes,
    ["3×3 네모", square(3), 6],
    ["4×4 네모", square(4), 6],
    ["2×3 니은", [[0,0],[1,0],[2,0],[2,1]], 1],
    ["2×4 니은", [[0,0],[1,0],[2,0],[3,0],[3,1]], 1],
    ["2×3 기역", [[0,0],[0,1],[1,1],[2,1]], 7],
    ["2×4 기역", [[0,0],[0,1],[1,1],[2,1],[3,1]], 7]
  ];
  const shapeSizes = shapes.map(([,cells]) => ({
    width: 1 + Math.max(...cells.map(([,dx]) => dx)),
    height: 1 + Math.max(...cells.map(([dy]) => dy))
  }));
  // Choose an occupied cell nearest the shape's centroid. On a tie use the later cell.
  const shapeAnchors=shapes.map(([,cells])=>{
    const sumRow=cells.reduce((sum,[r])=>sum+r,0);
    const sumCol=cells.reduce((sum,[,c])=>sum+c,0);
    const distance=([r,c])=>(r*cells.length-sumRow)**2+(c*cells.length-sumCol)**2;
    return cells.reduce((best,cell)=>distance(cell)<=distance(best)?cell:best);
  });
  const colors = ["a","b","c","d","e"];
  function fresh(n, seed) {
    const board={n,cells:Array(n*n).fill(""),pieces:[],score:0,lines:0,streak:0,seed,hand:[{shape:0,color:"b"},{shape:1,color:"a"},{shape:2,color:"c"}]};
    const layout=[[7,"d",n-5,1],[5,"c",n-5,n-3],[5,"b",n-4,n-4],
      [6,"a",n-3,0],[4,"e",n-1,0],[4,"b",n-2,2],[5,"d",n-2,n-3]];
    for(let col=5;col<n-3;col+=2)layout.push([0,"c",n-2,col]);
    for(const [shape,color,r,c] of layout)stamp(board,{shape,color},r,c);
    return board;
  }
  function stamp(board,piece,r,c) {
    const indices=shapes[piece.shape][1].map(([dy,dx])=>(r+dy)*board.n+c+dx);
    for(const i of indices)board.cells[i]=piece.color;
    // Older saves have colors but no piece boundaries.
    board.pieces ??= [];
    const [dy,dx]=shapeAnchors[piece.shape];
    board.pieces.push({shape:piece.shape,anchor:(r+dy)*board.n+c+dx,indices});
    return indices;
  }
  function fits(board,piece,r,c) {
    return !!piece && shapes[piece.shape][1].every(([dy,dx]) => {
      const y=r+dy,x=c+dx;
      return y>=0 && x>=0 && y<board.n && x<board.n && !board.cells[y*board.n+x];
    });
  }
  function spot(board,piece) {
    for (let i=0;i<board.cells.length;i++) if (fits(board,piece,Math.floor(i/board.n),i%board.n)) return i;
    return -1;
  }
  function draw(board, limit) {
    board.seed=(Math.imul(board.seed,1664525)+1013904223)>>>0;
    return Math.floor(board.seed/4294967296*limit);
  }
  function dealHand(board) {
    const emptyCount=board.cells.filter(cell=>!cell).length;
    const candidates=[];
    shapes.forEach(([,cells],shape)=>{
      if (shape<baseShapes.length || (cells.length<=emptyCount && spot(board,{shape})>=0)) {
        candidates.push(shape);
      }
    });
    return Array.from({length:3},()=>({
      shape:candidates[draw(board,candidates.length)],
      color:colors[draw(board,colors.length)]
    }));
  }
  function lineBonus(count) {
    if (count<=0) return 0;
    if (count===1) return 10;
    if (count===2) return 30;
    return 60+(count-3)*30;
  }
  function fullLines(cells,n) {
    const rows=[], cols=[], cleared=new Set();
    for (let k=0;k<n;k++) {
      const row=Array.from({length:n},(_,i)=>k*n+i);
      const col=Array.from({length:n},(_,i)=>i*n+k);
      if (row.every(i=>cells[i])) {rows.push(k);row.forEach(i=>cleared.add(i));}
      if (col.every(i=>cells[i])) {cols.push(k);col.forEach(i=>cleared.add(i));}
    }
    return {rows,cols,cleared};
  }
  // Cells that placing the piece at (r, c) would clear, for the gold line preview.
  function wouldClear(board,piece,r,c) {
    if (!fits(board,piece,r,c)) return [];
    const cells=board.cells.slice();
    for (const [dy,dx] of shapes[piece.shape][1]) cells[(r+dy)*board.n+c+dx]=piece.color;
    return [...fullLines(cells,board.n).cleared];
  }
  function place(board,slot,r,c) {
    const piece=board.hand[slot];
    if (!fits(board,piece,r,c)) return null;
    const added=stamp(board,piece,r,c);
    const {rows,cols,cleared}=fullLines(board.cells,board.n);
    const count=rows.length+cols.length;
    // Read colors before emptying the cells so the effect can replay the cleared tiles.
    const clearedCells=[...cleared].map(index=>({index,color:board.cells[index]}));
    if (count) {
      for (const block of board.pieces) {
        if(!block.indices.some(i=>cleared.has(i)))continue;
        block.indices=block.indices.filter(i=>!cleared.has(i));
        if(cleared.has(block.anchor))block.anchor=block.indices[0]??null;
      }
      board.pieces=board.pieces.filter(block=>block.indices.length);
      for (const i of cleared) board.cells[i]="";
    }
    // Saves from before streaks have no counter, which reads as zero here.
    board.streak=count?(board.streak||0)+1:0;
    const streakBonus=board.streak>=2?(board.streak-1)*5:0;
    const gained=added.length+lineBonus(count)+streakBonus;
    board.score+=gained;
    board.lines+=count;
    board.hand[slot]=null;
    if (board.hand.every(p=>!p)) {
      board.hand=dealHand(board);
    }
    return {count,rows,cols,added,clearedCells,gained,streak:board.streak};
  }
  return {baseShapes,shapes,shapeSizes,shapeAnchors,colors,fresh,fits,spot,wouldClear,place};
})();
