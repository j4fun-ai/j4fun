(function () {
  'use strict';

  var MANIFEST_URL = 'strands-data/index.json';
  var STORE_PREFIX = 'j4fun-daily-strands-';
  var manifest;
  var puzzle;
  var selectedDate;
  var visibleWeekStart;
  var grid = {};
  var cellEls = {};
  var selected = [];
  var foundWords = [];
  var pointerActive = false;
  var isDragging = false;
  var previewMode = false;

  function pad(value) { return String(value).padStart(2, '0'); }
  function dateKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
  function parseDate(value) { var p = value.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(date, days) { var copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
  function mondayOf(date) { var copy = new Date(date); var day = copy.getDay() || 7; copy.setDate(copy.getDate() - day + 1); copy.setHours(0, 0, 0, 0); return copy; }
  function isFuture(key) { return key > dateKey(new Date()); }
  function entryFor(key) { return manifest.puzzles.find(function (item) { return item.date === key; }); }
  function key(r, c) { return r + ',' + c; }
  function formatDate(keyText) { var d = parseDate(keyText); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function sameCell(a, b) { return a[0] === b[0] && a[1] === b[1]; }
  function pathMatches(actual, expected) {
    if (actual.length !== expected.length) return false;
    var forward = actual.every(function (cell, index) { return sameCell(cell, expected[index]); });
    var reverse = actual.every(function (cell, index) { return sameCell(cell, expected[expected.length - 1 - index]); });
    return forward || reverse;
  }
  function validatePuzzle(data) {
    if (!data || !Number.isInteger(data.width) || !Number.isInteger(data.height) || !Array.isArray(data.words)) throw new Error('Invalid puzzle structure');
    var used = {};
    var spangrams = data.words.filter(function (word) { return word.spangram; });
    if (spangrams.length > 1) throw new Error('A puzzle can have at most one spangram');
    data.words.forEach(function (word) {
      if (Array.from(word.text).length !== word.path.length) throw new Error('Word/path length mismatch: ' + word.text);
      word.path.forEach(function (cell, index) {
        var r = cell[0], c = cell[1], cellKey = key(r, c);
        if (r < 0 || r >= data.height || c < 0 || c >= data.width || used[cellKey]) throw new Error('Invalid or duplicate cell: ' + cellKey);
        if (index && Math.max(Math.abs(r - word.path[index - 1][0]), Math.abs(c - word.path[index - 1][1])) !== 1) throw new Error('Disconnected path: ' + word.text);
        used[cellKey] = true;
      });
    });
    if (Object.keys(used).length !== data.width * data.height) throw new Error('Puzzle does not cover the board');
    if (spangrams.length) {
      var span = spangrams[0].path;
      var touchesTop = span.some(function (cell) { return cell[0] === 0; });
      var touchesBottom = span.some(function (cell) { return cell[0] === data.height - 1; });
      var touchesLeft = span.some(function (cell) { return cell[1] === 0; });
      var touchesRight = span.some(function (cell) { return cell[1] === data.width - 1; });
      if (!((touchesTop && touchesBottom) || (touchesLeft && touchesRight))) throw new Error('Spangram must touch opposite edges');
    }
  }

  function loadProgress() {
    if (previewMode) return [];
    try { return JSON.parse(localStorage.getItem(STORE_PREFIX + selectedDate) || '[]'); }
    catch (error) { return []; }
  }
  function saveProgress() {
    if (previewMode) return;
    try { localStorage.setItem(STORE_PREFIX + selectedDate, JSON.stringify(foundWords)); }
    catch (error) { document.getElementById('saveStatus').textContent = '无法保存进度'; }
  }

  function renderWeek() {
    var box = document.getElementById('weekDays');
    var weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    box.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(visibleWeekStart, i);
      var dKey = dateKey(d);
      var entry = entryFor(dKey);
      var available = dKey >= manifest.startDate && !isFuture(dKey) && !!entry;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'week-day' + (dKey === selectedDate ? ' active' : '') + (available ? '' : ' locked');
      button.disabled = !available;
      button.innerHTML = '<span>周' + weekdays[i] + '</span><strong>' + (d.getMonth() + 1) + '/' + d.getDate() + '</strong>' + (available ? '<i aria-hidden="true">' + (localStorage.getItem(STORE_PREFIX + dKey) ? '•' : '') + '</i>' : '<i aria-hidden="true">锁</i>');
      if (available) button.addEventListener('click', (function (value) { return function () { selectDate(value); }; })(dKey));
      box.appendChild(button);
    }
    document.getElementById('previousWeek').disabled = dateKey(addDays(visibleWeekStart, 6)) < manifest.startDate;
    document.getElementById('nextWeek').disabled = dateKey(addDays(visibleWeekStart, 7)) > dateKey(new Date());
  }

  function renderArchive() {
    var box = document.getElementById('archiveList');
    var released = manifest.puzzles.filter(function (item) { return item.date >= manifest.startDate && !isFuture(item.date); }).slice().reverse();
    box.innerHTML = '';
    released.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = '<time>' + formatDate(item.date) + '</time><strong>' + item.title + '</strong><span>' + (localStorage.getItem(STORE_PREFIX + item.date) ? '玩过' : '开始') + ' →</span>';
      button.addEventListener('click', function () { toggleArchive(false); visibleWeekStart = mondayOf(parseDate(item.date)); selectDate(item.date); });
      box.appendChild(button);
    });
    if (!released.length) box.innerHTML = '<p>往期字踪会在这里出现。</p>';
  }

  function toggleArchive(show) {
    document.getElementById('archivePanel').hidden = !show;
    document.getElementById('archiveButton').setAttribute('aria-expanded', String(show));
  }

  function showUnavailable(title, copy) {
    document.getElementById('loadingState').hidden = true;
    document.getElementById('puzzlePanel').hidden = true;
    document.getElementById('unavailableState').hidden = false;
    document.getElementById('unavailableTitle').textContent = title;
    document.getElementById('unavailableCopy').textContent = copy;
  }

  function selectDate(value) {
    selectedDate = value;
    var url = new URL(window.location.href);
    url.searchParams.set('date', value);
    history.replaceState(null, '', url);
    renderWeek();
    var entry = entryFor(value);
    if (isFuture(value) && !previewMode) { showUnavailable('这一天还没有开放', '每天零点解锁一道新字踪，' + formatDate(value) + ' 再来吧。'); return; }
    if (!entry) { showUnavailable('这一天暂无字踪', value < manifest.startDate ? '每日字踪从 ' + formatDate(manifest.startDate) + ' 开始。' : '这一天的谜题还没有发布。'); return; }
    document.getElementById('loadingState').hidden = false;
    document.getElementById('puzzlePanel').hidden = true;
    document.getElementById('unavailableState').hidden = true;
    fetch('strands-data/' + entry.file, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Puzzle unavailable');
      return response.json();
    }).then(loadPuzzle).catch(function () { showUnavailable('字踪暂时没有摆好', '请稍后刷新页面再试。'); });
  }

  function loadPuzzle(data) {
    validatePuzzle(data);
    puzzle = data;
    grid = {};
    selected = [];
    foundWords = loadProgress().filter(function (text) { return puzzle.words.some(function (word) { return word.text === text; }); });
    puzzle.words.forEach(function (word) { word.path.forEach(function (rc, index) { grid[key(rc[0], rc[1])] = word.text[index]; }); });
    document.getElementById('puzzleNumber').textContent = '第 ' + puzzle.number + ' 期';
    document.getElementById('puzzleTitle').textContent = puzzle.title;
    document.getElementById('puzzleDate').textContent = formatDate(puzzle.date);
    document.getElementById('puzzleDate').dateTime = puzzle.date;
    document.getElementById('puzzleClue').textContent = puzzle.clue;
    document.getElementById('totalCount').textContent = puzzle.words.length;
    document.getElementById('saveStatus').textContent = previewMode ? '预览模式 · 不保存进度' : '进度保存在本机';
    document.getElementById('loadingState').hidden = true;
    document.getElementById('puzzlePanel').hidden = false;
    renderBoard(); renderFoundList(); updateCount(); renderSelection(); setFeedback('', foundWords.length === puzzle.words.length ? '🎉 已完成今天的字踪！' : '');
  }

  function wordFor(text) { return puzzle.words.find(function (word) { return word.text === text; }); }
  function renderBoard() {
    var board = document.getElementById('board');
    board.style.gridTemplateColumns = 'repeat(' + puzzle.width + ', 1fr)';
    board.innerHTML = ''; cellEls = {};
    for (var r = 0; r < puzzle.height; r++) for (var c = 0; c < puzzle.width; c++) {
      var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'cell'; cell.textContent = grid[key(r, c)] || ''; cell.dataset.r = r; cell.dataset.c = c; cell.setAttribute('aria-label', '字：' + cell.textContent); board.appendChild(cell); cellEls[key(r, c)] = cell;
    }
    applyFoundStyles();
  }
  function applyFoundStyles() { foundWords.forEach(function (text) { var word = wordFor(text); if (word) word.path.forEach(function (rc) { cellEls[key(rc[0], rc[1])].classList.add(word.spangram ? 'found-span' : 'found-word'); }); }); }
  function renderFoundList() { var box = document.getElementById('foundList'); box.innerHTML = ''; foundWords.forEach(function (text) { var word = wordFor(text); var chip = document.createElement('span'); chip.className = 'found-chip' + (word.spangram ? ' spangram' : ''); chip.textContent = text; box.appendChild(chip); }); }
  function updateCount() { document.getElementById('foundCount').textContent = foundWords.length; }
  function isAdjacent(a, b) { return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && !(a[0] === b[0] && a[1] === b[1]); }
  function includesCell(list, rc) { return list.some(function (p) { return p[0] === rc[0] && p[1] === rc[1]; }); }
  function isFound(rc) { return foundWords.some(function (text) { return includesCell(wordFor(text).path, rc); }); }
  function renderSelection() { Object.keys(cellEls).forEach(function (k) { cellEls[k].classList.remove('active'); }); selected.forEach(function (rc) { cellEls[key(rc[0], rc[1])].classList.add('active'); }); var bar = document.getElementById('composeBar'); bar.innerHTML = selected.length ? selected.map(function (rc) { return grid[key(rc[0], rc[1])]; }).join('') : '<span class="ph">点击或拖动连字</span>'; }
  function clearSelection() { selected = []; isDragging = false; renderSelection(); }
  function setFeedback(kind, text) { var el = document.getElementById('feedback'); el.className = 'feedback' + (kind ? ' ' + kind : ''); el.textContent = text; }
  function submit() {
    var text = selected.map(function (rc) { return grid[key(rc[0], rc[1])]; }).join('');
    var match = puzzle.words.find(function (word) { return pathMatches(selected, word.path) && foundWords.indexOf(word.text) === -1; });
    if (match) { foundWords.push(match.text); saveProgress(); clearSelection(); applyFoundStyles(); renderFoundList(); updateCount(); renderWeek(); setFeedback(match.spangram ? 'win' : 'ok', match.spangram ? '✨ 找到通关词：「' + match.text + '」' : '找到了：「' + match.text + '」'); if (foundWords.length === puzzle.words.length) setTimeout(function () { setFeedback('win', '🎉 今天的字踪全部找到！'); }, 250); }
    else { selected.forEach(function (rc) { cellEls[key(rc[0], rc[1])].classList.add('wrong'); }); setFeedback('bad', text.length > 1 ? '「' + text + '」不对，再试试' : ''); setTimeout(clearSelection, 350); }
  }
  function pointerDown(r, c) { var rc = [r, c]; if (isFound(rc)) return; if (!selected.length) selected = [rc]; else { var last = selected[selected.length - 1]; if (last[0] === r && last[1] === c) { pointerActive = false; submit(); return; } selected = isAdjacent(last, rc) && !includesCell(selected, rc) ? selected.concat([rc]) : [rc]; } pointerActive = true; isDragging = false; renderSelection(); }
  function pointerEnter(r, c) { if (!pointerActive || !selected.length) return; var rc = [r, c]; var last = selected[selected.length - 1]; if (!isFound(rc) && isAdjacent(last, rc) && !includesCell(selected, rc)) { selected.push(rc); isDragging = true; renderSelection(); } }

  document.getElementById('board').addEventListener('pointerdown', function (event) { var cell = event.target.closest('.cell'); if (!cell) return; event.preventDefault(); pointerDown(Number(cell.dataset.r), Number(cell.dataset.c)); });
  document.getElementById('board').addEventListener('pointermove', function (event) { if (!pointerActive) return; var target = document.elementFromPoint(event.clientX, event.clientY); var cell = target && target.closest('.cell'); if (cell) pointerEnter(Number(cell.dataset.r), Number(cell.dataset.c)); });
  document.getElementById('board').addEventListener('click', function (event) { var cell = event.target.closest('.cell'); if (!cell || event.detail !== 0) return; pointerDown(Number(cell.dataset.r), Number(cell.dataset.c)); pointerActive = false; });
  window.addEventListener('pointerup', function () { if (pointerActive && isDragging && selected.length) submit(); pointerActive = false; });
  document.getElementById('btnClear').addEventListener('click', clearSelection);
  document.getElementById('btnHint').addEventListener('click', function () { var word = puzzle.words.find(function (item) { return foundWords.indexOf(item.text) === -1; }); setFeedback('', word ? '提示：有一个' + word.text.length + '字的' + (word.spangram ? '通关词' : '词') + '，开头是「' + word.text[0] + '」' : '今天已经全部找到啦'); });
  document.getElementById('btnReset').addEventListener('click', function () { if (!window.confirm('清除今天的进度并重新开始？')) return; foundWords = []; saveProgress(); loadPuzzle(puzzle); renderWeek(); });
  document.getElementById('archiveButton').addEventListener('click', function () { toggleArchive(document.getElementById('archivePanel').hidden); });
  document.getElementById('closeArchive').addEventListener('click', function () { toggleArchive(false); });
  document.getElementById('previousWeek').addEventListener('click', function () { visibleWeekStart = addDays(visibleWeekStart, -7); renderWeek(); });
  document.getElementById('nextWeek').addEventListener('click', function () { visibleWeekStart = addDays(visibleWeekStart, 7); renderWeek(); });

  fetch(MANIFEST_URL, { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('Manifest unavailable'); return response.json(); }).then(function (data) {
    manifest = data;
    var params = new URLSearchParams(location.search);
    var previewDate = params.get('preview');
    var isLocalPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]';
    previewMode = isLocalPreview && /^\d{4}-\d{2}-\d{2}$/.test(previewDate || '');
    var requested = previewMode ? previewDate : params.get('date');
    var today = dateKey(new Date());
    selectedDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : (today < manifest.startDate ? manifest.startDate : today);
    visibleWeekStart = mondayOf(parseDate(selectedDate));
    renderArchive(); selectDate(selectedDate);
  }).catch(function () { showUnavailable('每日字踪暂时无法载入', '请检查网络后刷新页面。'); });
})();
