(() => {
  const map = document.querySelector('.map');
  const canvas = document.createElement('canvas');
  canvas.className = 'orbit-canvas';
  canvas.setAttribute('aria-label', '可拖曳旋轉的立體工程基地模型');
  map.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const labels = [...map.querySelectorAll('.station')];
  const camera = { yaw: -0.55, pitch: 0.94, zoom: 1 };
  const defaultCamera = { ...camera };
  const colors = {
    quality: ['#e9af92', '#bd725e', '#f3d1ad'],
    safety: ['#e5c58b', '#c48e58', '#f8dfa8'],
    progress: ['#b8ddd8', '#6ea7a7', '#eff2db'],
    docs: ['#c4b8db', '#8774ae', '#eee4df'],
    handover: ['#dce9dc', '#82b5aa', '#f4f3df']
  };
  const buildings = [
    { id:'quality', x:-315, z:64, w:134, d:110, h:116, windows:false, color:colors.quality },
    { id:'safety', x:-174, z:-169, w:112, d:96, h:78, windows:true, color:colors.safety },
    { id:'progress', x:80, z:-135, w:142, d:125, h:255, windows:true, color:colors.progress },
    { id:'docs', x:-100, z:131, w:144, d:103, h:85, windows:true, color:colors.docs },
    { id:'handover', x:238, z:100, w:128, d:116, h:204, windows:true, color:colors.handover }
  ];
  const anchors = {
    quality: [-255, 105, 135], safety: [-115, -125, 98],
    progress: [150, -80, 275], docs: [-25, 170, 105],
    handover: [301, 147, 222]
  };
  let width = 0, height = 0, pixelRatio = 1;
  let dragging = false, previous = null, frame = 0;

  function project([x, z, y = 0]) {
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const rx = x * cy - z * sy;
    const rz = x * sy + z * cy;
    const depth = rz * cp + y * sp;
    const factor = (1000 / (1000 - depth * .44)) * camera.zoom * Math.min((width - 28) / 930, (height - 55) / 640, 1.35);
    return { x: width / 2 + rx * factor, y: height * .57 + (rz * sp - y * cp) * factor, depth };
  }
  function polygon(points, fill, stroke = null, lineWidth = 1) {
    const p = points.map(project);
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(points, color, thickness = 2, dash = []) {
    const p = points.map(project); ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y);
    for (let i=1;i<p.length;i++) ctx.lineTo(p[i].x,p[i].y);
    ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  function boxFaces(b) {
    const {x,z,w,d,h,color}=b, x2=x+w, z2=z+d;
    return [
      {v:[[x,z,0],[x2,z,0],[x2,z,h],[x,z,h]], fill:color[1], detail:'wall'},
      {v:[[x2,z,0],[x2,z2,0],[x2,z2,h],[x2,z,h]],fill:color[0],detail:'wall'},
      {v:[[x2,z2,0],[x,z2,0],[x,z2,h],[x2,z2,h]],fill:color[0],detail:'wall'},
      {v:[[x,z2,0],[x,z,0],[x,z,h],[x,z2,h]],fill:color[1],detail:'wall'},
      {v:[[x,z,h],[x2,z,h],[x2,z2,h],[x,z2,h]],fill:color[2],detail:'roof'}
    ].map(f=>({...f,building:b,depth:f.v.reduce((sum,v)=>sum+project(v).depth,0)/4}));
  }
  function mix(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t)}
  function drawWindows(face) {
    const [a,b,c,d]=face.v, rows=Math.max(1,Math.floor(face.building.h/36));
    const cols=Math.max(2,Math.floor(Math.hypot(b[0]-a[0],b[1]-a[1])/30));
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const u1=(col+.24)/cols,u2=(col+.77)/cols;
      const v1=(row+.24)/rows,v2=(row+.72)/rows;
      const point=(u,v)=>mix(mix(a,b,u),mix(d,c,u),v);
      polygon([point(u1,v1),point(u2,v1),point(u2,v2),point(u1,v2)],row%3===0?'#d8f4e5':'#8ac3c9','#ecf8e9',.5);
    }
  }
  function drawGround() {
    polygon([[-440,-285,-30],[440,-285,-30],[440,285,-30],[-440,285,-30]],'#357784');
    polygon([[-440,285,-30],[440,285,-30],[440,285,0],[-440,285,0]],'#276775');
    polygon([[440,-285,-30],[440,285,-30],[440,285,0],[440,-285,0]],'#2e7280');
    polygon([[-440,-285,0],[440,-285,0],[440,285,0],[-440,285,0]],'#a7cfa6','#ecf4d5',4);
    // Roads are level with the platform and pass between all five zones.
    polygon([[-405,-29,1],[395,-29,1],[395,17,1],[-405,17,1]],'#e5d7b5');
    polygon([[-28,-249,1],[20,-249,1],[20,248,1],[-28,248,1]],'#e5d7b5');
    line([[-405,-6,2],[395,-6,2]],'#fff7dd',2,[10,13]);
    line([[-4,-248,2],[-4,248,2]],'#fff7dd',2,[10,13]);
    for(const b of buildings) polygon([[b.x-10,b.z-10,2],[b.x+b.w+10,b.z-10,2],[b.x+b.w+10,b.z+b.d+10,2],[b.x-10,b.z+b.d+10,2]],'#e8d0aa','#f9e8c7',2);
    for(const [x,z] of [[-395,-220],[-355,-220],[-270,-225],[-380,225],[100,210],[190,225],[395,-208],[397,10]]){
      const p=project([x,z,0]);ctx.beginPath();ctx.ellipse(p.x,p.y+3,10,4,0,0,Math.PI*2);ctx.fillStyle='#39786955';ctx.fill();
      line([[x,z,0],[x,z,25]],'#6b805a',3);const crown=project([x,z,34]);ctx.beginPath();ctx.arc(crown.x,crown.y,Math.max(5,8*camera.zoom),0,Math.PI*2);ctx.fillStyle='#4f9d78';ctx.fill();
    }
  }
  function drawStructure() {
    const b=buildings[0], x=b.x,z=b.z,w=b.w,d=b.d,h=b.h;
    for(const level of [30,65,100]){
      polygon([[x,z,level],[x+w,z,level],[x+w,z+d,level],[x,z+d,level]],'#d7a388','#f8d8a9',2);
    }
    for(const xx of [x,x+w])for(const zz of [z,z+d])line([[xx,zz,0],[xx,zz,h+25]],'#875b52',5);
    for(const level of [15,45,80,115]){
      line([[x,z+d,level],[x+w,z+d,level]],'#a76355',3);
      line([[x+w,z,level],[x+w,z+d,level]],'#a76355',3);
    }
    for(let i=0;i<6;i++)line([[x+8+i*21,z+9,h+2],[x+8+i*21,z+9,h+21]],'#a76651',2);
  }
  function drawCrane(){
    const x=-45,z=-186;
    line([[x,z,0],[x,z,285]],'#bc8052',6);
    for(let y=25;y<285;y+=25){line([[x-12,z,y],[x+12,z,y]],'#d8a458',3);line([[x-12,z,y],[x+12,z,y+25]],'#d8a458',2)}
    line([[x-130,z,277],[x+195,z,277]],'#dcaa59',7);
    line([[x,z,310],[x-130,z,277]],'#f5d790',2);
    line([[x,z,310],[x+195,z,277]],'#f5d790',2);
    line([[x+153,z,277],[x+153,z,177]],'#8d7555',2);
    polygon([[x+139,z-10,177],[x+167,z-10,177],[x+167,z+10,177],[x+139,z+10,177]],'#e89160');
  }
  function draw() {
    if(!width||!height)return;
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,width,height);
    drawGround();
    const faces=buildings.slice(1).flatMap(boxFaces).sort((a,b)=>a.depth-b.depth);
    for(const face of faces){polygon(face.v,face.fill,'#f8f4dc',1.4);if(face.detail==='wall'&&face.building.windows)drawWindows(face);
      if(face.detail==='roof'){
        const b=face.building;
        polygon([[b.x+15,b.z+15,b.h+2],[b.x+b.w-15,b.z+15,b.h+2],[b.x+b.w-15,b.z+b.d-15,b.h+2],[b.x+15,b.z+b.d-15,b.h+2]],'#f8f2d8','#b5c8b4',1);
      }
    }
    drawStructure();drawCrane();
    for(const label of labels){const p=project(anchors[label.dataset.island]);label.style.left=`${Math.max(65,Math.min(width-65,p.x))}px`;label.style.top=`${Math.max(48,Math.min(height-30,p.y))}px`;}
  }
  function requestDraw(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;draw()})}
  function resize(){const r=map.getBoundingClientRect();width=r.width;height=r.height;pixelRatio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);requestDraw()}
  new ResizeObserver(resize).observe(map);resize();
  map.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;dragging=true;previous=[e.clientX,e.clientY];map.classList.add('dragging');map.setPointerCapture(e.pointerId)});
  map.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-previous[0],dy=e.clientY-previous[1];previous=[e.clientX,e.clientY];camera.yaw+=dx*.008;camera.pitch=Math.max(.28,Math.min(1.35,camera.pitch-dy*.006));requestDraw()});
  const stop=()=>{dragging=false;previous=null;map.classList.remove('dragging')};map.addEventListener('pointerup',stop);map.addEventListener('pointercancel',stop);
  map.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.7,Math.min(1.5,camera.zoom+(e.deltaY<0?.07:-.07)));requestDraw()},{passive:false});
  const hint=document.createElement('div');hint.className='orbit-hint';hint.textContent='拖曳旋轉視角 · 滾輪縮放';map.append(hint);
  const controls=document.createElement('div');controls.className='orbit-controls';
  controls.innerHTML='<button type="button" aria-label="向左旋轉">↶</button><button type="button" aria-label="向右旋轉">↷</button><button type="button" aria-label="重設視角">⌖</button>';
  map.append(controls);
  controls.children[0].onclick=()=>{camera.yaw-=Math.PI/6;requestDraw()};
  controls.children[1].onclick=()=>{camera.yaw+=Math.PI/6;requestDraw()};
  controls.children[2].onclick=()=>{Object.assign(camera,defaultCamera);requestDraw()};
  document.querySelector('#resetBtn').onclick=()=>{Object.assign(camera,defaultCamera);requestDraw();map.scrollIntoView({behavior:'smooth'})};
  document.querySelector('.board-sub').textContent='拖曳或用手指旋轉工程基地，點選建築站點探索監造工作';
  document.querySelector('.board-foot div:first-child').textContent='示意模型 · 可旋轉視角與縮放';
})();

