(function () {
  'use strict';

  var STORAGE_KEY = 'halfmarathon_v1';
  var DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // Hal Higdon — Half Marathon Novice 1 (12 weeks, Mon..Sun)
  var PLAN = [
    ['Rest', '3 mi run', '2 mi run or cross', '3 mi run', 'Rest', '30 min cross', '4 mi run'],
    ['Rest', '3 mi run', '2 mi run or cross', '3 mi run', 'Rest', '30 min cross', '4 mi run'],
    ['Rest', '3.5 mi run', '2 mi run or cross', '3.5 mi run', 'Rest', '40 min cross', '5 mi run'],
    ['Rest', '3.5 mi run', '2 mi run or cross', '3.5 mi run', 'Rest', '40 min cross', '5 mi run'],
    ['Rest', '4 mi run', '2 mi run or cross', '4 mi run', 'Rest', '40 min cross', '6 mi run'],
    ['Rest', '4 mi run', '2 mi run or cross', '4 mi run', 'Rest or easy run', 'Rest', '5-K Race'],
    ['Rest', '4.5 mi run', '3 mi run or cross', '4.5 mi run', 'Rest', '50 min cross', '7 mi run'],
    ['Rest', '4.5 mi run', '3 mi run or cross', '4.5 mi run', 'Rest', '50 min cross', '8 mi run'],
    ['Rest', '5 mi run', '3 mi run or cross', '5 mi run', 'Rest or easy run', 'Rest', '10-K Race'],
    ['Rest', '5 mi run', '3 mi run or cross', '5 mi run', 'Rest', '60 min cross', '9 mi run'],
    ['Rest', '5 mi run', '3 mi run or cross', '5 mi run', 'Rest', '60 min cross', '10 mi run'],
    ['Rest', '4 mi run', '3 mi run or cross', '2 mi run', 'Rest', 'Rest', 'Half Marathon']
  ];
  var RACE_DAY_NUM = 11 * 7 + 6; // week 12, Sun
  var CROSS_TYPES = ['Bike', 'Swim', 'Elliptical', 'Row', 'Strength', 'Yoga', 'Other'];

  function isRest(label) { return label.trim().toLowerCase() === 'rest'; }
  function isLoggable(label) { return !isRest(label); }
  function isRace(label) {
    var l = label.trim().toLowerCase();
    return l === '5-k race' || l === '10-k race' || l === 'half marathon';
  }
  function hasCross(label) { return /\bcross\b/i.test(label); }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadState() {
    var s = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s) s = {};
    if (!s.raceDate) s.raceDate = null;
    if (!s.logs) s.logs = {};
    if (!s.overrides) s.overrides = {};
    if (!s.crossType) s.crossType = {};
    return s;
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();
  var didAutoScroll = false;

  function effectiveLabel(wi, di) {
    var key = (wi + 1) + '-' + di;
    return state.overrides[key] || PLAN[wi][di];
  }

  function crossOptionsHtml(selected) {
    var html = '<option value=""' + (!selected ? ' selected' : '') + '>Cross-train</option>';
    CROSS_TYPES.forEach(function (t) {
      html += '<option value="' + t + '"' + (selected === t ? ' selected' : '') + '>' + t + '</option>';
    });
    return html;
  }

  function dateForDay(raceDate, week, dayIdx) {
    var dayNum = (week - 1) * 7 + dayIdx;
    var parts = raceDate.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + (dayNum - RACE_DAY_NUM));
    return d;
  }
  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function fmtRange(d1, d2) {
    return MONTHS[d1.getMonth()] + ' ' + d1.getDate() + ' – ' + MONTHS[d2.getMonth()] + ' ' + d2.getDate();
  }
  function daysUntil(raceDate) {
    var parts = raceDate.split('-').map(Number);
    var race = new Date(parts[0], parts[1] - 1, parts[2]);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    race.setHours(0, 0, 0, 0);
    return Math.round((race - today) / 86400000);
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function renderOnboarding(existingDate) {
    var app = document.getElementById('app');
    app.innerHTML = '';
    var wrap = el(
      '<div class="ob">' +
        '<div>' +
          '<div class="ob-title">Half Marathon</div>' +
          '<div class="ob-sub">12-Week Novice 1 Plan · Hal Higdon</div>' +
        '</div>' +
        '<div>' +
          '<div class="ob-label">Race date</div>' +
          '<input class="ob-input" type="date" id="raceDateInput">' +
        '</div>' +
        '<button class="ob-btn" id="startBtn">' + (existingDate ? 'Save' : 'Start Plan') + '</button>' +
        (existingDate ? '<div class="ob-cancel" id="cancelBtn">Cancel</div>' : '') +
      '</div>'
    );
    app.appendChild(wrap);
    var input = document.getElementById('raceDateInput');
    if (existingDate) input.value = existingDate;
    document.getElementById('startBtn').addEventListener('click', function () {
      if (!input.value) { input.focus(); return; }
      state.raceDate = input.value;
      saveState(state);
      didAutoScroll = false;
      renderMain();
    });
    if (existingDate) {
      document.getElementById('cancelBtn').addEventListener('click', renderMain);
    }
  }

  function renderMain() {
    if (!state.raceDate) { renderOnboarding(null); return; }

    var app = document.getElementById('app');
    app.innerHTML = '';

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var totalLoggable = 0, totalLogged = 0;
    var currentWeek = 1;

    PLAN.forEach(function (week, wi) {
      week.forEach(function (_, di) {
        var d = dateForDay(state.raceDate, wi + 1, di);
        var label = effectiveLabel(wi, di);
        if (isLoggable(label)) {
          totalLoggable++;
          if (state.logs[(wi + 1) + '-' + di]) totalLogged++;
        }
        if (sameDate(d, today)) currentWeek = wi + 1;
      });
    });

    var remaining = daysUntil(state.raceDate);
    var countdownText = remaining > 0 ? remaining + ' DAYS TO RACE' : (remaining === 0 ? 'RACE DAY' : 'RACE COMPLETE');

    var header = el(
      '<div>' +
        '<div class="hd">' +
          '<div>' +
            '<div class="hd-title">Half Marathon</div>' +
            '<div class="hd-sub">Novice 1 · Hal Higdon</div>' +
          '</div>' +
          '<i class="ti ti-settings hd-gear" id="gearBtn"></i>' +
        '</div>' +
        '<div class="stat-line">' +
          '<span class="accent">WEEK ' + currentWeek + ' OF 12</span>' +
          '<span class="stat-dot">·</span>' +
          '<span>' + countdownText + '</span>' +
          '<span class="stat-dot">·</span>' +
          '<i class="ti ti-check"></i>' +
          '<span id="loggedCount">' + totalLogged + ' / ' + totalLoggable + ' LOGGED</span>' +
        '</div>' +
        '<div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>' +
      '</div>'
    );
    app.appendChild(header);
    document.getElementById('progressFill').style.width = (totalLoggable ? (100 * totalLogged / totalLoggable) : 0) + '%';
    document.getElementById('gearBtn').addEventListener('click', function () {
      renderOnboarding(state.raceDate);
    });

    var list = el('<div id="weekList"></div>');
    app.appendChild(list);

    PLAN.forEach(function (week, wi) {
      var weekNum = wi + 1;
      var firstDate = dateForDay(state.raceDate, weekNum, 0);
      var lastDate = dateForDay(state.raceDate, weekNum, 6);

      var block = el(
        '<div class="week-block">' +
          '<div class="week-head">' +
            '<div class="week-num">WEEK ' + (weekNum < 10 ? '0' + weekNum : weekNum) + '</div>' +
            '<div class="week-range">' + fmtRange(firstDate, lastDate) + '</div>' +
          '</div>' +
          '<div class="day-list"></div>' +
        '</div>'
      );
      var dayList = block.querySelector('.day-list');

      week.forEach(function (baseLabel, di) {
        var d = dateForDay(state.raceDate, weekNum, di);
        var key = weekNum + '-' + di;
        var label = effectiveLabel(wi, di);
        var loggable = isLoggable(label);
        var race = isRace(label);
        var cross = hasCross(label);
        var isToday = sameDate(d, today);
        var value = state.logs[key] || '';
        var crossValue = state.crossType[key] || '';

        var classes = 'day-row';
        if (isToday) classes += ' is-today';
        if (race) classes += ' is-race';
        if (!loggable) classes += ' is-rest';

        var row = el(
          '<div class="' + classes + '">' +
            '<div class="day-date"><span class="day-dow">' + DOW[di] + '</span><span class="day-dom">' + d.getDate() + '</span></div>' +
            '<div class="day-main">' +
              '<div class="day-plan">' + escapeHtml(label) + '</div>' +
              (cross ? '<select class="cross-select' + (crossValue ? ' chosen' : '') + '">' + crossOptionsHtml(crossValue) + '</select>' : '') +
            '</div>' +
            (loggable ? '<input class="day-time' + (value ? ' has-value' : '') + '" placeholder="' + (race ? 'FINISH' : 'TIME') + '" value="' + escapeHtml(value) + '">' : '') +
          '</div>'
        );

        if (loggable) {
          var input = row.querySelector('.day-time');
          input.addEventListener('change', function () {
            if (input.value.trim()) {
              state.logs[key] = input.value.trim();
              input.classList.add('has-value');
            } else {
              delete state.logs[key];
              input.classList.remove('has-value');
            }
            saveState(state);
            var loggedNow = Object.keys(state.logs).length;
            document.getElementById('progressFill').style.width = (totalLoggable ? (100 * loggedNow / totalLoggable) : 0) + '%';
            document.getElementById('loggedCount').textContent = loggedNow + ' / ' + totalLoggable + ' LOGGED';
          });
        }

        if (cross) {
          var selectEl = row.querySelector('.cross-select');
          selectEl.addEventListener('change', function () {
            if (selectEl.value) {
              state.crossType[key] = selectEl.value;
              selectEl.classList.add('chosen');
            } else {
              delete state.crossType[key];
              selectEl.classList.remove('chosen');
            }
            saveState(state);
          });
        }

        var planDiv = row.querySelector('.day-plan');
        planDiv.addEventListener('click', function () {
          var currentText = planDiv.textContent;
          var inputEl = document.createElement('input');
          inputEl.className = 'day-plan-edit';
          inputEl.value = currentText;
          planDiv.replaceWith(inputEl);
          inputEl.focus();
          inputEl.select();
          var committed = false;
          function commit() {
            if (committed) return;
            committed = true;
            var val = inputEl.value.trim();
            if (!val || val === PLAN[wi][di]) {
              delete state.overrides[key];
            } else {
              state.overrides[key] = val;
            }
            saveState(state);
            renderMain();
          }
          inputEl.addEventListener('blur', commit);
          inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); inputEl.blur(); }
            else if (e.key === 'Escape') { inputEl.value = currentText; inputEl.blur(); }
          });
        });

        dayList.appendChild(row);
      });

      list.appendChild(block);
    });

    if (!didAutoScroll) {
      didAutoScroll = true;
      var todayRow = document.querySelector('.day-row.is-today');
      if (todayRow) {
        setTimeout(function () { todayRow.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 150);
      }
    }
  }

  renderMain();
})();
