#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const contracts = [
  [html, ['lang="fr-CA"', 'id="reset-sort"', 'id="apply-all-cards"', 'id="inventory-cards"', 'id="schedule-at" type="datetime-local" lang="fr-CA"', 'id="empty-state" class="empty-state" hidden'], 'HTML'],
  [script, ['hourCycle: \'h23\'', 'isBreedReady', 'breed-ready', 'animalHue', 'paintAnimal', 'cardQueue', 'confirmCardStep', 'apply-all-cards', 'reset-sort', 'cell.replaceChildren(element)'], 'app.js'],
  [css, ['font-size:17px', 'character-card', 'breed-ready', '--animal-hue', 'table-layout:fixed', '.inline-edit-actions[hidden]{display:none}', '@media'], 'styles.css']
];
for (const [content, labels, kind] of contracts) for (const label of labels) if (!content.includes(label)) throw new Error(`${kind} is missing: ${label}`);
if (html.includes('No breeding checks scheduled.')) throw new Error('Deprecated empty-table message remains in the UI.');
if (css.includes('.table-wrap{max-height') || css.includes('.table-wrap{overflow:auto')) throw new Error('Nested table scrolling reintroduced.');
console.log('Static UI contract passed: readable layout, 24-hour display, unique animal hues, ready timers, default-sort reset, and multi-card assignment flow.');
