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
    const board={n,cells:Array(n*n).fill(""),pieces:[],score:0,lines:0,seed,hand:[{shape:0,color:"b"},{shape:1,color:"a"},{shape:2,color:"c"}]};
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
  function place(board,slot,r,c) {
    const piece=board.hand[slot];
    if (!fits(board,piece,r,c)) return null;
    const n=board.n, added=stamp(board,piece,r,c), cleared=new Set();
    let count=0;
    for (let k=0;k<n;k++) {
      const row=Array.from({length:n},(_,i)=>k*n+i);
      const col=Array.from({length:n},(_,i)=>i*n+k);
      for (const line of [row,col]) if (line.every(i=>board.cells[i])) {
        count++;
        for (const i of line) cleared.add(i);
      }
    }
    const hits=[];
    if (count) {
      for (const block of board.pieces) {
        const hit=block.indices.find(i=>cleared.has(i));
        if(hit===undefined)continue;
        hits.push({shape:block.shape,index:cleared.has(block.anchor)?block.anchor:hit});
        block.indices=block.indices.filter(i=>!cleared.has(i));
        if(cleared.has(block.anchor))block.anchor=block.indices[0]??null;
      }
      board.pieces=board.pieces.filter(block=>block.indices.length);
      for (const i of cleared) board.cells[i]="";
    }
    board.score+=added.length+10*count;
    board.lines+=count;
    board.hand[slot]=null;
    if (board.hand.every(p=>!p)) {
      board.hand=Array.from({length:3},()=>({shape:draw(board,shapes.length),color:colors[draw(board,colors.length)]}));
      if (board.hand.every(p=>spot(board,p)<0)) board.hand[0].shape=3;
    }
    return {count,added,cleared:[...cleared],hits};
  }
  return {shapes,shapeSizes,colors,fresh,fits,placementAnchor,spot,place};
})();
