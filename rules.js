"use strict";
const Puzzle = (() => {
  const shapes = [
    ["가로 두 칸", [[0,0],[0,1]]],
    ["작은 니은", [[0,0],[1,0],[1,1]]],
    ["세로 세 칸", [[0,0],[1,0],[2,0]]],
    ["한 칸", [[0,0]]],
    ["가로 세 칸", [[0,0],[0,1],[0,2]]],
    ["세로 두 칸", [[0,0],[1,0]]],
    ["작은 네모", [[0,0],[0,1],[1,0],[1,1]]],
    ["기역 모양", [[0,0],[0,1],[1,1]]]
  ];
  const shapeSizes = shapes.map(([,cells]) => ({
    width: 1 + Math.max(...cells.map(([,dx]) => dx)),
    height: 1 + Math.max(...cells.map(([dy]) => dy))
  }));
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
    board.pieces.push({shape:piece.shape,anchor:indices[0],indices});
    return indices;
  }
  function fits(board,piece,r,c) {
    return !!piece && shapes[piece.shape][1].every(([dy,dx]) => {
      const y=r+dy,x=c+dx;
      return y>=0 && x>=0 && y<board.n && x<board.n && !board.cells[y*board.n+x];
    });
  }
  // Aim coordinates use cell centers: (0, 0) is the center of the first cell.
  function placementAnchor(board,piece,aimRow,aimCol) {
    if (!piece) return -1;
    const {height,width}=shapeSizes[piece.shape];
    const lastRow=board.n-height, lastCol=board.n-width;
    const row=Math.max(0,Math.min(lastRow,Math.round(aimRow)));
    const col=Math.max(0,Math.min(lastCol,Math.round(aimCol)));
    const anchor=row*board.n+col;
    if (fits(board,piece,row,col)) return anchor;

    // A blocked anchor may shift one cell in either direction. Keep an invalid
    // preview at the original in-bounds anchor if all of its neighbors are blocked.
    let best=anchor, bestDistance=Infinity, bestCoversTarget=false;
    const targetRow=Math.round(aimRow), targetCol=Math.round(aimCol);
    for (let r=Math.max(0,row-1);r<=Math.min(lastRow,row+1);r++) {
      for (let c=Math.max(0,col-1);c<=Math.min(lastCol,col+1);c++) {
        const distance=(r-aimRow)**2+(c-aimCol)**2;
        if (distance>bestDistance || !fits(board,piece,r,c)) continue;
        const coversTarget=shapes[piece.shape][1].some(([dy,dx]) => r+dy===targetRow && c+dx===targetCol);
        if (distance<bestDistance || (coversTarget && !bestCoversTarget)) {
          best=r*board.n+c;
          bestDistance=distance;
          bestCoversTarget=coversTarget;
        }
      }
    }
    return best;
  }
  function spot(board,piece) {
    for (let i=0;i<board.cells.length;i++) if (fits(board,piece,Math.floor(i/board.n),i%board.n)) return i;
    return -1;
  }
  function draw(board, limit) {
    board.seed=(Math.imul(board.seed,1664525)+1013904223)>>>0;
    return Math.floor(board.seed/4294967296*limit);
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
      board.hand=Array.from({length:3},()=>({shape:draw(board,shapes.length),color:colors[draw(board,colors.length)]}));
      if (board.hand.every(p=>spot(board,p)<0)) board.hand[0].shape=3;
    }
    return {count,rows,cols,added,clearedCells,gained,streak:board.streak};
  }
  return {shapes,shapeSizes,colors,fresh,fits,placementAnchor,spot,wouldClear,place};
})();
