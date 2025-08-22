#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const limitsPath = path.resolve(__dirname, '..', 'GAS_LIMITS.md');
const reportPath = path.resolve(__dirname, '..', 'gas-report.txt');

function parseLimits(text) {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
  const map = {};
  for (const line of lines.slice(2)) {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [fn, limit] = parts;
      map[fn] = Number(limit);
    }
  }
  return map;
}

function parseReport(text) {
  const map = {};
  const regex = /\|\s*FarmGame\s*·\s*([\w\d_]+)\s*·\s*(\d+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, fn, gas] = match;
    map[fn] = Number(gas);
  }
  return map;
}

if (!fs.existsSync(reportPath)) {
  console.error('gas-report.txt not found');
  process.exit(1);
}

const limits = parseLimits(fs.readFileSync(limitsPath, 'utf8'));
const report = parseReport(fs.readFileSync(reportPath, 'utf8'));

const failures = [];
for (const [fn, limit] of Object.entries(limits)) {
  const used = report[fn];
  if (typeof used !== 'number') continue;
  if (used > limit) {
    failures.push(`${fn} used ${used} gas (limit ${limit})`);
  }
}

if (failures.length) {
  console.error('Gas limits exceeded:\n' + failures.join('\n'));
  process.exit(1);
} else {
  console.log('Gas usage within limits');
}
