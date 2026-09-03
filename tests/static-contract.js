#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

const contracts = [
  [html, ['id="trait"', 'id="eland"', 'id="schedule-search"', 'id="filter-toggle"', 'id="add-to-card"', 'data-tab="inventory"', 'id="inventory-cards"', 'id="card-dialog"', 'class="inline-edit-actions"'], 'HTML'],
  [script, ['once-human-animal-breeding-schedule-v2', 'LEGACY_KEY', "'Ewe': 'Deer'", "'Ram': 'Sheep'", 'beginInlineEdit', 'saveInlineEdit', 'openCardDialog', 'addToCard', 'renderInventory', 'moveListItem', 'hour12: false'], 'app.js'],
  [css, ['animal-badge', 'inventory-cards', 'inline-edit-actions', 'table-wrap{border', 'filter-panel', '@media'], 'styles.css']
];
for (const [content, labels, kind] of contracts) for (const label of labels) if (!content.includes(label)) throw new Error(`${kind} is missing: ${label}`);
if (css.includes('.table-wrap{max-height') || css.includes('.table-wrap{overflow:auto')) throw new Error('Nested table scrolling reintroduced.');
console.log('Static UI contract passed: migration, optional calendar, Eland, inline edits, cards, filtering, ordering, and no desktop nested table scroll.');
