// app.js - improved prototype logic (no build)
async function loadMock() {
  try {
    const r = await fetch('mockData.json');
    if (!r.ok) throw new Error('no json');
    return await r.json();
  } catch (e) {
    console.warn('mock fetch failed; using inline fallback', e);
    return {
      now:{solar:0.63,battery:86,grid:0.02,home:2.83,savingPerHour:0.18,greenPercent:77,soh:98,cycles:120},
      forecast:{
        hours:["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"],
        gridPrices:[0.24,0.22,0.21,0.20,0.20,0.19,0.18,0.16,0.12,0.10,0.09,0.10,0.12,0.15,0.18,0.20,0.22,0.26,0.28,0.25,0.22,0.21,0.23,0.24],
        solar:[0,0,0,0,0,0.5,1.2,2.8,3.2,4.1,4.6,4.8,4.0,3.2,2.1,1.0,0.5,0.2,0,0,0,0,0,0]
      },
      savings:{today:3.2,week:15.4,lifetime:520,co2Kg:4.2},
      battery:{soh:98,cycles:120,lifeYears:8}
    }
  }
}

/* ---------- UI helpers ---------- */
function el(id){ return document.getElementById(id) }
function setText(id,txt){ const e=el(id); if(e) e.innerText=txt }

/* ---------- Sidebar toggle ---------- */
const menuBtn = document.getElementById('menuBtn')
const sidebar = document.getElementById('sidebar')
const closeNav = document.getElementById('closeNav')
menuBtn.addEventListener('click', ()=> sidebar.classList.toggle('hidden'))
closeNav.addEventListener('click', ()=> sidebar.classList.add('hidden'))

/* ---------- Flow UI update & collision avoidance ---------- */
function updateFlowUI(now) {
  setText('solarK', `${now.solar.toFixed(2)} kW`)
  setText('batteryPct', `${Math.round(now.battery)}%`)
  setText('gridK', `${now.grid.toFixed(2)} kW`)
  setText('homeK', `${now.home.toFixed(2)} kW`)
  setText('savingRate', `€${now.savingPerHour.toFixed(2)}/hr`)
  setText('greenPercent', `${now.greenPercent}%`)
  setText('batterySoC', `${Math.round(now.battery)}%`)

  // animate stroke dash to indicate flow magnitude
  const solarLine = document.querySelector('.solar-line')
  const batteryLine = document.querySelector('.battery-line')
  const gridLine = document.querySelector('.grid-line')

  const home = Math.max(0.12, now.home)
  const s = Math.min(1, now.solar / home)
  const g = Math.min(1, now.grid / home)
  const b = Math.min(1, (now.battery / 100))

  solarLine.style.strokeDasharray = 300
  solarLine.style.strokeDashoffset = 300 - s * 300

  batteryLine.style.strokeDasharray = 300
  batteryLine.style.strokeDashoffset = 300 - b * 300

  gridLine.style.strokeDasharray = 300
  gridLine.style.strokeDashoffset = 300 - g * 300

  // gentle glow based on activity
  document.querySelectorAll('.node-bg').forEach(el=>{
    el.style.filter = 'drop-shadow(0 12px 22px rgba(0,0,0,0.6))'
  })
}

/* Avoid SVG label overlaps: nudge label groups if bounding boxes intersect */
function resolveLabelCollisions() {
  try {
    const svg = document.getElementById('flowSVG')
    const nodes = ['node-solar','node-battery','node-grid','node-home'].map(id=>svg.querySelector('#'+id))
    const boxes = nodes.map(n=>{
      const bbox = n.getBBox()
      return {n,bbox}
    })

    // simple O(n^2) check: if overlapping on y axis adjust vertical translate slightly
    for(let i=0;i<boxes.length;i++){
      for(let j=i+1;j<boxes.length;j++){
        const a = boxes[i].bbox, b = boxes[j].bbox
        const overlapX = !(a.x + a.width < b.x || b.x + b.width < a.x)
        const overlapY = !(a.y + a.height < b.y || b.y + b.height < a.y)
        if(overlapX && overlapY){
          // nudge the lower one down and upper one up
          const ai = boxes[i].n, bi = boxes[j].n
          const ay = ai.transform.baseVal.getItem(0).matrix.f
          const by = bi.transform.baseVal.getItem(0).matrix.f
          // apply small translate
          ai.setAttribute('transform', `translate(${ai.transform.baseVal.getItem(0).matrix.e},${ay-18})`)
          bi.setAttribute('transform', `translate(${bi.transform.baseVal.getItem(0).matrix.e},${by+18})`)
        }
      }
    }
  } catch(e){
    // if any error (older browsers) skip
    // console.debug('collision resolve skipped', e)
  }
}

/* ---------- Forecast chart ---------- */
function renderForecastChart(labels, gridPrices, solar) {
  const ctx = document.getElementById('forecastChart').getContext('2d')
  if(window.__wChart) window.__wChart.destroy()
  window.__wChart = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Grid price (€/kWh)',data:gridPrices,borderColor:'#9aa4ad',backgroundColor:'rgba(154,164,173,0.03)',yAxisID:'y'},
        {label:'Solar (kW)',data:solar,borderColor:'#0EAA4B',backgroundColor:'rgba(14,170,75,0.06)',yAxisID:'y1'}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{display:true},
        y:{type:'linear',position:'left',title:{display:true,text:'€/kWh'}},
        y1:{type:'linear',position:'right',grid:{drawOnChartArea:false},title:{display:true,text:'kW'}}
      },
      plugins:{legend:{position:'top'}}
    }
  })
}

/* ---------- Narrative generator & tips ---------- */
function narrativeFromData(now, savings) {
  const parts = []
  parts.push(`You saved €${savings.today.toFixed(2)} today vs grid-only.`)
  parts.push(`That’s ~${Math.round(savings.today/1.5)} cups of coffee ☕ or ${savings.co2Kg} kg CO₂ saved.`)
  parts.push(`Right now ${now.greenPercent}% of your home is green-powered.`)
  if(now.solar>0.5) parts.push(`Solar producing ${now.solar.toFixed(2)} kW — good to run high-load appliances.`)
  else parts.push('Solar production low right now — battery/grid are active.')
  return parts.join(' ')
}

/* ---------- Boot ---------- */
async function boot(){
  const data = await loadMock()

  // initial UI
  updateFlowUI(data.now)
  setText('todaySaved',`€${data.savings.today.toFixed(2)}`)
  setText('weekSaved',`€${data.savings.week.toFixed(2)}`)
  setText('co2Saved',`${data.savings.co2Kg} kg`)
  setText('narrativeText', narrativeFromData(data.now, data.savings))
  setText('batterySOH', `${data.battery.soh}%`)
  setText('batteryCycles', `${data.battery.cycles}`)
  setText('batteryLife', `${data.battery.lifeYears} years`)
  setText('upgradeSavings', `€${Math.round(data.savings.lifetime / 10)} / year`)

  renderForecastChart(data.forecast.hours, data.forecast.gridPrices, data.forecast.solar)

  // tips: cheapest 3 hours
  const idxs = data.forecast.gridPrices.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p).slice(0,3)
  const cheap = idxs.map(x=>data.forecast.hours[x.i]).join(', ')
  document.getElementById('tipsArea').innerHTML = `<strong>Best times to run heavy appliances:</strong> ${cheap}`

  // run collision resolution after short delay so svg loads
  setTimeout(resolveLabelCollisions, 250)

  // small live simulation updates to feel interactive
  setInterval(()=>{
    data.now.solar = Math.max(0, +(data.now.solar + (Math.random()-0.45)*0.4).toFixed(2))
    data.now.grid = Math.max(0, +(data.now.grid + (Math.random()-0.45)*0.06).toFixed(2))
    data.now.battery = Math.min(100, Math.max(10, Math.round(data.now.battery + (Math.random()-0.45)*2)))
    data.now.home = Math.max(0.25, +(data.now.home + (Math.random()-0.45)*0.3).toFixed(2))
    data.now.savingPerHour = +(0.12 + Math.random()*0.2).toFixed(2)
    data.now.greenPercent = Math.min(100, Math.max(10, Math.round((data.now.solar*20) + (data.now.battery/5))))
    updateFlowUI(data.now)
    setText('narrativeText', narrativeFromData(data.now, data.savings))
    // update battery fill height
    document.getElementById('batteryFill').style.height = Math.max(6, (data.now.battery) + '%')
  }, 3000)
}

window.addEventListener('load', boot)
