// app.js - prototype interactive logic
async function loadMock() {
  try {
    const r = await fetch('mockData.json');
    if (!r.ok) throw new Error('no json');
    return await r.json();
  } catch (e) {
    // fallback small inline dataset if fetch fails
    return {
      now: { solar: 0.63, battery: 86, grid: 0.02, home: 2.83, savingPerHour: 0.18, greenPercent: 77 },
      forecast: {
        hours: ["00:00","01:00","02:00","03:00","04:00","05:00","06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"],
        gridPrices: [0.24,0.22,0.21,0.20,0.20,0.19,0.18,0.16,0.12,0.10,0.09,0.10,0.12,0.15,0.18,0.20,0.22,0.26,0.28,0.25,0.22,0.21,0.23,0.24],
        solar: [0,0,0,0,0,0.5,1.2,2.8,3.2,4.1,4.6,4.8,4.0,3.2,2.1,1.0,0.5,0.2,0,0,0,0,0,0]
      },
      savings: { today: 3.2, week: 15.4, lifetime: 520, co2Kg: 4.2 }
    }
  }
}

function updateFlowUI(now) {
  document.getElementById('solarK').innerText = `${now.solar.toFixed(2)} kW`;
  document.getElementById('batteryPct').innerText = `${Math.round(now.battery)}%`;
  document.getElementById('gridK').innerText = `${now.grid.toFixed(2)} kW`;
  document.getElementById('homeK').innerText = `${now.home.toFixed(2)} kW`;
  document.getElementById('savingRate').innerText = `€${now.savingPerHour.toFixed(2)}`;
  document.getElementById('greenPercent').innerText = `${now.greenPercent}%`;

  // animate stroke-dashoffset to give sense of flow
  const solarLine = document.querySelector('.solar-line');
  const batteryLine = document.querySelector('.battery-line');
  const gridLine = document.querySelector('.grid-line');

  // small animation by setting dashoffset based on magnitudes
  const s = Math.min(1, now.solar / Math.max(0.1, now.home));
  solarLine.style.strokeDasharray = 200;
  solarLine.style.strokeDashoffset = 200 - s * 200;

  const b = Math.min(1, (now.battery/100));
  batteryLine.style.strokeDasharray = 200;
  batteryLine.style.strokeDashoffset = 200 - b * 200;

  const g = Math.min(1, now.grid / Math.max(0.1, now.home));
  gridLine.style.strokeDasharray = 200;
  gridLine.style.strokeDashoffset = 200 - g * 200;
}

function narrativeFromData(now, savings) {
  const lines = [];
  lines.push(`Today you saved €${savings.today.toFixed(2)} vs grid-only.`);
  lines.push(`That’s roughly equal to ${Math.round(savings.today/1.5)} cups of coffee ☕.`);
  lines.push(`Right now ${now.greenPercent}% of your home is powered by green sources.`);
  lines.push(now.solar > 0 ? `Solar is producing ${now.solar.toFixed(2)} kW — great time to run heavy appliances.` : `Solar production is low right now.`);
  return lines.join(' ');
}

function renderForecastChart(labels, gridPrices, solar) {
  const ctx = document.getElementById('forecastChart').getContext('2d');
  // destroy existing chart if any
  if (window.__wattChart) window.__wattChart.destroy();

  window.__wattChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Grid price (€/kWh)',
          data: gridPrices,
          borderColor: '#072033',
          backgroundColor: 'rgba(7,32,51,0.05)',
          yAxisID: 'y',
          tension: 0.25
        },
        {
          label: 'Solar availability (kW)',
          data: solar,
          borderColor: '#0EAA4B',
          backgroundColor: 'rgba(14,170,75,0.06)',
          yAxisID: 'y1',
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { display: true },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: '€/kWh' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'kW (solar)' }
        }
      }
    }
  });
}

async function boot() {
  const data = await loadMock();
  // show initial
  updateFlowUI(data.now);
  document.getElementById('narrativeText').innerText = narrativeFromData(data.now, data.savings);
  renderForecastChart(data.forecast.hours, data.forecast.gridPrices, data.forecast.solar);

  // Tips: find cheapest hours (sample)
  const prices = data.forecast.gridPrices.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p).slice(0,3);
  const tipsEl = document.getElementById('tipsArea');
  tipsEl.innerHTML = `<strong>Best times to run heavy appliances:</strong> ${prices.map(x=>data.forecast.hours[x.i]).join(', ')} (lowest grid rates)`;

  // simulate small live updates every 3 seconds (prototype effect)
  setInterval(()=>{
    // create small randomized update to simulate changing production
    data.now.solar = Math.max(0, +(data.now.solar + (Math.random()-0.45)*0.2).toFixed(2));
    data.now.grid = Math.max(0, +(data.now.grid + (Math.random()-0.45)*0.02).toFixed(2));
    data.now.battery = Math.min(100, Math.max(10, Math.round(data.now.battery + (Math.random()-0.45)*2)));
    data.now.home = Math.max(0.3, +(data.now.home + (Math.random()-0.45)*0.2).toFixed(2));
    data.now.savingPerHour = +(0.14 + Math.random()*0.12).toFixed(2);
    updateFlowUI(data.now);
    document.getElementById('narrativeText').innerText = narrativeFromData(data.now, data.savings);
  }, 3000);
}

window.addEventListener('load', boot);
