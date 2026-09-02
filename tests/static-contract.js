#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

const requiredHtml = ['id="character"', 'id="animal"', 'id="type"', 'name="trait"', 'type="datetime-local"', 'id="notes"', 'id="schedule-body"', 'id="remove-selected"', 'id="manager-dialog"', 'id="confirm-dialog"'];
const requiredScript = ['localStorage', 'crypto.randomUUID()', 'askToRemove', 'editEntry', 'openManager', "'Bear'", "'Wild Buffalo'", "'Wolf'", 'Intl.DateTimeFormat'];
const requiredCss = ['position:sticky', 'textarea', 'overflow:hidden', '--cyan', '@media'];

for (const [content, labels, kind] of [[html, requiredHtml, 'HTML'], [script, requiredScript, 'app.js'], [css, requiredCss, 'styles.css']]) {
  for (const label of labels) {
    if (!content.includes(label)) throw new Error(`${kind} is missing required contract: ${label}`);
  }
}
console.log('Static UI contract passed: form controls, management, confirmation, persistence, roster, and sticky-header styling present.');
