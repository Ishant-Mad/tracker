const STORAGE_KEY = 'habit-tracker-state-v1';
const today = new Date();

const dom = {
  monthLabel: document.getElementById('month-label'),
  monthPrev: document.getElementById('month-prev'),
  monthNext: document.getElementById('month-next'),
  tableHead: document.getElementById('table-head'),
  tableBody: document.getElementById('table-body'),
  addHabit: document.getElementById('add-habit'),
  chartToggle: document.getElementById('chart-toggle'),
  canvas: document.getElementById('progress-canvas'),
};

function ensureCanvasSize() {
  const ratio = window.devicePixelRatio || 1;
  const rect = dom.canvas.parentElement.getBoundingClientRect();
  const displayWidth = Math.max(Math.floor(rect.width * ratio), 300);
  const displayHeight = Math.max(Math.floor(rect.height * ratio), 160 * ratio);
  if (dom.canvas.width !== displayWidth || dom.canvas.height !== displayHeight) {
    dom.canvas.width = displayWidth;
    dom.canvas.height = displayHeight;
  }
  return { width: displayWidth / ratio, height: displayHeight / ratio, ratio };
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function makeSampleState(activeMonth) {
  const baseMonth = activeMonth || today;
  const mKey = monthKey(baseMonth);
  return {
    monthOffset: 0,
    habits: [
      {
        id: crypto.randomUUID(),
        name: 'DSA-1',
        days: {
          [`${mKey}-02`]: true,
          [`${mKey}-08`]: true,
          [`${mKey}-12`]: true,
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'fsdfgs',
        days: {
          [`${mKey}-05`]: true,
          [`${mKey}-06`]: true,
          [`${mKey}-07`]: true,
          [`${mKey}-09`]: true,
          [`${mKey}-12`]: true,
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'fasdger',
        days: {
          [`${mKey}-02`]: true,
          [`${mKey}-03`]: true,
          [`${mKey}-04`]: true,
          [`${mKey}-06`]: true,
          [`${mKey}-07`]: true,
          [`${mKey}-09`]: true,
          [`${mKey}-12`]: true,
        },
      },
    ],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return makeSampleState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.habits || typeof parsed.monthOffset !== 'number') {
      return makeSampleState();
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to parse saved state, resetting.', err);
    return makeSampleState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let chartMode = 'smooth';

function getActiveMonthDate() {
  return new Date(today.getFullYear(), today.getMonth() + state.monthOffset, 1);
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function buildHeader(activeDate) {
  const totalDays = daysInMonth(activeDate);

  const dayCells = Array.from({ length: totalDays }, (_, i) => {
    const dayNum = i + 1;
    return `<th class="day-num">${dayNum}</th>`;
  }).join('');

  dom.tableHead.innerHTML = `
    <tr class="days-row">
      <th>#</th>
      <th class="name">Habit</th>
      ${dayCells}
      <th class="count">COUNT</th>
    </tr>
  `;
}

function habitCountForMonth(habit, activeDate) {
  const totalDays = daysInMonth(activeDate);
  const keyPrefix = monthKey(activeDate) + '-';
  let count = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${keyPrefix}${pad(day)}`;
    if (habit.days[key]) count += 1;
  }
  return count;
}

function renderRows(activeDate) {
  const totalDays = daysInMonth(activeDate);
  const monthPrefix = monthKey(activeDate);

  const rows = state.habits.map((habit, idx) => {
    const dayCells = Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      const key = `${monthPrefix}-${pad(day)}`;
      const checked = habit.days[key] ? 'checked' : '';
      return `
        <td>
          <label class="cell-box">
            <input type="checkbox" data-habit="${habit.id}" data-day="${key}" ${checked}>
          </label>
        </td>
      `;
    }).join('');

    const count = habitCountForMonth(habit, activeDate);
    const pct = totalDays ? Math.round((count / totalDays) * 100) : 0;

    return `
      <tr data-habit-row="${habit.id}">
        <td>${idx + 1}</td>
        <td class="name">
          <button class="trash-btn" data-delete="${habit.id}" title="Delete habit" aria-label="Delete habit">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 3h6l1 2h4v2h-1v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7H4V5h4l1-2Zm-1 4v11h2V7H8Zm4 0v11h2V7h-2ZM7 7h10v11H7V7Z" />
            </svg>
          </button>
          <span style="margin-left: 8px;">${habit.name}</span>
        </td>
        ${dayCells}
        <td class="count">
          <div class="count-bar"><span class="fill" style="width:${pct}%;"></span></div>
          <div style="font-size:12px; margin-top:4px;">${count}</div>
        </td>
      </tr>
    `;
  });

  const placeholders = [];
  const maxRows = 8;
  if (state.habits.length < maxRows) {
    const remaining = maxRows - state.habits.length;
    for (let i = 0; i < remaining; i += 1) {
      placeholders.push(
        `<tr class="placeholder-row"><td></td><td class="name"></td>${
          '<td></td>'.repeat(totalDays)
        }<td class="count"></td></tr>`
      );
    }
  }

  const totals = Array.from({ length: totalDays }, () => 0);
  state.habits.forEach((habit) => {
    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${monthPrefix}-${pad(day)}`;
      if (habit.days[key]) totals[day - 1] += 1;
    }
  });
  const totalSum = totals.reduce((a, b) => a + b, 0);

  const totalsRow = `
    <tr class="total-row">
      <td></td>
      <td class="name">Total</td>
      ${totals.map((n) => `<td>${n}</td>`).join('')}
      <td class="count">${totalSum}</td>
    </tr>
  `;

  dom.tableBody.innerHTML = rows.join('') + placeholders.join('') + totalsRow;
}

function renderMonthLabel(date) {
  const options = { month: 'long', year: 'numeric' };
  dom.monthLabel.textContent = date.toLocaleDateString('en-US', options).toUpperCase();
}

function handleTableChange(event) {
  const { target } = event;
  if (target.matches('input[type="checkbox"]')) {
    const habitId = target.dataset.habit;
    const dayKey = target.dataset.day;
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (target.checked) {
      habit.days[dayKey] = true;
    } else {
      delete habit.days[dayKey];
    }
    update();
  }
  const deleteBtn = target.closest('[data-delete]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.delete;
    state.habits = state.habits.filter((h) => h.id !== id);
    update();
  }
}

function addHabitFlow() {
  const name = prompt('New habit name?');
  if (!name) return;
  state.habits.push({ id: crypto.randomUUID(), name: name.trim(), days: {} });
  update();
}

function totalsByDay(activeDate) {
  const totalDays = daysInMonth(activeDate);
  const prefix = monthKey(activeDate);
  const totals = Array.from({ length: totalDays }, () => 0);
  state.habits.forEach((habit) => {
    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${prefix}-${pad(day)}`;
      if (habit.days[key]) totals[day - 1] += 1;
    }
  });
  return totals;
}

function drawSmoothLine(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.stroke();
}

function drawChart(mode, activeDate) {
  const ctx = dom.canvas.getContext('2d');
  const { width, height, ratio } = ensureCanvasSize();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const data = totalsByDay(activeDate);
  const maxVal = Math.max(...data, 1);
  const padding = 26;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  // grid lines
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  if (!data.length) return;

  if (mode === 'bar') {
    const barW = usableW / data.length - 4;
    ctx.fillStyle = '#0f0f0f';
    data.forEach((val, i) => {
      const x = padding + i * (usableW / data.length) + 2;
      const h = (val / maxVal) * (usableH - 10);
      const y = height - padding - h;
      ctx.fillRect(x, y, barW, h);
    });
    return;
  }

  const stepX = usableW / Math.max(data.length - 1, 1);
  const points = data.map((val, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (val / maxVal) * (usableH - 10);
    return { x, y };
  });

  ctx.strokeStyle = '#0f0f0f';
  ctx.lineWidth = 2;
  if (mode === 'smooth') {
    drawSmoothLine(ctx, points);
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  ctx.fillStyle = '#0f0f0f';
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function syncChartButtons() {
  Array.from(dom.chartToggle.querySelectorAll('button')).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === chartMode);
  });
}

function update() {
  const activeMonth = getActiveMonthDate();
  renderMonthLabel(activeMonth);
  buildHeader(activeMonth);
  renderRows(activeMonth);
  drawChart(chartMode, activeMonth);
  syncChartButtons();
  saveState(state);
}

function attachEvents() {
  dom.tableBody.addEventListener('click', handleTableChange);
  dom.tableBody.addEventListener('change', handleTableChange);
  dom.addHabit.addEventListener('click', addHabitFlow);
  dom.monthPrev.addEventListener('click', () => {
    state.monthOffset -= 1;
    update();
  });
  dom.monthNext.addEventListener('click', () => {
    state.monthOffset += 1;
    update();
  });
  dom.chartToggle.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    chartMode = e.target.dataset.mode;
    syncChartButtons();
    drawChart(chartMode, getActiveMonthDate());
  });

  window.addEventListener('resize', () => {
    drawChart(chartMode, getActiveMonthDate());
  });
}

attachEvents();
update();
