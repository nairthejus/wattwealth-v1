/* Detailed interactive prototype script
   - loads mockData.json
   - renders 2 Chart.js charts: production/consumption and SOC+price
   - animates SVG path strokeDashoffset to show flows
   - updates labels, decision log, tips, and battery ring
*/

// tiny helpers
const $ = id => document.getElementById(id);
const set = (id, v) => { const e=$(id); if(e) e.innerText = v; };

// sidebar toggle
document.getElementById('menuBtn').addEventListener('click', ()=> {
  const s = document.getElementById('sidebar'); s.classList.toggle('hidden'); s.setAttribute('aria-hidden', s.classList.contains('hidden'));
});
document.getElementById('closeNav').addEventListener('click', ()=> {
  const s = document.getElementById('sidebar'); s.classList.add('hidden'); s.setAttribute('aria-hidden', 'true');
});

// fetch mock data
async function loadMock(){
  try {
    const r = await fetch('mockData.json');
    if(!r.ok) throw new Error('fetch error');
    return await r.json();
  } catch(e) {
    console.warn('mock load failed -> fallback', e);
    // fallback same structure
    return {
      now:{solar:0.63,battery:86,grid:0.02,home:2.83,savingPerHour:0.18,greenPercent:77},
      forecast:{
        hours:["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"],
        gridPrices:[0.24,0.22,0.21,0.20,0.20,0.19,0.18,0.16,0.12,0.10,0.09,0.10,0.12,0.15,0.18,0.20,0.22,0.26,0.28,0.25,0.22,0.21,0.23,0.24],
        solar:[0,0,0,0,0,0.5,1.2,2.8,3.2,4.1,4.6,4.8,4.0,3.2,2.1,1.0,0.5,0.2,0,0,0,0,0,0]
      },
      savings:{today:3.2,week:15.4,lifetime:520,co2Kg:4.2},
      battery:{soh:98,cycles:120,lifeYears:8}
    };
  }
}

// render production/consumption chart (many lines)
function renderProdChart(labels, dataSets){
  const ctx = document.getElementById('prodChart').getContext('2d');
  if(window.__prodChart) window.__prodChart.destroy();
  window.__prodChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: dataSets },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: { display:true },
        y: { display:true, title:{display:true,text:'kW'} }
      },
      plugins:{legend:{position:'top'}}
    }
  });
}

// render SOC + price chart
function renderSocChart(labels, price, soc){
  const ctx = document.getElementById('socChart').getContext('2d');
  if(window.__socChart) window.__socChart.destroy();
  window.__socChart = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        { label: 'Price (€ / kWh)', data: price, borderColor:'#9aa4ad', yAxisID:'y'},
        { label: 'Battery SoC (%)', data: soc, borderColor:'#0EAA4B', yAxisID:'y1' }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{
        y:{ type:'linear', position:'left', title:{display:true,text:'€/kWh'} },
        y1:{ type:'linear', position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'SoC (%)'} }
      },
      interaction:{mode:'index',intersect:false}
    }
  });
}

// animate flow by adjusting strokeDashoffset (bigger magnitude -> more visible)
function animateFlow(now){
  const solarToBatt = document.querySelector('#path-solar-to-batt');
  const solarToHome = document.querySelector('#path-solar-to-home');
  const battToHome = document.querySelector('#path-batt-to-home');
  const gridToHome = document.querySelector('#path-grid-to-home');
  const len = 800; // general length for dasharray

  const home = Math.max(0.12, now.home);
  const s = Math.min(1, now.solar / home);
  const g = Math.min(1, now.grid / home);
  const b = Math.min(1, now.battery / 100);

  [solarToBatt, solarToHome, battToHome, gridToHome].forEach(p => {
    if(!p) return;
    p.style.strokeDasharray = len;
    // choose mapping to strength: solar flows stronger if solar production is high
    if(p === solarToBatt || p === solarToHome) p.style.strokeDashoffset = len - (s*len);
    if(p === battToHome) p.style.strokeDashoffset = len - (b*len);
    if(p === gridToHome) p.style.strokeDashoffset = len - (g*len);
    // subtle opacity
    p.style.opacity = 0.3 + ( (p===gridToHome?g:(p===battToHome?b:s)) * 0.7 );
  });
}

// update numeric labels & ring
function updateUI(data){
  set('solarLabel', `${data.now.solar.toFixed(2)} kW`);
  set('batteryLabel', `${Math.round(data.now.battery)}%`);
  set('gridLabel', `${data.now.grid.toFixed(2)} kW`);
  set('homeLabel', `${data.now.home.toFixed(2)} kW`);
  set('totalSolar', `${(data.forecast.solar.reduce((a,b)=>a+b,0)).toFixed(2)} kWh`);
  set('moneySaved', `€${data.savings.today.toFixed(2)}`);
  set('todaySaved', `€${data.savings.today.toFixed(2)}`);
  set('weekSaved', `€${data.savings.week.toFixed(2)}`);
  set('co2Saved', `${data.savings.co2Kg} kg`);
  set('batterySOH', `${data.battery.soh}%`);
  set('batteryCycles', `${data.battery.cycles}`);
  set('batteryLife', `${data.battery.lifeYears} years`);
  set('ringText', `${Math.round(data.now.battery)}%`);
  // update ring dashoffset (circle circumference ~ 276)
  const ring = document.querySelector('#ringFill');
  const pct = Math.max(0, Math.min(100, data.now.battery));
  const dash = 276 - (276 * (pct/100));
  if(ring) ring.style.strokeDashoffset = dash;
}

// build decision log (explainable decisions)
function renderDecisionLog(entries){
  const el = $('decisionLog');
  el.innerHTML = '';
  entries.forEach((e)=>{
    const div = document.createElement('div');
    div.className='log-row';
    div.innerHTML = `<div style="font-weight:700">${e.period}</div><div class="muted">${e.reason}</div>`;
    el.appendChild(div);
  });
}

// tips panel & click-to-ack
function renderTips(tips){
  const ul = $('tipsPanel');
  ul.innerHTML='';
  tips.forEach((t,i)=>{
    const li = document.createElement('li');
    li.innerText = t;
    li.addEventListener('click', ()=> {
      li.style.textDecoration='line-through';
      li.style.opacity='0.5';
    });
    ul.appendChild(li);
  });
}

// main boot
async function boot(){
  const data = await loadMock();

  // render charts
  // production chart: show solar, load (house), battery (charging positive / discharging negative)
  const labels = data.forecast.hours;
  const prodDatasets = [
    { label:'Solar (kW)', data: data.forecast.solar, borderColor:'#F2C94C', backgroundColor:'rgba(242,201,76,0.03)', tension:0.2 },
    { label:'Load (kW)', data: data.forecast.load || labels.map(()=>1.2), borderColor:'#9B8BE6', backgroundColor:'rgba(155,139,230,0.03)', tension:0.2 },
    { label:'Battery (kW)', data: data.forecast.batteryPower || labels.map(()=>0), borderColor:'#0EAA4B', backgroundColor:'rgba(14,170,75,0.03)', tension:0.2 },
    { label:'Grid (kW)', data: data.forecast.gridPower || labels.map(()=>0.1), borderColor:'#3AA0FF', backgroundColor:'rgba(58,160,255,0.03)', tension:0.2 }
  ];

  renderProdChart(labels, prodDatasets);

  // SOC + price
  const price = data.forecast.gridPrices;
  const soc = data.forecast.soc || labels.map(()
