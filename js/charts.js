/* ============================================================
   charts.js — Charts engine + mkChartWrap
============================================================ */

const Charts = {
  // Resolve a CSS variable to an actual color
  cssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||name;
  },

  // Make a canvas the right pixel density
  setupCanvas(canvas, h){
    const dpr = window.devicePixelRatio||1;
    const W = canvas.parentElement.clientWidth||300;
    const H = h||160;
    canvas.width  = W*dpr;
    canvas.height = H*dpr;
    canvas.style.width  = W+'px';
    canvas.style.height = H+'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr,dpr);
    return {ctx, W, H};
  },

  // Draw a padded, labelled line chart
  // data: [{label, values:[{x:dateStr, y:num}]}]
  lineChart(canvas, series, opts={}){
    const h   = opts.height||160;
    const {ctx,W,H} = Charts.setupCanvas(canvas,h);
    const pad = {top:14,right:16,bottom:32,left:42};
    const cW = W-pad.left-pad.right;
    const cH = H-pad.top-pad.bottom;

    // Flatten all y values
    const allY = series.flatMap(s=>s.values.map(p=>p.y)).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    if(!allY.length){
      ctx.fillStyle = Charts.cssVar('--muted');
      ctx.font = '12px '+Charts.cssVar('--font');
      ctx.textAlign='center';
      ctx.fillText('Pas encore de données',W/2,H/2);
      return;
    }
    const yMin = opts.yMin!==undefined?opts.yMin:Math.min(...allY);
    const yMax = opts.yMax!==undefined?opts.yMax:Math.max(...allY);
    const yRange = yMax-yMin||1;

    // All x labels (dates)
    const allX = [...new Set(series.flatMap(s=>s.values.map(p=>p.x)))].sort();
    const n = allX.length;

    const xPos = (xi)=> pad.left + (n<2?cW/2:xi/(n-1)*cW);
    const yPos = (y)=>  pad.top  + (1-(y-yMin)/yRange)*cH;

    // Grid lines
    ctx.strokeStyle = Charts.cssVar('--border');
    ctx.lineWidth = 0.5;
    const ticks = 4;
    for(let i=0;i<=ticks;i++){
      const y = pad.top + (i/ticks)*cH;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      const val = yMax - (i/ticks)*yRange;
      ctx.fillStyle = Charts.cssVar('--muted');
      ctx.font = `9px ${Charts.cssVar('--mono')}`;
      ctx.textAlign = 'right';
      ctx.fillText(opts.yFmt?opts.yFmt(val):Math.round(val), pad.left-4, y+3);
    }

    // Objective line
    if(opts.goal!==undefined){
      const gy = yPos(opts.goal);
      ctx.save();
      ctx.strokeStyle = Charts.cssVar('--orange');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6,3]);
      ctx.beginPath(); ctx.moveTo(pad.left,gy); ctx.lineTo(W-pad.right,gy); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = Charts.cssVar('--orange');
      ctx.font = `9px ${Charts.cssVar('--mono')}`;
      ctx.textAlign = 'left';
      ctx.fillText('Obj.',W-pad.right+2,gy+3);
    }

    const COLORS = ['--teal','--green','--orange','--red','--purple'];
    series.forEach((s,si)=>{
      const color = Charts.cssVar(s.color||COLORS[si%COLORS.length]);
      const pts = s.values.filter(p=>p.y!==null&&!isNaN(p.y));
      if(!pts.length) return;

      // Fill gradient
      if(opts.fill!==false){
        const grd = ctx.createLinearGradient(0,pad.top,0,H-pad.bottom);
        grd.addColorStop(0,color+'33');
        grd.addColorStop(1,color+'00');
        ctx.beginPath();
        pts.forEach((p,i)=>{
          const xi = allX.indexOf(p.x);
          const x=xPos(xi), y=yPos(p.y);
          i===0?ctx.moveTo(x,H-pad.bottom):null;
          i===0?ctx.lineTo(x,y):ctx.lineTo(x,y);
        });
        ctx.lineTo(xPos(allX.indexOf(pts[pts.length-1].x)), H-pad.bottom);
        ctx.closePath();
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      pts.forEach((p,i)=>{
        const xi = allX.indexOf(p.x);
        const x=xPos(xi), y=yPos(p.y);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.stroke();

      // Dots
      pts.forEach(p=>{
        const xi = allX.indexOf(p.x);
        const x=xPos(xi), y=yPos(p.y);
        ctx.beginPath();
        ctx.arc(x,y,3.5,0,Math.PI*2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = Charts.cssVar('--surface');
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

    // X labels (sample)
    ctx.fillStyle = Charts.cssVar('--muted');
    ctx.font = `9px ${Charts.cssVar('--mono')}`;
    ctx.textAlign = 'center';
    const step = Math.max(1,Math.floor(n/6));
    allX.forEach((x,i)=>{
      if(i%step!==0&&i!==n-1) return;
      const px = xPos(i);
      const lbl = opts.xFmt?opts.xFmt(x):x.slice(5); // MM-DD
      ctx.fillText(lbl, px, H-pad.bottom+12);
    });

    // Tooltip (interactive)
    if(!canvas._chartListenerAdded){
      canvas._chartListenerAdded=true;
      let tip = null;
      canvas.addEventListener('mousemove',(e)=>{
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX-rect.left;
        let closestX=null, closestDist=999;
        allX.forEach((x,i)=>{
          const d=Math.abs(xPos(i)-mx);
          if(d<closestDist){closestDist=d;closestX={i,x};}
        });
        if(closestX&&closestDist<25){
          if(!tip){tip=document.createElement('div');tip.className='chart-tooltip';document.body.appendChild(tip);}
          const vals = series.map(s=>{
            const p=s.values.find(v=>v.x===closestX.x);
            return p?`${s.label}: ${opts.yFmt?opts.yFmt(p.y):p.y}`:null;
          }).filter(Boolean).join('  ·  ');
          tip.textContent = `${closestX.x}  ${vals}`;
          tip.style.left = (e.clientX)+'px';
          tip.style.top  = (e.clientY)+'px';
          tip.style.display='block';
        }
      });
      canvas.addEventListener('mouseleave',()=>{if(tip)tip.style.display='none';});
      canvas.addEventListener('touchend',()=>{if(tip)tip.style.display='none';});
    }
  },

  // Bar chart
  // data: [{label, value, color?}]
  barChart(canvas, data, opts={}){
    const h = opts.height||140;
    const {ctx,W,H} = Charts.setupCanvas(canvas,h);
    const pad = {top:14,right:12,bottom:28,left:38};
    const cW = W-pad.left-pad.right;
    const cH = H-pad.top-pad.bottom;
    const vals = data.map(d=>d.value);
    const yMax = opts.yMax||Math.max(...vals,1);
    const barW = cW/data.length*0.65;
    const gap   = cW/data.length;

    // Grid
    ctx.strokeStyle=Charts.cssVar('--border'); ctx.lineWidth=0.5;
    [0,.25,.5,.75,1].forEach(t=>{
      const y=pad.top+t*cH;
      ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
      ctx.fillStyle=Charts.cssVar('--muted');
      ctx.font=`9px ${Charts.cssVar('--mono')}`;
      ctx.textAlign='right';
      const v=yMax*(1-t);
      ctx.fillText(opts.yFmt?opts.yFmt(v):Math.round(v),pad.left-3,y+3);
    });

    if(opts.goal){
      const gy=pad.top+(1-opts.goal/yMax)*cH;
      ctx.save();ctx.strokeStyle=Charts.cssVar('--orange');ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
      ctx.beginPath();ctx.moveTo(pad.left,gy);ctx.lineTo(W-pad.right,gy);ctx.stroke();ctx.restore();
    }

    const COLORS=['--teal','--green','--orange','--red','--purple'];
    data.forEach((d,i)=>{
      const color=Charts.cssVar(d.color||COLORS[i%COLORS.length]);
      const x=pad.left+i*gap+(gap-barW)/2;
      const bH=Math.max(1,(d.value/yMax)*cH);
      const y=pad.top+cH-bH;
      const r=4;
      // Rounded top
      ctx.beginPath();
      ctx.moveTo(x+r,y);ctx.lineTo(x+barW-r,y);
      ctx.quadraticCurveTo(x+barW,y,x+barW,y+r);
      ctx.lineTo(x+barW,pad.top+cH);ctx.lineTo(x,pad.top+cH);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();
      const grd=ctx.createLinearGradient(0,y,0,pad.top+cH);
      grd.addColorStop(0,color+'ee');grd.addColorStop(1,color+'88');
      ctx.fillStyle=grd;ctx.fill();
      // Label
      ctx.fillStyle=Charts.cssVar('--muted');
      ctx.font=`9px ${Charts.cssVar('--mono')}`;
      ctx.textAlign='center';
      const lbl=opts.xFmt?opts.xFmt(d.label):d.label;
      ctx.fillText(lbl,x+barW/2,H-pad.bottom+12);
      if(d.value>0){
        ctx.fillStyle=Charts.cssVar('--text');
        ctx.font=`bold 9px ${Charts.cssVar('--mono')}`;
        ctx.fillText(opts.yFmt?opts.yFmt(d.value):Math.round(d.value),x+barW/2,y-3);
      }
    });
  },

  // Radar chart (pentagon/hexagon)
  radarChart(canvas, axes, opts={}){
    const h=opts.height||160;
    const {ctx,W,H}=Charts.setupCanvas(canvas,h);
    const cx=W/2, cy=H/2, r=Math.min(cx,cy)-24;
    const n=axes.length;
    const angle=(i)=>(i/n)*Math.PI*2-Math.PI/2;
    const pt=(i,rr)=>({x:cx+Math.cos(angle(i))*rr, y:cy+Math.sin(angle(i))*rr});

    // Grid
    [.25,.5,.75,1].forEach(t=>{
      ctx.beginPath();
      axes.forEach((_,i)=>{const p=pt(i,r*t);i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});
      ctx.closePath();
      ctx.strokeStyle=Charts.cssVar('--border');ctx.lineWidth=0.5;ctx.stroke();
    });
    axes.forEach((_,i)=>{
      const p=pt(i,r);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(p.x,p.y);
      ctx.strokeStyle=Charts.cssVar('--border');ctx.lineWidth=0.5;ctx.stroke();
    });

    // Fill
    ctx.beginPath();
    axes.forEach((a,i)=>{const p=pt(i,r*Math.min(1,a.value/100));i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});
    ctx.closePath();
    ctx.fillStyle=Charts.cssVar('--teal')+'44';ctx.fill();
    ctx.strokeStyle=Charts.cssVar('--teal');ctx.lineWidth=2;ctx.stroke();

    // Dots + labels
    axes.forEach((a,i)=>{
      const p=pt(i,r*Math.min(1,a.value/100));
      ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);
      ctx.fillStyle=Charts.cssVar('--teal');ctx.fill();
      const lp=pt(i,r+16);
      ctx.fillStyle=Charts.cssVar('--text');
      ctx.font=`9px ${Charts.cssVar('--font')}`;
      ctx.textAlign='center';
      ctx.fillText(a.label,lp.x,lp.y);
      const sp=pt(i,r+26);
      ctx.fillStyle=Charts.cssVar('--muted');
      ctx.font=`8px ${Charts.cssVar('--mono')}`;
      ctx.fillText(Math.round(a.value)+'%',sp.x,sp.y);
    });
  },

  // Donut / ring chart
  donutChart(canvas, segments, opts={}){
    const h=opts.height||120;
    const {ctx,W,H}=Charts.setupCanvas(canvas,h);
    const cx=W/2,cy=H/2,r=Math.min(cx,cy)-10,inner=r*0.6;
    const total=segments.reduce((a,s)=>a+s.value,0)||1;
    let start=-Math.PI/2;
    segments.forEach(s=>{
      const sweep=(s.value/total)*Math.PI*2;
      ctx.beginPath();ctx.arc(cx,cy,r,start,start+sweep);ctx.arc(cx,cy,inner,start+sweep,start,true);
      ctx.closePath();ctx.fillStyle=Charts.cssVar(s.color||'--teal');ctx.fill();
      start+=sweep;
    });
    // Center label
    if(opts.center){
      ctx.fillStyle=Charts.cssVar('--text');
      ctx.font=`bold 14px ${Charts.cssVar('--mono')}`;
      ctx.textAlign='center';ctx.fillText(opts.center,cx,cy+5);
    }
  },

  // Scatter plot for correlation
  scatterChart(canvas, points, opts={}){
    const h=opts.height||140;
    const {ctx,W,H}=Charts.setupCanvas(canvas,h);
    const pad={top:12,right:16,bottom:28,left:40};
    const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom;
    if(!points.length){
      ctx.fillStyle=Charts.cssVar('--muted');ctx.font='11px sans-serif';ctx.textAlign='center';
      ctx.fillText('Pas encore de données',W/2,H/2);return;
    }
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    const xMin=Math.min(...xs),xMax=Math.max(...xs)||1;
    const yMin=Math.min(...ys),yMax=Math.max(...ys)||1;
    const xP=(v)=>pad.left+(v-xMin)/(xMax-xMin||1)*cW;
    const yP=(v)=>pad.top+(1-(v-yMin)/(yMax-yMin||1))*cH;

    // Grid
    ctx.strokeStyle=Charts.cssVar('--border');ctx.lineWidth=0.5;
    [0,.5,1].forEach(t=>{
      const y=pad.top+t*cH;
      ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
      ctx.fillStyle=Charts.cssVar('--muted');ctx.font=`9px ${Charts.cssVar('--mono')}`;ctx.textAlign='right';
      ctx.fillText(Math.round(yMin+(1-t)*(yMax-yMin)),pad.left-3,y+3);
    });
    [0,.5,1].forEach(t=>{
      const x=pad.left+t*cW;
      ctx.beginPath();ctx.moveTo(x,pad.top);ctx.lineTo(x,H-pad.bottom);ctx.stroke();
      ctx.fillStyle=Charts.cssVar('--muted');ctx.font=`9px ${Charts.cssVar('--mono')}`;ctx.textAlign='center';
      ctx.fillText(Math.round(xMin+t*(xMax-xMin)),x,H-pad.bottom+12);
    });

    // Trend line
    if(points.length>2){
      const mx=xs.reduce((a,v)=>a+v,0)/xs.length;
      const my=ys.reduce((a,v)=>a+v,0)/ys.length;
      const num=xs.reduce((a,v,i)=>a+(v-mx)*(ys[i]-my),0);
      const den=xs.reduce((a,v)=>a+(v-mx)**2,0)||1;
      const slope=num/den, inter=my-slope*mx;
      ctx.beginPath();
      ctx.strokeStyle=Charts.cssVar('--orange')+'99';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
      ctx.moveTo(xP(xMin),yP(slope*xMin+inter));
      ctx.lineTo(xP(xMax),yP(slope*xMax+inter));
      ctx.stroke();ctx.setLineDash([]);
    }

    // Points
    points.forEach(p=>{
      ctx.beginPath();ctx.arc(xP(p.x),yP(p.y),4.5,0,Math.PI*2);
      ctx.fillStyle=Charts.cssVar(p.color||'--teal')+'cc';ctx.fill();
      ctx.strokeStyle=Charts.cssVar(p.color||'--teal');ctx.lineWidth=1;ctx.stroke();
    });

    // Axis labels
    if(opts.xLabel){ctx.fillStyle=Charts.cssVar('--muted');ctx.font=`9px ${Charts.cssVar('--font')}`;ctx.textAlign='center';ctx.fillText(opts.xLabel,W/2,H-2);}
    if(opts.yLabel){ctx.save();ctx.fillStyle=Charts.cssVar('--muted');ctx.font=`9px ${Charts.cssVar('--font')}`;ctx.translate(10,H/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText(opts.yLabel,0,0);ctx.restore();}
  }
};

// ── mkChartWrap: convenience factory ──
function mkChartWrap(id, title, sub, periodBtns){
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.id = id;
  const hdr = document.createElement('div');
  hdr.className = 'chart-wrap-title';
  let rightHtml = '';
  if(periodBtns){
    rightHtml = `<span class="chart-wrap-sub">${sub||''}</span>
      <div class="chart-period-btns" id="${id}-periods">
        ${periodBtns.map((b,i)=>`<button class="chart-period-btn${i===0?' active':''}" data-period="${b.val}">${b.lbl}</button>`).join('')}
      </div>`;
  } else if(sub){
    rightHtml = `<span class="chart-wrap-sub">${sub}</span>`;
  }
  hdr.innerHTML = title + rightHtml;
  wrap.appendChild(hdr);
  const canvas = document.createElement('canvas');
  canvas.className = 'chart-canvas';
  canvas.height = 0; // will be set by setupCanvas
  wrap.appendChild(canvas);
  return {wrap, canvas, hdr};
}


// ╔══════════════════════════════════════════════════════╗
// ║  DASHBOARD                                           ║
// ╚══════════════════════════════════════════════════════╝