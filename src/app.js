(() => {
  'use strict';
  const STORAGE_KEY = 'once-human-animal-breeding-schedule-v2';
  const LEGACY_KEY = 'once-human-animal-breeding-schedule-v1';
  const defaults = { characters: ['Main Character'], animals: ['Bear', 'Boar', 'Capybara', 'Crocodile', 'Deer', 'Ewe-Ram', 'Flamingo', 'Fox', 'Leopard', 'Rabbit', 'Sea Turtle', 'Snow Fox', 'Wild Buffalo', 'Wolf'], types: ['Regular', 'Rare', 'Original', 'Phantom'], entries: [], inventory: [] };
  const byId = (id) => document.getElementById(id);
  const form = byId('schedule-form');
  const fields = { character: byId('character'), animal: byId('animal'), type: byId('type'), trait: byId('trait'), scheduleAt: byId('schedule-at'), eland: byId('eland'), notes: byId('notes') };
  const filters = { character: byId('filter-character'), animal: byId('filter-animal'), type: byId('filter-type'), trait: byId('filter-trait') };
  const view = { tab: 'schedule', search: '', filters: { character: '', animal: '', type: '', trait: '' }, sort: { key: 'scheduleAt', direction: 'asc' } };
  let state = loadState();
  let pendingConfirmation = null;
  let activeListKey = null;
  let cardQueue = [];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function normaliseList(value, fallback) { return Array.isArray(value) && value.length ? [...new Set(value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))] : [...fallback]; }
  function migrate(data) {
    const migrated = { characters: normaliseList(data.characters, defaults.characters), animals: normaliseList(data.animals, defaults.animals), types: normaliseList(data.types, defaults.types), entries: Array.isArray(data.entries) ? data.entries : [], inventory: Array.isArray(data.inventory) ? data.inventory : [] };
    const rename = { 'Ewe': 'Deer', 'Ram': 'Sheep', 'Doe': 'Deer', 'Ewe-Ram': 'Sheep' };
    migrated.animals = migrated.animals.map((animal) => rename[animal] || animal);
    migrated.entries.forEach((entry) => { entry.animal = rename[entry.animal] || entry.animal; entry.trait ||= ''; entry.eland = Boolean(entry.eland); entry.notes ||= ''; });
    migrated.inventory.forEach((item) => { item.animal = rename[item.animal] || item.animal; item.trait ||= ''; item.eland = Boolean(item.eland); item.notes ||= ''; });
    const assigned = new Set();
    migrated.inventory = migrated.inventory.reduce((items, item) => {
      const source = migrated.entries.find((entry) => entry.id === item.scheduleEntryId && !assigned.has(entry.id)) || migrated.entries.find((entry) => !assigned.has(entry.id) && entry.animal === item.animal && entry.type === item.type && entry.trait === item.trait && entry.scheduleAt === item.scheduleAt && entry.eland === item.eland && entry.notes === item.notes);
      if (!source || !item.character) return items;
      assigned.add(source.id); items.push({ id: item.id || `inventory-${source.id}`, scheduleEntryId: source.id, character: item.character }); return items;
    }, []);
    migrated.animals = [...new Set(migrated.animals.filter((animal) => animal !== 'Ewe' && animal !== 'Ram' && animal !== 'Doe'))];
    if (!migrated.animals.includes('Deer')) migrated.animals.push('Deer');
    if (!migrated.animals.includes('Sheep')) migrated.animals.push('Sheep');
    return migrated;
  }
  function loadState() {
    try { const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY); return raw ? migrate(JSON.parse(raw)) : clone(defaults); } catch { return clone(defaults); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function newId(prefix) { return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
  function compareText(a, b) { return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }); }
  function readableDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('fr-CA', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).replace(',', '') : '—'; }
  function inputDate(value) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''; }
  function nowInputDate() { return inputDate(new Date().toISOString()); }
  function isBreedReady(entry) { return Boolean(entry.scheduleAt) && Date.now() >= new Date(entry.scheduleAt).getTime() + (24 * 60 * 60 * 1000); }
  function setStatus(message = '', type = '') { const target = byId('form-status'); target.textContent = message; target.dataset.state = type; }
  function animalHue(animal) { const index = Math.max(0, state.animals.indexOf(animal)); return String(Math.round((index * 360 / Math.max(state.animals.length, 1) + 155) % 360)); }
  function paintAnimal(element, animal) { element.textContent = animal; element.style.setProperty('--animal-hue', animalHue(animal)); }
  function selectOptions(values, selected, firstLabel = '') { return `<option value="">${firstLabel}</option>${values.map((value) => `<option value="${escapeAttribute(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}`; }
  function escapeHtml(value) { const holder = document.createElement('span'); holder.textContent = value ?? ''; return holder.innerHTML; }
  function escapeAttribute(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function renderSelect(select, values, placeholder, selected = select.value) { select.innerHTML = selectOptions(values, selected, placeholder); }
  function renderSelects() {
    renderSelect(fields.character, state.characters, 'Choose a character'); renderSelect(fields.animal, state.animals, 'Choose an animal'); renderSelect(fields.type, state.types, 'Choose a type');
    renderSelect(filters.character, state.characters, 'All characters', view.filters.character); renderSelect(filters.animal, state.animals, 'All animals', view.filters.animal); renderSelect(filters.type, state.types, 'All types', view.filters.type); renderSelect(filters.trait, ['', 'TH', 'Perfect', 'Production'], 'All traits', view.filters.trait);
    renderSelect(byId('card-character'), state.characters, 'Choose a character', fields.character.value);
  }
  function visibleEntries() {
    const query = view.search.trim().toLocaleLowerCase();
    const filtered = state.entries.filter((entry) => {
      const matchesText = !query || [entry.character, entry.animal, entry.type, entry.trait, entry.notes, readableDate(entry.scheduleAt), entry.eland ? 'eland eternaland' : 'scenario'].join(' ').toLocaleLowerCase().includes(query);
      return matchesText && Object.entries(view.filters).every(([key, value]) => !value || entry[key] === value);
    });
    return filtered.sort((left, right) => { const value = view.sort.key === 'scheduleAt' ? new Date(left.scheduleAt || 0) - new Date(right.scheduleAt || 0) : compareText(left[view.sort.key], right[view.sort.key]); return view.sort.direction === 'asc' ? value : -value; });
  }
  function makeInlineSelect(values, selected, field) { const select = document.createElement('select'); select.dataset.inlineField = field; select.innerHTML = selectOptions(values, selected, field === 'trait' ? 'No trait' : ''); return select; }
  function makeInlineInput(value, field, type = 'text') { const input = document.createElement(type === 'notes' ? 'textarea' : 'input'); input.dataset.inlineField = field; if (input.tagName === 'TEXTAREA') { input.value = value || ''; input.rows = 2; } else { input.type = type; input.value = value || ''; if (type === 'datetime-local') { input.lang = 'fr-CA'; input.step = '60'; } } return input; }
  function makeInlineDateControl(value) { const wrap = document.createElement('span'); wrap.className = 'date-control'; const input = makeInlineInput(value, 'scheduleAt', 'datetime-local'); const now = document.createElement('button'); now.type = 'button'; now.className = 'small-action'; now.textContent = 'Now'; now.title = 'Set today and the current time'; now.addEventListener('click', () => { input.value = nowInputDate(); }); wrap.append(input, now); return wrap; }
  function renderRow(entry) {
    const row = byId('row-template').content.firstElementChild.cloneNode(true); row.dataset.id = entry.id;
    row.querySelector('.row-select').checked = Boolean(entry.selected);
    row.querySelector('[data-col="character"]').textContent = entry.character;
    const animal = row.querySelector('[data-col="animal"]'); paintAnimal(animal, entry.animal);
    row.querySelector('[data-col="type"]').textContent = entry.type; row.querySelector('[data-col="trait"]').textContent = entry.trait || '—';
    const timerCell = row.querySelector('[data-col="scheduleAt"]'); timerCell.textContent = readableDate(entry.scheduleAt);
    if (isBreedReady(entry)) { row.classList.add('breed-ready'); timerCell.insertAdjacentHTML('beforeend', '<span class="ready-label">Ready</span>'); }
    row.querySelector('[data-col="eland"]').textContent = entry.eland ? 'Yes' : '—'; row.querySelector('[data-col="notes"]').textContent = entry.notes || '—';
    row.querySelector('.row-select').addEventListener('change', (event) => { entry.selected = event.target.checked; saveState(); updateSelectionUi(); });
    row.querySelector('.edit-entry').addEventListener('click', () => beginInlineEdit(row, entry)); row.querySelector('.remove-entry').addEventListener('click', () => askToRemoveEntries([entry.id]));
    return row;
  }
  function beginInlineEdit(row, entry) {
    row.classList.add('editing'); row.querySelector('.edit-entry').hidden = true; row.querySelector('.remove-entry').hidden = true; row.querySelector('.inline-edit-actions').hidden = false;
    // Keep the existing table cells. Replacing <td> nodes with controls was the reason the row jumped out of alignment.
    const unlock = (field, element) => { const cell = row.querySelector(`[data-col="${field}"]`); cell.replaceChildren(element); };
    unlock('character', makeInlineSelect(state.characters, entry.character, 'character')); unlock('animal', makeInlineSelect(state.animals, entry.animal, 'animal')); unlock('type', makeInlineSelect(state.types, entry.type, 'type')); unlock('trait', makeInlineSelect(['', 'TH', 'Perfect', 'Production'], entry.trait, 'trait')); unlock('scheduleAt', makeInlineDateControl(inputDate(entry.scheduleAt)));
    const eland = document.createElement('input'); eland.type = 'checkbox'; eland.checked = Boolean(entry.eland); eland.dataset.inlineField = 'eland'; eland.setAttribute('aria-label', 'In Eternaland'); unlock('eland', eland); unlock('notes', makeInlineInput(entry.notes, 'notes', 'notes'));
    row.querySelector('.save-entry').addEventListener('click', () => saveInlineEdit(row, entry)); row.querySelector('.cancel-entry').addEventListener('click', renderTable);
  }
  function saveInlineEdit(row, entry) {
    row.querySelectorAll('[data-inline-field]').forEach((control) => { const key = control.dataset.inlineField; entry[key] = key === 'eland' ? control.checked : control.value; });
    if (!entry.character || !entry.animal || !entry.type) { window.alert('Character, animal, and type are required.'); return; }
    entry.scheduleAt = entry.scheduleAt ? new Date(entry.scheduleAt).toISOString() : ''; saveState(); renderTable(); renderInventory();
  }
  function renderTable() {
    const entries = visibleEntries(); const body = byId('schedule-body'); body.replaceChildren(); entries.forEach((entry) => body.append(renderRow(entry)));
    const filtered = Boolean(view.search || Object.values(view.filters).some(Boolean)); const empty = byId('empty-state');
    empty.hidden = entries.length > 0 || !filtered;
    if (filtered && !entries.length) empty.innerHTML = '<strong>No matching schedule entries.</strong><span>Clear the search or filters to see the full queue.</span>';
    byId('entry-count').textContent = String(entries.length); const allSelected = entries.length > 0 && entries.every((entry) => entry.selected); byId('select-all').checked = allSelected; byId('select-all').indeterminate = entries.some((entry) => entry.selected) && !allSelected;
    const applied = Object.values(view.filters).filter(Boolean).length; byId('filter-count').hidden = !applied; byId('filter-count').textContent = String(applied);
    byId('reset-sort').disabled = view.sort.key === 'scheduleAt' && view.sort.direction === 'asc';
    document.querySelectorAll('[data-sort]').forEach((button) => { const active = button.dataset.sort === view.sort.key; button.dataset.direction = active ? view.sort.direction : ''; button.setAttribute('aria-sort', active ? (view.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'); }); updateSelectionUi();
  }
  function updateSelectionUi() { const count = state.entries.filter((entry) => entry.selected).length; byId('selection-count').textContent = count ? `${count} ${count === 1 ? 'entry' : 'entries'} selected` : 'No entries selected'; byId('remove-selected').disabled = !count; byId('add-to-card').disabled = !count; }
  function resetForm() { form.reset(); fields.scheduleAt.value = ''; fields.eland.checked = false; fields.trait.value = ''; fields.notes.value = ''; autoResizeNotes(); }
  function autoResizeNotes() { fields.notes.style.height = 'auto'; fields.notes.style.height = `${Math.max(44, fields.notes.scrollHeight)}px`; }
  function saveSchedule() {
    if (!form.reportValidity()) { setStatus('Complete Character, Animal, and Type before adding the schedule.', 'error'); return; }
    state.entries.push({ id: newId('entry'), character: fields.character.value, animal: fields.animal.value, type: fields.type.value, trait: fields.trait.value, scheduleAt: fields.scheduleAt.value ? new Date(fields.scheduleAt.value).toISOString() : '', eland: fields.eland.checked, notes: fields.notes.value.trim(), selected: false }); saveState(); renderTable(); resetForm(); setStatus('Schedule entry added.', 'success');
  }
  function askToRemoveEntries(ids) { pendingConfirmation = () => { state.entries = state.entries.filter((entry) => !ids.includes(entry.id)); state.inventory = state.inventory.filter((item) => !ids.includes(item.scheduleEntryId)); saveState(); renderTable(); renderInventory(); }; byId('confirm-title').textContent = ids.length === 1 ? 'Remove schedule entry?' : `Remove ${ids.length} schedule entries?`; byId('confirm-message').textContent = 'This cannot be undone.'; byId('confirm-action').textContent = 'Remove'; byId('confirm-dialog').showModal(); }
  function askToClear() { if (!state.entries.length) return; pendingConfirmation = () => { state.entries = []; state.inventory = []; saveState(); renderTable(); renderInventory(); }; byId('confirm-title').textContent = 'Clear the breeding schedule?'; byId('confirm-message').textContent = 'Every schedule entry will be removed. This cannot be undone.'; byId('confirm-action').textContent = 'Clear'; byId('confirm-dialog').showModal(); }

  function openManager(key) { activeListKey = key; const label = { characters: 'characters', animals: 'animals', types: 'types' }[key]; byId('manager-title').textContent = `Manage ${label}`; byId('manager-help').textContent = key === 'animals' ? 'Add, rename, remove, or reorder animals. The displayed order is the pulldown order.' : `Add, rename, or remove ${label}.`; byId('new-list-item').value = ''; renderManagerList(); byId('manager-dialog').showModal(); }
  function moveListItem(index, direction) { const destination = index + direction; if (destination < 0 || destination >= state[activeListKey].length) return; [state[activeListKey][index], state[activeListKey][destination]] = [state[activeListKey][destination], state[activeListKey][index]]; saveState(); renderSelects(); renderManagerList(); }
  function renderManagerList() {
    const list = byId('manager-list'); list.replaceChildren(); state[activeListKey].forEach((item, index) => { const row = document.createElement('div'); row.className = 'manager-item';
      if (activeListKey === 'animals') { const controls = document.createElement('span'); const up = document.createElement('button'); up.className = 'small-action reorder-button'; up.textContent = '↑'; up.type = 'button'; up.disabled = index === 0; up.addEventListener('click', () => moveListItem(index, -1)); const down = document.createElement('button'); down.className = 'small-action reorder-button'; down.textContent = '↓'; down.type = 'button'; down.disabled = index === state[activeListKey].length - 1; down.addEventListener('click', () => moveListItem(index, 1)); controls.append(up, down); row.append(controls); } else { const spacer = document.createElement('span'); row.append(spacer); }
      const input = document.createElement('input'); input.value = item; const save = document.createElement('button'); save.className = 'small-action'; save.type = 'button'; save.textContent = 'Save'; const remove = document.createElement('button'); remove.className = 'small-action remove'; remove.type = 'button'; remove.textContent = 'Remove'; save.addEventListener('click', () => renameListItem(index, input.value)); remove.addEventListener('click', () => removeListItem(index)); row.append(input, save, remove); list.append(row); });
  }
  function addListItem() { const input = byId('new-list-item'); const value = input.value.trim(); if (!value) return; if (state[activeListKey].some((item) => item.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0)) { input.setCustomValidity('That item already exists.'); input.reportValidity(); input.setCustomValidity(''); return; } state[activeListKey].push(value); saveState(); renderSelects(); renderManagerList(); input.value = ''; }
  function renameListItem(index, raw) { const value = raw.trim(); if (!value) return; const previous = state[activeListKey][index]; state[activeListKey][index] = value; const field = activeListKey.slice(0, -1); state.entries.forEach((entry) => { if (entry[field] === previous) entry[field] = value; }); state.inventory.forEach((entry) => { if (entry[field] === previous) entry[field] = value; }); saveState(); renderSelects(); renderManagerList(); renderTable(); renderInventory(); }
  function removeListItem(index) { if (state[activeListKey].length <= 1) { window.alert('Keep at least one item in this list.'); return; } state[activeListKey].splice(index, 1); saveState(); renderSelects(); renderManagerList(); renderTable(); }

  function openCardDialog() {
    cardQueue = state.entries.filter((entry) => entry.selected);
    if (!cardQueue.length) return;
    byId('apply-all-cards').checked = true;
    renderCardStep();
  }
  function renderCardStep() {
    const entry = cardQueue[0];
    if (!entry) { state.entries.forEach((item) => item.selected = false); saveState(); renderTable(); renderInventory(); switchTab('inventory'); return; }
    renderSelect(byId('card-character'), state.characters, 'Choose a character', fields.character.value || entry.character);
    const applyAll = byId('apply-all-cards').checked;
    byId('apply-all-label').hidden = cardQueue.length < 2;
    byId('card-title').textContent = applyAll ? 'Add selected animals to card' : `Add ${entry.animal} to card`;
    byId('card-message').textContent = applyAll ? `${cardQueue.length} selected animals will be assigned to this character card. Existing assignments will transfer.` : `${cardQueue.length} animal${cardQueue.length === 1 ? '' : 's'} remaining. Choose a character for this one.`;
    byId('card-dialog').showModal();
  }
  function assignToInventory(entry, character) { const existing = state.inventory.find((item) => item.scheduleEntryId === entry.id); if (existing) existing.character = character; else state.inventory.push({ id: newId('inventory'), scheduleEntryId: entry.id, character }); }
  function confirmCardStep() {
    const character = byId('card-character').value;
    if (!character) { window.alert('Choose a character card.'); return false; }
    if (byId('apply-all-cards').checked) { cardQueue.forEach((entry) => assignToInventory(entry, character)); cardQueue = []; }
    else { assignToInventory(cardQueue.shift(), character); }
    return true;
  }
  function renderInventory() {
    const container = byId('inventory-cards'); container.replaceChildren();
    const assignments = state.inventory.map((assignment) => ({ assignment, entry: state.entries.find((entry) => entry.id === assignment.scheduleEntryId) })).filter(({ entry }) => entry);
    const characters = state.characters.filter((character) => assignments.some(({ assignment }) => assignment.character === character));
    characters.forEach((character) => { const card = document.createElement('article'); card.className = 'character-card'; card.innerHTML = `<h3>${escapeHtml(character)}</h3>`; [false, true].forEach((eland) => { const section = document.createElement('section'); section.className = 'inventory-section'; const animals = assignments.filter(({ assignment, entry }) => assignment.character === character && entry.eland === eland); section.innerHTML = `<div class="inventory-section-title"><span>${eland ? 'Eternaland' : 'Scenario'}</span><span>${animals.length}</span></div>`; if (!animals.length) section.insertAdjacentHTML('beforeend', '<p class="empty-inventory-section">No animals.</p>'); animals.forEach(({ assignment, entry }) => { const row = document.createElement('div'); row.className = 'inventory-row'; const notes = entry.notes ? `<span class="info-dot" title="${escapeAttribute(entry.notes)}">i</span>` : ''; row.innerHTML = `<div><span class="animal-badge" style="--animal-hue:${animalHue(entry.animal)}">${escapeHtml(entry.animal)}</span><div class="inventory-detail"><span>${escapeHtml(readableDate(entry.scheduleAt))}</span><span>${escapeHtml(entry.type)}</span>${entry.trait ? `<span>${escapeHtml(entry.trait)}</span>` : ''}${notes}</div></div><button class="inventory-remove" type="button" aria-label="Remove ${escapeAttribute(entry.animal)} from ${escapeAttribute(character)}">×</button>`; row.querySelector('.inventory-remove').addEventListener('click', () => { state.inventory = state.inventory.filter((item) => item.id !== assignment.id); saveState(); renderInventory(); }); section.append(row); }); card.append(section); }); container.append(card); }); byId('inventory-empty').hidden = assignments.length > 0; byId('inventory-count').textContent = String(assignments.length);
  }
  function switchTab(tab) { view.tab = tab; document.querySelectorAll('.tab-button').forEach((button) => { const active = button.dataset.tab === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); byId('schedule-view').hidden = tab !== 'schedule'; byId('inventory-view').hidden = tab !== 'inventory'; }
  function clearFilters() { view.search = ''; byId('schedule-search').value = ''; Object.keys(view.filters).forEach((key) => view.filters[key] = ''); renderSelects(); renderTable(); }
  function renderAll() { renderSelects(); renderTable(); renderInventory(); autoResizeNotes(); }
  function exportData() { const payload = { app: 'Once Human Animal Breeding Schedule', version: 3, exportedAt: new Date().toISOString(), state: clone(state) }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `once-human-breeding-schedule-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); }
  function importData(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const payload = JSON.parse(reader.result); const imported = migrate(payload?.state || payload); if (!Array.isArray(imported.entries) || !Array.isArray(imported.inventory)) throw new Error('missing schedule data'); pendingConfirmation = () => { state = imported; saveState(); renderAll(); setStatus('Backup imported. Your previous browser data was replaced.', 'success'); }; byId('confirm-title').textContent = 'Replace all schedule data?'; byId('confirm-message').textContent = 'Import replaces the current schedule, cards, and lists. Export first if you need a copy.'; byId('confirm-action').textContent = 'Import and replace'; byId('confirm-dialog').showModal(); } catch { window.alert('That file is not a valid breeding schedule backup.'); } finally { byId('import-file').value = ''; } }; reader.readAsText(file); }

  form.addEventListener('submit', (event) => { event.preventDefault(); saveSchedule(); }); fields.notes.addEventListener('input', autoResizeNotes); byId('set-schedule-now').addEventListener('click', () => { fields.scheduleAt.value = nowInputDate(); }); byId('export-data').addEventListener('click', exportData); byId('import-data').addEventListener('click', () => byId('import-file').click()); byId('import-file').addEventListener('change', (event) => importData(event.target.files[0])); byId('clear-table').addEventListener('click', askToClear); byId('remove-selected').addEventListener('click', () => askToRemoveEntries(state.entries.filter((entry) => entry.selected).map((entry) => entry.id))); byId('add-to-card').addEventListener('click', openCardDialog);
  byId('confirm-dialog').addEventListener('close', () => { if (byId('confirm-dialog').returnValue === 'confirm' && pendingConfirmation) pendingConfirmation(); pendingConfirmation = null; });
  byId('card-dialog').addEventListener('close', () => {
    if (byId('card-dialog').returnValue !== 'confirm') { cardQueue = []; return; }
    if (!confirmCardStep()) { cardQueue = []; return; }
    saveState();
    setTimeout(renderCardStep, 0);
  });
  byId('reset-sort').addEventListener('click', () => { view.sort = { key: 'scheduleAt', direction: 'asc' }; renderTable(); });
  byId('apply-all-cards').addEventListener('change', () => { if (byId('card-dialog').open) { byId('card-title').textContent = byId('apply-all-cards').checked ? 'Add selected animals to card' : `Add ${cardQueue[0]?.animal || 'animal'} to card`; } });
  byId('select-all').addEventListener('change', (event) => { visibleEntries().forEach((entry) => entry.selected = event.target.checked); saveState(); renderTable(); }); byId('schedule-search').addEventListener('input', (event) => { view.search = event.target.value; renderTable(); }); byId('filter-toggle').addEventListener('click', () => { const open = byId('filter-panel').hidden; byId('filter-panel').hidden = !open; byId('filter-toggle').setAttribute('aria-expanded', String(open)); }); byId('clear-filters').addEventListener('click', clearFilters); Object.values(filters).forEach((select) => select.addEventListener('change', () => { view.filters[select.dataset.filter] = select.value; renderTable(); })); document.querySelectorAll('[data-sort]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.sort; view.sort.direction = view.sort.key === key && view.sort.direction === 'asc' ? 'desc' : 'asc'; view.sort.key = key; renderTable(); })); document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab))); document.querySelectorAll('[data-manage]').forEach((button) => button.addEventListener('click', () => openManager(button.dataset.manage))); byId('add-list-item').addEventListener('click', addListItem); byId('new-list-item').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addListItem(); } });
  renderSelects(); renderTable(); renderInventory(); autoResizeNotes(); saveState();
})();
