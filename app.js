// app.js - WattWealth interactive charts + forecast UI
// Loads mockData.json if present; falls back to internal mock.
// Requires Chart.js to be referenced in index.html before this script.

(async function(){
  // small helpers
  const $ = id => document.getElementById(id);
  const set = (id, text) => { const e = $(id); if(e) e.innerText = text; };

  // load mock JSON if available
  async function loadMock() {
    try {
      const r = await fetch('mockData.json');
      if (!r.ok) throw new Error('no json');
      return await r.json();
    } catch (e) {
      // fallback - small realistic dataset
      return {
        hours: Array.from({length:24},(_,i)=>String(i).padStart(2,'0') + ':00'),
        forecast: {
          hours: Array.from({length:24},(_,i)=>String(i).padStart(2,'0') + ':00'),
          gridPrices: [0.24,0.22,0.21,0.20,0.20,0.19,0.18,0.16,0.12,0.10,0.09,0.10,0.12,0.15,0.18,0.20,0.22,0.26,0.34,0.30,0.25,0.22,0.21,0.23],
          solar: [0,0,0,0,0.2,0.8,1.6,2.8,3.6,4.0,4.4,4.8,4.2,3.4,2.4,1.2,0.6,0.3,0,0,0,0,0,0],
          batteryPower: [0.2,0.1,0,0,0,0.3,0.5,0.6,0.4,0.2,0,0,-0.2,-0.4,-0.5,-0.3,-0.1,-0.2,0,0,0.1,0.2,0.1,0],
          gridPower: [0.8,0.9,1.0,1.1,1.3,1.0,0.2,0.5,0.2,0.1,0.0,0.0,0.3,0.6,1.0,1.2,1.6,2.2,2.8,2.0,1.8,1.6,1.3,1.0],
          load: [1.2,1.0,0.9,0.8,0.8,0.7,0.9,1.5,2.6,3.0,3.4,3.8,3.7,3.4,3.2,3.0,2.8,3.0,2.5,2.0,1.8,1.6,1.4,1.2],
          soc: [60,60,61,61,60,62,66,72,78,81,80,79,78,76,75,74,72,68,60,55,52,50,49,48]
        },
        now: { solar: 0.63, battery: 86, grid: 0.02, home: 2.83, savingPerHour: 0.18, greenPercent: 77 },
        savings: { today: 3.2, week: 15.4, lifetime: 520, co2Kg: 4.2 },
        battery: { soh: 98, cycles: 120, lifeYears: 8 }
      };
    }
  }

  const data = await loadMock();

  // Small utility: safe access IDs used in index.html example
  const timelineCanvas = $('timelineChart');
  const prodCanvas = $('prodChart');

  // ---------- TIMELINE CHART (stacked area + price line) ----------
  let timelineChart;
  if (timelineCanvas && window.Chart) {
    const ctx = timelineCanvas.getContext('2d');
    timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.forecast.hours,
        datasets: [
          { label: 'Solar (kW)', data: data.forecast.solar, borderColor: 'rgba(242,201,76,0.95)', backgroundColor: 'rgba(242,201,76,0.18)', fill: true, tension: 0.25 },
          { label: 'Battery (kW)', data: data.forecast.batteryPower, borderColor: 'rgba(14,170,75,0.95)', backgroundColor: 'rgba(14,170,75,0.12)', fill: true, tension: 0.25 },
          { label: 'Grid (kW)', data: data.forecast.gridPower, borderColor: 'rgba(58,160,255,0.95)', backgroundColor: 'rgba(58,160,255,0.08)', fill: true, tension: 0.25 },
          { label: 'Price (€/kWh)', data: data.forecast.gridPrices, type: 'line', yAxisID: 'yPrice', borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.02)', pointRadius: 0, borderDash: [6,3], tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // CSS controls height
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: items => items[0].label,
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}${ctx.dataset.label.includes('Price') ? ' €/kWh' : ' kW'}`,
              afterBody: (ctx) => {
                // small estimated saving hint
                const i = ctx[0].dataIndex;
                return [`Estimated appliance saving if moved here: €${(0.5 + Math.random()*0.7).toFixed(2)}`];
              }
            }
          },
          legend: { display: false }
        },
        scales: {
          y: { display: true, beginAtZero: true, title: { display: true, text: 'kW' } },
          yPrice: { display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '€/kWh' } }
        },
        onClick: (evt, elements) => {
          if (elements.length) {
            const idx = elements[0].index;
            showHourDetails(idx);
          }
        }
      }
    });
  }

  // ---------- PRODUCTION / CONSUMPTION chart (compact) ----------
  let prodChart;
  if (prodCanvas && window.Chart) {
    const ctx2 = prodCanvas.getContext('2d');
    prodChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: data.forecast.hours,
        datasets: [
          { label: 'Solar', data: data.forecast.solar, backgroundColor: 'rgba(242,201,76,0.95)' },
          { label: 'Load', data: data.forecast.load, backgroundColor: 'rgba(155,139,230,0.85)' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { display: false } }
      }
    });
  }

  // ---------- populate right-column values & bars (IDs must be in your index) ----------
  (function populateSummary(){
    // peak avoidance sample for demonstration
    const peakStart = 17, peakEnd = 19;
    const withoutOpt = data.forecast.gridPower.slice(peakStart, peakEnd+1).reduce((a,b)=>a+b,0);
    const withOpt = withoutOpt * 0.75;
    const avoided = (withoutOpt - withOpt).toFixed(2);

    if ($('avoidedVal')) $('avoidedVal').innerText = '€' + avoided;
    if ($('barBefore')) $('barBefore').innerText = '€' + withoutOpt.toFixed(2);
    if ($('barAfter')) $('barAfter').innerText = '€' + withOpt.toFixed(2);
    if ($('greenPct')) set('greenPct', (data.now && data.now.greenPercent) ? (data.now.greenPercent + '%') : '—');
    if ($('todaySaved')) set('todaySaved', '€' + (data.savings.today || 0).toFixed(2));
    if ($('lifeSaved')) set('lifeSaved', '€' + (data.savings.lifetime || 0).toFixed(0));
    if ($('cycles')) set('cycles', (data.battery && data.battery.cycles) ? data.battery.cycles : '—');
  })();

  // ---------- tips generation + schedule button ----------
  const tipsList = $('tipsList');
  if (tipsList) {
    // pick 3 cheapest hours
    const priceIdx = data.forecast.gridPrices.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p).slice(0,3);
    tipsList.innerHTML = '';
    priceIdx.forEach(entry => {
      const hr = data.forecast.hours[entry.i];
      const el = document.createElement('div');
      el.className = 'tip';
      el.innerHTML = `<div><strong>Run dishwasher at ${hr}</strong><div class="meta">Estimated saving: €${(0.5 + Math.random()*0.6).toFixed(2)}</div></div>
                      <div><button class="btn schedule" data-hour="${entry.i}">Schedule</button></div>`;
      tipsList.appendChild(el);
    });

    // delegate schedule clicks
    tipsList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.schedule');
      if (!btn) return;
      const hour = data.forecast.hours[btn.dataset.hour];
      alert(`(Demo) Scheduled dishwasher suggestion at ${hour}`);
    });
  }

  // ---------- hour details handler (simple modal/alert) ----------
  function showHourDetails(i){
    const h = data.forecast.hours[i];
    const s = data.forecast.solar[i] ?? 0;
    const b = data.forecast.batteryPower[i] ?? 0;
    const g = data.forecast.gridPower[i] ?? 0;
    const p = data.forecast.gridPrices[i] ?? 0;
    const reason = s > 1.5 ? `Solar abundant at ${h} — recommended.` :
                   (b < 0 && p > 0.25) ? `Battery is discharging to shave peak price (${p} €/kWh).` :
                   `Grid partly used at ${h}. Price: €${p}/kWh.`;
    // use a simple in-page overlay / alert for prototype
    alert(`${h}\nSolar: ${s} kW\nBattery: ${b} kW\nGrid: ${g} kW\nPrice: €${p}/kWh\n\n${reason}`);
  }

  // ---------- TRACK IMPACT modal logic (if modal exists in index) ----------
  const modal = $('modal');
  if ($('trackImpactBtn') && modal) {
    $('trackImpactBtn').addEventListener('click', () => {
      modal.style.display = 'flex';
      populateImpact('today');
    });
    if ($('closeModal')) $('closeModal').addEventListener('click', ()=> modal.style.display = 'none');
    if ($('closeModal2')) $('closeModal2').addEventListener('click', ()=> modal.style.display = 'none');

    function populateImpact(period){
      // simple percentages computed from mock data (demo logic)
      const solarPct = period === 'today' ? 70 : (period === 'week' ? 62 : 58);
      const battPct  = period === 'today' ? 18 : (period === 'week' ? 20 : 22);
      const gridPct  = 100 - solarPct - battPct;
      if ($('rSolar')) $('rSolar').innerText = solarPct + '%';
      if ($('rBattery')) $('rBattery').innerText = battPct + '%';
      if ($('rGrid')) $('rGrid').innerText = gridPct + '%';
      if ($('impHeadline')) $('impHeadline').innerText = `Solar supplied ${solarPct}% of your usage (${period})`;
      if ($('impSub')) $('impSub').innerText = `Battery shaved €${((Math.random()*5)+1).toFixed(2)} in peak charges`;

      drawRing(0, solarPct, '#F2C94C');
      drawRing(1, battPct, '#0EAA4B');
      drawRing(2, gridPct, '#3AA0FF');
    }

    // draw ring: maps to the three canvas elements inside .ring
    function drawRing(index, pct, color){
      const canvases = document.querySelectorAll('.ring canvas');
      const c = canvases[index];
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.height);
      const center = c.width/2, radius = center - 8;
      // background
      ctx.beginPath(); ctx.arc(center,center,radius,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=8; ctx.stroke();
      // foreground arc
      const end = (Math.PI*2) * (pct/100) - Math.PI/2;
      ctx.beginPath(); ctx.arc(center,center,radius,-Math.PI/2,end); ctx.strokeStyle=color; ctx.lineWidth=8; ctx.lineCap='round'; ctx.stroke();
    }

    if ($('periodSelect')) {
      $('periodSelect').addEventListener('change', (e) => populateImpact(e.target.value));
    }
  }

  // ---------- small periodic 'live' feel updates ----------
  setInterval(() => {
    if ($('greenPct')) $('greenPct').innerText = (65 + Math.floor(Math.random()*12)) + '%';
  }, 2800);

  // ---------- export CSV demo ----------
  if ($('exportCSV')) {
    $('exportCSV').addEventListener('click', ()=>{
      const csv = 'period,solarPct,batteryPct,gridPct\nToday,70,18,12';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'wattwealth-impact.csv'; a.click();
      URL.revokeObjectURL(url);
    });
  }

})();
