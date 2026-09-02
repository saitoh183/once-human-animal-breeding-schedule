(() => {
  'use strict';

  const STORAGE_KEY = 'once-human-animal-breeding-schedule-v1';
  const defaults = {
    characters: ['Main Character'],
    // Seeded from the Ranching reference. The list manager is the source of truth after first load.
    animals: ['Bear', 'Boar', 'Capybara', 'Crocodile', 'Deer', 'Doe', 'Ewe', 'Flamingo', 'Fox', 'Leopard', 'Rabbit', 'Ram', 'Sea Turtle', 'Snow Fox', 'Wild Buffalo', 'Wolf'],
    types: ['Regular', 'Rare', 'Original', 'Phantom'],
    entries: []
  };

  const byId = (id) => document.getElementById(id);
  const form = byId('schedule-form');
  const formStatus = byId('form-status');
  const fields = { character: byId('character'), animal: byId('animal'), type: byId('type'), scheduleAt: byId('schedule-at'), notes: byId('notes') };
  const state = loadState();
  let editingId = null;
  let pendingConfirmation = null;
  let activeListKey = null;

  function cloneDefaults() { return JSON.parse(JSON.stringify(defaults)); }
  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || typeof stored !== 'object') return cloneDefaults();
      return {
        characters: normaliseList(stored.characters, defaults.characters),
        animals: normaliseList(stored.animals, defaults.animals),
        types: normaliseList(stored.types, defaults.types),
        entries: Array.isArray(stored.entries) ? stored.entries : []
      };
    } catch { return cloneDefaults(); }
  }
  function normaliseList(value, fallback) {
    return Array.isArray(value) && value.length ? [...new Set(value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))] : [...fallback];
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function newEntryId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function setFormStatus(message = '', stateName = '') {
    formStatus.textContent = message;
    formStatus.dataset.state = stateName;
  }
  function readableDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function toLocalInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
  function selectedTrait() { return document.querySelector('input[name="trait"]:checked').value; }
  function setTrait(trait) { const input = document.querySelector(`input[name="trait"][value="${CSS.escape(trait)}"]`); if (input) input.checked = true; }

  function renderSelect(select, values, placeholder) {
    const current = select.value;
    select.replaceChildren();
    const initial = new Option(placeholder, ''); initial.disabled = true; initial.selected = !values.includes(current); select.add(initial);
    values.forEach((value) => select.add(new Option(value, value, false, value === current)));
  }
  function renderSelects() {
    renderSelect(fields.character, state.characters, 'Choose a character');
    renderSelect(fields.animal, state.animals, 'Choose an animal');
    renderSelect(fields.type, state.types, 'Choose a type');
  }
  function renderTable() {
    const body = byId('schedule-body');
    const template = byId('row-template');
    body.replaceChildren();
    const entries = [...state.entries].sort((a, b) => new Date(a.scheduleAt) - new Date(b.scheduleAt));
    entries.forEach((entry) => {
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.id = entry.id;
      row.querySelector('.row-select').checked = Boolean(entry.selected);
      ['character', 'animal', 'type', 'trait'].forEach((key) => row.querySelector(`[data-col="${key}"]`).textContent = entry[key]);
      row.querySelector('[data-col="scheduleAt"]').textContent = readableDate(entry.scheduleAt);
      row.querySelector('[data-col="notes"]').textContent = entry.notes || '—';
      row.querySelector('.row-select').addEventListener('change', (event) => { entry.selected = event.target.checked; saveState(); updateSelectionUi(); });
      row.querySelector('.edit-entry').addEventListener('click', () => editEntry(entry.id));
      row.querySelector('.remove-entry').addEventListener('click', () => askToRemove([entry.id]));
      body.append(row);
    });
    byId('empty-state').hidden = entries.length !== 0;
    byId('entry-count').textContent = String(entries.length);
    byId('select-all').checked = entries.length > 0 && entries.every((entry) => entry.selected);
    byId('select-all').indeterminate = entries.some((entry) => entry.selected) && !byId('select-all').checked;
    updateSelectionUi();
  }
  function updateSelectionUi() {
    const selected = state.entries.filter((entry) => entry.selected).length;
    byId('selection-count').textContent = selected ? `${selected} ${selected === 1 ? 'entry' : 'entries'} selected` : 'No entries selected';
    byId('remove-selected').disabled = selected === 0;
  }
  function autoResizeNotes() { fields.notes.style.height = 'auto'; fields.notes.style.height = `${Math.max(44, fields.notes.scrollHeight)}px`; }
  function resetForm() {
    editingId = null;
    form.reset();
    fields.scheduleAt.value = '';
    fields.notes.value = '';
    setFormStatus();
    byId('submit-entry').textContent = 'Add schedule';
    byId('cancel-edit').hidden = true;
    autoResizeNotes();
  }
  function editEntry(id) {
    const entry = state.entries.find((item) => item.id === id); if (!entry) return;
    editingId = id;
    renderSelects();
    fields.character.value = entry.character; fields.animal.value = entry.animal; fields.type.value = entry.type;
    fields.scheduleAt.value = toLocalInput(entry.scheduleAt); fields.notes.value = entry.notes || ''; setTrait(entry.trait);
    byId('submit-entry').textContent = 'Save changes'; byId('cancel-edit').hidden = false; autoResizeNotes();
    document.querySelector('.entry-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    fields.character.focus();
  }
  function upsertEntry() {
    if (!form.reportValidity()) {
      const missingField = [...form.elements].find((element) => typeof element.checkValidity === 'function' && !element.checkValidity());
      setFormStatus(`Complete ${missingField?.closest('label, fieldset')?.firstChild?.textContent?.trim() || 'the required fields'} before adding the schedule.`, 'error');
      return;
    }
    const entry = { id: editingId || newEntryId(), character: fields.character.value, animal: fields.animal.value, type: fields.type.value, trait: selectedTrait(), scheduleAt: new Date(fields.scheduleAt.value).toISOString(), notes: fields.notes.value.trim(), selected: false };
    if (editingId) { const index = state.entries.findIndex((item) => item.id === editingId); if (index !== -1) state.entries[index] = { ...entry, selected: state.entries[index].selected }; }
    else state.entries.push(entry);
    saveState(); renderTable();
    setFormStatus(editingId ? 'Schedule entry updated.' : 'Schedule entry added.', 'success');
    editingId = null;
    form.reset();
    fields.scheduleAt.value = '';
    fields.notes.value = '';
    byId('submit-entry').textContent = 'Add schedule';
    byId('cancel-edit').hidden = true;
    autoResizeNotes();
  }
  function askToRemove(ids) {
    pendingConfirmation = () => { state.entries = state.entries.filter((entry) => !ids.includes(entry.id)); saveState(); renderTable(); if (ids.includes(editingId)) resetForm(); };
    byId('confirm-title').textContent = ids.length === 1 ? 'Remove schedule entry?' : `Remove ${ids.length} schedule entries?`;
    byId('confirm-message').textContent = ids.length === 1 ? 'This schedule entry will be removed. This cannot be undone.' : 'The selected schedule entries will be removed. This cannot be undone.';
    byId('confirm-dialog').showModal();
  }
  function askToClear() {
    if (!state.entries.length) return;
    pendingConfirmation = () => { state.entries = []; saveState(); renderTable(); resetForm(); };
    byId('confirm-title').textContent = 'Clear the breeding schedule?'; byId('confirm-message').textContent = 'Every schedule entry will be removed. This cannot be undone.'; byId('confirm-dialog').showModal();
  }

  function openManager(key) {
    activeListKey = key;
    const labels = { characters: 'characters', animals: 'animals', types: 'types' };
    byId('manager-title').textContent = `Manage ${labels[key]}`;
    byId('manager-help').textContent = `Add, rename, or remove ${labels[key]}. Existing schedule entries keep their saved values.`;
    byId('new-list-item').value = ''; renderManagerList(); byId('manager-dialog').showModal(); byId('new-list-item').focus();
  }
  function renderManagerList() {
    const list = byId('manager-list'); list.replaceChildren();
    state[activeListKey].forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'manager-item';
      const input = document.createElement('input'); input.value = item; input.setAttribute('aria-label', `${item} name`);
      const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'small-action'; rename.textContent = 'Save';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'small-action remove'; remove.textContent = 'Remove';
      rename.addEventListener('click', () => renameListItem(index, input.value)); remove.addEventListener('click', () => removeListItem(index));
      row.append(input, rename, remove); list.append(row);
    });
  }
  function addListItem() {
    const input = byId('new-list-item'); const value = input.value.trim();
    if (!value) return;
    if (state[activeListKey].some((item) => item.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0)) { input.setCustomValidity('That item already exists.'); input.reportValidity(); input.setCustomValidity(''); return; }
    state[activeListKey].push(value); state[activeListKey].sort((a,b) => a.localeCompare(b)); saveState(); renderSelects(); renderManagerList(); input.value = ''; input.focus();
  }
  function renameListItem(index, rawValue) {
    const value = rawValue.trim(); if (!value) return;
    const previous = state[activeListKey][index];
    if (state[activeListKey].some((item, itemIndex) => itemIndex !== index && item.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0)) return;
    state[activeListKey][index] = value;
    state.entries.forEach((entry) => { const field = activeListKey.slice(0, -1); if (entry[field] === previous) entry[field] = value; });
    saveState(); renderSelects(); renderManagerList(); renderTable();
  }
  function removeListItem(index) {
    if (state[activeListKey].length === 1) { window.alert('Keep at least one item in this list.'); return; }
    state[activeListKey].splice(index, 1); saveState(); renderSelects(); renderManagerList();
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); upsertEntry(); });
  fields.notes.addEventListener('input', autoResizeNotes);
  byId('cancel-edit').addEventListener('click', resetForm);
  document.querySelectorAll('[data-manage]').forEach((button) => button.addEventListener('click', () => openManager(button.dataset.manage)));
  byId('add-list-item').addEventListener('click', addListItem);
  byId('new-list-item').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addListItem(); } });
  byId('remove-selected').addEventListener('click', () => askToRemove(state.entries.filter((entry) => entry.selected).map((entry) => entry.id)));
  byId('clear-table').addEventListener('click', askToClear);
  byId('select-all').addEventListener('change', (event) => { state.entries.forEach((entry) => entry.selected = event.target.checked); saveState(); renderTable(); });
  byId('confirm-dialog').addEventListener('close', () => { if (byId('confirm-dialog').returnValue === 'confirm' && pendingConfirmation) pendingConfirmation(); pendingConfirmation = null; });

  renderSelects(); renderTable(); autoResizeNotes();
})();
