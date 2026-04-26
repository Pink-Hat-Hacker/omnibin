// 'use strict';

// const socket = io();

// // ── State ──────────────────────────────────────────────────────
// let currentClassificationId = null;
// let selectedDevice = '';

// const LABEL_COLORS = {
//   Garbage: '#9999bb',
//   Plastic: '#5bc8f5',
//   Paper:   '#f0c040',
//   Metal:   '#d0d0e0',
// };

// // ── Tab switching ──────────────────────────────────────────────
// document.querySelectorAll('.tab-btn').forEach(btn => {
//   btn.addEventListener('click', () => {
//     document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
//     document.querySelectorAll('.tab-content').forEach(t => {
//       t.classList.remove('active');
//       t.classList.add('hidden');
//     });
//     btn.classList.add('active');
//     const tab = document.getElementById('tab-' + btn.dataset.tab);
//     tab.classList.remove('hidden');
//     tab.classList.add('active');
//     if (btn.dataset.tab === 'admin') loadAdminData();
//   });
// });

// // ── Socket events ──────────────────────────────────────────────
// socket.on('pi_status', ({ connected }) => {
//   const dot   = document.getElementById('pi-dot');
//   const label = document.getElementById('pi-status-label');
//   dot.className = 'dot ' + (connected ? 'online' : 'offline');
//   label.textContent = connected ? 'Pi Online' : 'Pi Offline';
// });

// socket.on('pi_machine_status', ({ state, label }) => {
//   const badge = document.getElementById('machine-status-badge');
//   badge.textContent = state.toUpperCase() + (label ? ': ' + label : '');
//   badge.className = 'badge ' + state;
// });

// socket.on('classification', (data) => {
//   currentClassificationId = data.classification_id;
//   showClassification(data);
//   addFeedItem(data);
//   showSnapshot(data.image);
// });

// // ── Classification display ─────────────────────────────────────
// function showClassification(data) {
//   const el = document.getElementById('current-class');
//   el.textContent = data.label;
//   el.className = 'label-' + data.label;

//   // Confidence bars
//   const bars = document.getElementById('confidence-bars');
//   bars.innerHTML = '';
//   const sorted = [...data.all_predictions].sort((a, b) => b.confidence - a.confidence);
//   sorted.forEach(p => {
//     const pct = Math.round(p.confidence * 100);
//     const color = LABEL_COLORS[p.label] || 'var(--green)';
//     bars.innerHTML += `
//       <div class="conf-row">
//         <span class="conf-label label-${p.label}">${p.label}</span>
//         <div class="conf-track">
//           <div class="conf-fill" style="width:${pct}%;background:${color}"></div>
//         </div>
//         <span class="conf-val">${pct}%</span>
//       </div>`;
//   });

//   document.getElementById('confirm-box').classList.remove('hidden');
//   document.getElementById('relabel-box').classList.add('hidden');
// }

// function showSnapshot(imageDataUrl) {
//   const wrap = document.getElementById('snapshot-wrap');
//   const img  = document.getElementById('snapshot-img');
//   if (imageDataUrl) {
//     img.src = imageDataUrl;
//     wrap.classList.remove('hidden');
//   }
// }

// function addFeedItem(data) {
//   const list = document.getElementById('live-feed');
//   const pct  = Math.round(data.confidence * 100);
//   const time = new Date(data.timestamp * 1000).toLocaleTimeString();

//   const li = document.createElement('li');
//   li.className = 'feed-item';
//   li.innerHTML = `
//     <span class="feed-label label-${data.label}">${data.label}</span>
//     <span class="feed-conf">${pct}%</span>
//     <span class="feed-time">${time}</span>`;
//   list.prepend(li);

//   while (list.children.length > 25) list.removeChild(list.lastChild);
// }

// // ── Confirm buttons ────────────────────────────────────────────
// document.getElementById('yes-btn').addEventListener('click', async () => {
//   await sendConfirm(true, null);
//   document.getElementById('confirm-box').classList.add('hidden');
//   document.getElementById('snapshot-wrap').classList.add('hidden');
// });

// document.getElementById('no-btn').addEventListener('click', () => {
//   document.getElementById('relabel-box').classList.remove('hidden');
// });

// document.getElementById('relabel-submit').addEventListener('click', async () => {
//   const label = document.getElementById('relabel-select').value;
//   await sendConfirm(false, label);
//   document.getElementById('confirm-box').classList.add('hidden');
//   document.getElementById('snapshot-wrap').classList.add('hidden');
// });

// async function sendConfirm(confirmed, correctLabel) {
//   if (!currentClassificationId) return;
//   const body = { classification_id: currentClassificationId, confirmed };
//   if (correctLabel) body.correct_label = correctLabel;
//   try {
//     await fetch('/api/confirm', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(body)
//     });
//   } catch (e) {
//     console.error('Confirm failed:', e);
//   }
// }

// // ── Admin panel ────────────────────────────────────────────────
// async function loadAdminData() {
//   await Promise.all([
//     loadDevices(),
//     loadStats(),
//     loadHistory(),
//     loadTimeline(),
//   ]);
// }

// async function loadDevices() {
//   try {
//     const res  = await fetch('/api/devices');
//     const devs = await res.json();

//     const list   = document.getElementById('devices-list');
//     const filter = document.getElementById('device-filter');
//     filter.innerHTML = '<option value="">All Devices</option>';

//     if (devs.length === 0) {
//       list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px">No devices registered yet.</div>';
//       return;
//     }

//     list.innerHTML = devs.map(d => {
//       const online  = d.status === 'online';
//       const lastSeen = d.last_seen ? new Date(d.last_seen).toLocaleString() : 'unknown';
//       return `
//         <div class="device-row">
//           <span class="dot ${online ? 'online' : 'offline'}"></span>
//           <div>
//             <div class="device-name">${d.name || d.device_id}</div>
//             <div class="device-id">${d.device_id}</div>
//           </div>
//           <span class="device-time">${lastSeen}</span>
//         </div>`;
//     }).join('');

//     devs.forEach(d => {
//       const opt = document.createElement('option');
//       opt.value = d.device_id;
//       opt.textContent = d.name || d.device_id;
//       filter.appendChild(opt);
//     });

//     // Restore selection
//     if (selectedDevice) filter.value = selectedDevice;
//   } catch (e) {
//     console.error('loadDevices failed:', e);
//   }
// }

// document.getElementById('device-filter').addEventListener('change', async (e) => {
//   selectedDevice = e.target.value;
//   await Promise.all([loadStats(), loadHistory(), loadTimeline()]);
// });

// async function loadStats() {
//   try {
//     const url = '/api/stats' + (selectedDevice ? `?device_id=${selectedDevice}` : '');
//     const res  = await fetch(url);
//     const data = await res.json();

//     // Aggregate by label across devices
//     const byLabel = {};
//     data.forEach(r => {
//       const label = r._id.label;
//       if (!byLabel[label]) byLabel[label] = { total: 0, confirmed: 0, avgConf: [] };
//       byLabel[label].total     += r.total;
//       byLabel[label].confirmed += r.confirmed;
//       byLabel[label].avgConf.push(r.avg_confidence);
//     });

//     const table = document.getElementById('accuracy-table');

//     if (Object.keys(byLabel).length === 0) {
//       table.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
//       renderDonut({});
//       return;
//     }

//     table.innerHTML = `<table>
//       <thead><tr>
//         <th>Category</th><th>Total</th><th>Confirmed</th>
//         <th>Accuracy</th><th>Avg Conf.</th>
//       </tr></thead>
//       <tbody>
//       ${Object.entries(byLabel).map(([label, s]) => {
//         const acc = s.total ? Math.round(s.confirmed / s.total * 100) : 0;
//         const avgConf = s.avgConf.length
//           ? Math.round(s.avgConf.reduce((a, b) => a + b, 0) / s.avgConf.length * 100)
//           : 0;
//         const barClass = acc >= 80 ? 'accuracy-good' : acc >= 50 ? 'accuracy-mid' : 'accuracy-bad';
//         return `<tr>
//           <td class="label-${label}">${label}</td>
//           <td>${s.total}</td>
//           <td>${s.confirmed}</td>
//           <td>
//             <div class="accuracy-bar-wrap">
//               <div class="accuracy-bar ${barClass}" style="width:${acc}px"></div>
//               <span>${acc}%</span>
//             </div>
//           </td>
//           <td>${avgConf}%</td>
//         </tr>`;
//       }).join('')}
//       </tbody></table>`;

//     renderDonut(byLabel);
//   } catch (e) {
//     console.error('loadStats failed:', e);
//   }
// }

// function renderDonut(byLabel) {
//   const wrap = document.getElementById('donut-chart');

//   const entries = Object.entries(byLabel);
//   if (entries.length === 0) {
//     wrap.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center">No data yet.</p>';
//     return;
//   }

//   const total = entries.reduce((s, [, v]) => s + v.total, 0);
//   const cx = 70, cy = 70, r = 55, strokeW = 22;
//   const circumference = 2 * Math.PI * r;

//   let offset = 0;
//   const segments = entries.map(([label, s]) => {
//     const pct  = s.total / total;
//     const dash = pct * circumference;
//     const seg  = { label, pct, dash, offset, color: LABEL_COLORS[label] || '#888' };
//     offset += dash;
//     return seg;
//   });

//   const svgSegments = segments.map(s =>
//     `<circle cx="${cx}" cy="${cy}" r="${r}"
//        fill="none"
//        stroke="${s.color}"
//        stroke-width="${strokeW}"
//        stroke-dasharray="${s.dash} ${circumference - s.dash}"
//        stroke-dashoffset="${-s.offset + circumference / 4}"
//        style="transition:stroke-dasharray 0.5s ease"
//     />`
//   ).join('');

//   const legendRows = entries.map(([label, s]) => {
//     const pct = total ? Math.round(s.total / total * 100) : 0;
//     return `<div class="legend-row">
//       <div class="legend-dot" style="background:${LABEL_COLORS[label] || '#888'}"></div>
//       <span class="legend-label">${label}</span>
//       <span class="legend-val">${pct}%</span>
//     </div>`;
//   }).join('');

//   wrap.innerHTML = `
//     <svg class="donut-svg" width="${cx*2}" height="${cy*2}" viewBox="0 0 ${cx*2} ${cy*2}">
//       <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
//         stroke="var(--border)" stroke-width="${strokeW}" />
//       ${svgSegments}
//       <text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em"
//         fill="var(--text)" font-size="16" font-weight="700">${total}</text>
//       <text x="${cx}" y="${cy + 18}" text-anchor="middle"
//         fill="var(--muted)" font-size="9">total</text>
//     </svg>
//     <div class="donut-legend">${legendRows}</div>`;
// }

// async function loadHistory() {
//   try {
//     const url = '/api/classifications?limit=100'
//       + (selectedDevice ? `&device_id=${selectedDevice}` : '');
//     const res  = await fetch(url);
//     const data = await res.json();

//     const tbody = document.getElementById('history-body');

//     if (data.length === 0) {
//       tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:1.5rem">No records yet.</td></tr>';
//       return;
//     }

//     tbody.innerHTML = data.map(d => {
//       const time  = new Date(d.timestamp).toLocaleString();
//       const conf  = d.confidence != null ? Math.round(d.confidence * 100) + '%' : '—';
//       const confClass = d.confirmed === true  ? 'confirmed-yes'
//                       : d.confirmed === false ? 'confirmed-no'
//                       : 'confirmed-pending';
//       const confText  = d.confirmed === true  ? '✓ Yes'
//                       : d.confirmed === false ? '✗ No'
//                       : '—';
//       const corrected = d.user_label ? ` → ${d.user_label}` : '';
//       return `<tr>
//         <td>${time}</td>
//         <td class="label-${d.label}">${d.label}${corrected}</td>
//         <td>${conf}</td>
//         <td class="${confClass}">${confText}</td>
//         <td style="color:var(--muted);font-size:0.75rem">${d.device_id}</td>
//       </tr>`;
//     }).join('');
//   } catch (e) {
//     console.error('loadHistory failed:', e);
//   }
// }

// document.getElementById('refresh-history').addEventListener('click', loadHistory);

// async function loadTimeline() {
//   try {
//     const url = '/api/timeline?hours=24'
//       + (selectedDevice ? `&device_id=${selectedDevice}` : '');
//     const res  = await fetch(url);
//     const data = await res.json();

//     // Aggregate per hour
//     const hourCounts = {};
//     data.forEach(r => {
//       const h = r._id.hour;
//       hourCounts[h] = (hourCounts[h] || 0) + r.count;
//     });

//     const maxCount = Math.max(...Object.values(hourCounts), 1);
//     const chart = document.getElementById('timeline-chart');
//     chart.innerHTML = '';

//     for (let h = 0; h < 24; h++) {
//       const count  = hourCounts[h] || 0;
//       const height = Math.max(Math.round((count / maxCount) * 100), count > 0 ? 4 : 2);
//       const bar    = document.createElement('div');
//       bar.className = 'chart-bar';
//       bar.style.height  = height + '%';
//       bar.style.opacity = count > 0 ? '0.85' : '0.2';
//       bar.dataset.label = `${h}:00 — ${count} item${count !== 1 ? 's' : ''}`;
//       chart.appendChild(bar);
//     }
//   } catch (e) {
//     console.error('loadTimeline failed:', e);
//   }
// }
'use strict';

const socket = io();

// ── Camera stream management ───────────────────────────────────
// MJPEG streams can silently stall. We manage src here so we can
// retry when the Pi comes online and show a placeholder when it's off.
const streamImg = document.getElementById('camera-stream');
let streamActive = false;
let streamRetryTimer = null;

const STREAM_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480'%3E%3Crect width='640' height='480' fill='%230e0e1a'/%3E%3Ctext x='50%25' y='46%25' fill='%23333' text-anchor='middle' font-size='18' font-family='sans-serif'%3ECamera Unavailable%3C/text%3E%3Ctext x='50%25' y='56%25' fill='%232a2a4a' text-anchor='middle' font-size='13' font-family='sans-serif'%3EPi is offline%3C/text%3E%3C/svg%3E";

function startStream() {
  clearTimeout(streamRetryTimer);
  // Cache-busting timestamp prevents browser from serving stale response
  streamImg.src = `/pi-stream?t=${Date.now()}`;
  streamActive  = true;
}

function stopStream() {
  clearTimeout(streamRetryTimer);
  streamImg.src = STREAM_PLACEHOLDER;
  streamActive  = false;
}

streamImg.addEventListener('error', () => {
  if (!streamActive) return;
  streamActive  = false;
  streamImg.src = STREAM_PLACEHOLDER;
  // Retry in 5 seconds
  streamRetryTimer = setTimeout(startStream, 5000);
});

// Start with placeholder until Pi comes online
streamImg.src = STREAM_PLACEHOLDER;

// ── State ──────────────────────────────────────────────────────
let currentClassificationId = null;
let selectedDevice = '';

const LABEL_COLORS = {
  Garbage: '#9999bb',
  Plastic: '#5bc8f5',
  Paper:   '#f0c040',
  Metal:   '#d0d0e0',
};

// ── Tab switching ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => {
      t.classList.remove('active');
      t.classList.add('hidden');
    });
    btn.classList.add('active');
    const tab = document.getElementById('tab-' + btn.dataset.tab);
    tab.classList.remove('hidden');
    tab.classList.add('active');
    if (btn.dataset.tab === 'admin') loadAdminData();
  });
});

// ── Socket events ──────────────────────────────────────────────
socket.on('pi_status', ({ connected }) => {
  const dot   = document.getElementById('pi-dot');
  const label = document.getElementById('pi-status-label');
  dot.className = 'dot ' + (connected ? 'online' : 'offline');
  label.textContent = connected ? 'Pi Online' : 'Pi Offline';

  if (connected && !streamActive) {
    startStream();
  } else if (!connected) {
    stopStream();
  }
});

socket.on('pi_machine_status', ({ state, label }) => {
  const badge = document.getElementById('machine-status-badge');
  badge.textContent = state.toUpperCase() + (label ? ': ' + label : '');
  badge.className = 'badge ' + state;
});

socket.on('classification', (data) => {
  currentClassificationId = data.classification_id;
  showClassification(data);
  addFeedItem(data);
  showSnapshot(data.image);
});

// ── Classification display ─────────────────────────────────────
function showClassification(data) {
  const el = document.getElementById('current-class');
  el.textContent = data.label;
  el.className = 'label-' + data.label;

  // Confidence bars
  const bars = document.getElementById('confidence-bars');
  bars.innerHTML = '';
  const sorted = [...data.all_predictions].sort((a, b) => b.confidence - a.confidence);
  sorted.forEach(p => {
    const pct = Math.round(p.confidence * 100);
    const color = LABEL_COLORS[p.label] || 'var(--green)';
    bars.innerHTML += `
      <div class="conf-row">
        <span class="conf-label label-${p.label}">${p.label}</span>
        <div class="conf-track">
          <div class="conf-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="conf-val">${pct}%</span>
      </div>`;
  });

  document.getElementById('confirm-box').classList.remove('hidden');
  document.getElementById('relabel-box').classList.add('hidden');
}

function showSnapshot(imageDataUrl) {
  const wrap = document.getElementById('snapshot-wrap');
  const img  = document.getElementById('snapshot-img');
  if (imageDataUrl) {
    img.src = imageDataUrl;
    wrap.classList.remove('hidden');
  }
}

function addFeedItem(data) {
  const list = document.getElementById('live-feed');
  const pct  = Math.round(data.confidence * 100);
  const time = new Date(data.timestamp * 1000).toLocaleTimeString();

  const li = document.createElement('li');
  li.className = 'feed-item';
  li.innerHTML = `
    <span class="feed-label label-${data.label}">${data.label}</span>
    <span class="feed-conf">${pct}%</span>
    <span class="feed-time">${time}</span>`;
  list.prepend(li);

  while (list.children.length > 25) list.removeChild(list.lastChild);
}

// ── Confirm buttons ────────────────────────────────────────────
document.getElementById('yes-btn').addEventListener('click', async () => {
  await sendConfirm(true, null);
  document.getElementById('confirm-box').classList.add('hidden');
  document.getElementById('snapshot-wrap').classList.add('hidden');
});

document.getElementById('no-btn').addEventListener('click', () => {
  document.getElementById('relabel-box').classList.remove('hidden');
});

document.getElementById('relabel-submit').addEventListener('click', async () => {
  const label = document.getElementById('relabel-select').value;
  await sendConfirm(false, label);
  document.getElementById('confirm-box').classList.add('hidden');
  document.getElementById('snapshot-wrap').classList.add('hidden');
});

async function sendConfirm(confirmed, correctLabel) {
  if (!currentClassificationId) return;
  const body = { classification_id: currentClassificationId, confirmed };
  if (correctLabel) body.correct_label = correctLabel;
  try {
    await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Confirm failed:', e);
  }
}

// ── Admin panel ────────────────────────────────────────────────
async function loadAdminData() {
  await Promise.all([
    loadDevices(),
    loadStats(),
    loadHistory(),
    loadTimeline(),
  ]);
}

async function loadDevices() {
  try {
    const res  = await fetch('/api/devices');
    const devs = await res.json();

    const list   = document.getElementById('devices-list');
    const filter = document.getElementById('device-filter');
    filter.innerHTML = '<option value="">All Devices</option>';

    if (devs.length === 0) {
      list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px">No devices registered yet.</div>';
      return;
    }

    list.innerHTML = devs.map(d => {
      const online  = d.status === 'online';
      const lastSeen = d.last_seen ? new Date(d.last_seen).toLocaleString() : 'unknown';
      return `
        <div class="device-row">
          <span class="dot ${online ? 'online' : 'offline'}"></span>
          <div>
            <div class="device-name">${d.name || d.device_id}</div>
            <div class="device-id">${d.device_id}</div>
          </div>
          <span class="device-time">${lastSeen}</span>
        </div>`;
    }).join('');

    devs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.device_id;
      opt.textContent = d.name || d.device_id;
      filter.appendChild(opt);
    });

    // Restore selection
    if (selectedDevice) filter.value = selectedDevice;
  } catch (e) {
    console.error('loadDevices failed:', e);
  }
}

document.getElementById('device-filter').addEventListener('change', async (e) => {
  selectedDevice = e.target.value;
  await Promise.all([loadStats(), loadHistory(), loadTimeline()]);
});

async function loadStats() {
  try {
    const url = '/api/stats' + (selectedDevice ? `?device_id=${selectedDevice}` : '');
    const res  = await fetch(url);
    const data = await res.json();

    // Aggregate by label across devices
    const byLabel = {};
    data.forEach(r => {
      const label = r._id.label;
      if (!byLabel[label]) byLabel[label] = { total: 0, confirmed: 0, avgConf: [] };
      byLabel[label].total     += r.total;
      byLabel[label].confirmed += r.confirmed;
      byLabel[label].avgConf.push(r.avg_confidence);
    });

    const table = document.getElementById('accuracy-table');

    if (Object.keys(byLabel).length === 0) {
      table.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
      renderDonut({});
      return;
    }

    table.innerHTML = `<table>
      <thead><tr>
        <th>Category</th><th>Total</th><th>Confirmed</th>
        <th>Accuracy</th><th>Avg Conf.</th>
      </tr></thead>
      <tbody>
      ${Object.entries(byLabel).map(([label, s]) => {
        const acc = s.total ? Math.round(s.confirmed / s.total * 100) : 0;
        const avgConf = s.avgConf.length
          ? Math.round(s.avgConf.reduce((a, b) => a + b, 0) / s.avgConf.length * 100)
          : 0;
        const barClass = acc >= 80 ? 'accuracy-good' : acc >= 50 ? 'accuracy-mid' : 'accuracy-bad';
        return `<tr>
          <td class="label-${label}">${label}</td>
          <td>${s.total}</td>
          <td>${s.confirmed}</td>
          <td>
            <div class="accuracy-bar-wrap">
              <div class="accuracy-bar ${barClass}" style="width:${acc}px"></div>
              <span>${acc}%</span>
            </div>
          </td>
          <td>${avgConf}%</td>
        </tr>`;
      }).join('')}
      </tbody></table>`;

    renderDonut(byLabel);
  } catch (e) {
    console.error('loadStats failed:', e);
  }
}

function renderDonut(byLabel) {
  const wrap = document.getElementById('donut-chart');

  const entries = Object.entries(byLabel);
  if (entries.length === 0) {
    wrap.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center">No data yet.</p>';
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v.total, 0);
  const cx = 70, cy = 70, r = 55, strokeW = 22;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = entries.map(([label, s]) => {
    const pct  = s.total / total;
    const dash = pct * circumference;
    const seg  = { label, pct, dash, offset, color: LABEL_COLORS[label] || '#888' };
    offset += dash;
    return seg;
  });

  const svgSegments = segments.map(s =>
    `<circle cx="${cx}" cy="${cy}" r="${r}"
       fill="none"
       stroke="${s.color}"
       stroke-width="${strokeW}"
       stroke-dasharray="${s.dash} ${circumference - s.dash}"
       stroke-dashoffset="${-s.offset + circumference / 4}"
       style="transition:stroke-dasharray 0.5s ease"
    />`
  ).join('');

  const legendRows = entries.map(([label, s]) => {
    const pct = total ? Math.round(s.total / total * 100) : 0;
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${LABEL_COLORS[label] || '#888'}"></div>
      <span class="legend-label">${label}</span>
      <span class="legend-val">${pct}%</span>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <svg class="donut-svg" width="${cx*2}" height="${cy*2}" viewBox="0 0 ${cx*2} ${cy*2}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="var(--border)" stroke-width="${strokeW}" />
      ${svgSegments}
      <text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em"
        fill="var(--text)" font-size="16" font-weight="700">${total}</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle"
        fill="var(--muted)" font-size="9">total</text>
    </svg>
    <div class="donut-legend">${legendRows}</div>`;
}

async function loadHistory() {
  try {
    const url = '/api/classifications?limit=100'
      + (selectedDevice ? `&device_id=${selectedDevice}` : '');
    const res  = await fetch(url);
    const data = await res.json();

    const tbody = document.getElementById('history-body');

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:1.5rem">No records yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(d => {
      const time  = new Date(d.timestamp).toLocaleString();
      const conf  = d.confidence != null ? Math.round(d.confidence * 100) + '%' : '—';
      const confClass = d.confirmed === true  ? 'confirmed-yes'
                      : d.confirmed === false ? 'confirmed-no'
                      : 'confirmed-pending';
      const confText  = d.confirmed === true  ? '✓ Yes'
                      : d.confirmed === false ? '✗ No'
                      : '—';
      const corrected = d.user_label ? ` → ${d.user_label}` : '';
      return `<tr>
        <td>${time}</td>
        <td class="label-${d.label}">${d.label}${corrected}</td>
        <td>${conf}</td>
        <td class="${confClass}">${confText}</td>
        <td style="color:var(--muted);font-size:0.75rem">${d.device_id}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    console.error('loadHistory failed:', e);
  }
}

document.getElementById('refresh-history').addEventListener('click', loadHistory);

async function loadTimeline() {
  try {
    const url = '/api/timeline?hours=24'
      + (selectedDevice ? `&device_id=${selectedDevice}` : '');
    const res  = await fetch(url);
    const data = await res.json();

    // Aggregate per hour
    const hourCounts = {};
    data.forEach(r => {
      const h = r._id.hour;
      hourCounts[h] = (hourCounts[h] || 0) + r.count;
    });

    const maxCount = Math.max(...Object.values(hourCounts), 1);
    const chart = document.getElementById('timeline-chart');
    chart.innerHTML = '';

    for (let h = 0; h < 24; h++) {
      const count  = hourCounts[h] || 0;
      const height = Math.max(Math.round((count / maxCount) * 100), count > 0 ? 4 : 2);
      const bar    = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height  = height + '%';
      bar.style.opacity = count > 0 ? '0.85' : '0.2';
      bar.dataset.label = `${h}:00 — ${count} item${count !== 1 ? 's' : ''}`;
      chart.appendChild(bar);
    }
  } catch (e) {
    console.error('loadTimeline failed:', e);
  }
}