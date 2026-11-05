#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate.mjs <tracking/events.json>');
  process.exit(2);
}

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const snake = (value) => text(value) && /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(value);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const oneOf = (value, choices) => choices.includes(value);
const manifestPath = path.resolve(file);
let doc;
try {
  doc = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`Cannot parse manifest: ${error.message}`);
  process.exit(1);
}

if (!object(doc)) fail('$', 'must be an object');
if (doc?.schemaVersion !== 1) fail('schemaVersion', 'must be 1');
const scope = doc?.scope;
if (!object(scope)) fail('scope', 'must be an object');
for (const field of ['projectId', 'pageId', 'version']) {
  if (!text(scope?.[field]) || !/^[A-Za-z0-9_-]+$/.test(scope[field])) fail(`scope.${field}`, 'invalid ID');
}
if (!/^v\d+$/.test(scope?.version || '')) fail('scope.version', 'must look like v2');
if (!oneOf(scope?.pageMode, ['standard', 'infinite-canvas'])) fail('scope.pageMode', 'unsupported');
const expectedPath = path.join('src', 'pages', scope?.projectId || '', scope?.pageId || '', scope?.version || '', 'tracking', 'events.json');
if (!manifestPath.endsWith(path.sep + expectedPath)) fail('$', `expected location under ${expectedPath}`);
const versionDir = path.dirname(path.dirname(manifestPath));

if (!Array.isArray(doc?.events) || doc.events.length > 12) fail('events', 'must have 0..12 items');
const eventIds = new Set();
for (const [i, event] of (Array.isArray(doc?.events) ? doc.events : []).entries()) {
  const key = `events[${i}]`;
  if (!object(event)) { fail(key, 'must be an object'); continue; }
  for (const field of ['id', 'name']) if (!snake(event[field])) fail(`${key}.${field}`, 'must be snake_case');
  if (eventIds.has(event.id)) fail(`${key}.id`, 'duplicate');
  eventIds.add(event.id);
  for (const field of ['title', 'purpose', 'question', 'decision']) if (!text(event[field])) fail(`${key}.${field}`, 'required');
  const score = event.score;
  let total = 0;
  for (const [factor, max] of Object.entries({ impact: 3, actionability: 3, gap: 2, cost: 2, duplicate: 2 })) {
    const n = score?.[factor];
    if (!Number.isInteger(n) || n < 0 || n > max) fail(`${key}.score.${factor}`, `expected integer 0..${max}`);
    else total += ['cost', 'duplicate'].includes(factor) ? -n : n;
  }
  if (score?.total !== total || total < 5) fail(`${key}.score.total`, `must equal ${total}, at least 5`);
  if (event.priority !== (total >= 7 ? 'P0' : 'P1')) fail(`${key}.priority`, 'inconsistent with score');
  if (!oneOf(event.signal, ['attempt', 'outcome', 'exposure', 'error', 'engagement'])) fail(`${key}.signal`, 'unsupported');
  if (!object(event.trigger) || !oneOf(event.trigger.type, ['click', 'submit', 'view', 'result', 'error', 'change']) || !text(event.trigger.when)) fail(`${key}.trigger`, 'type and when required');

  if (!Array.isArray(event.parameters) || event.parameters.length > 5) fail(`${key}.parameters`, 'must have 0..5 items');
  const params = new Set();
  for (const [j, param] of (Array.isArray(event.parameters) ? event.parameters : []).entries()) {
    const key2 = `${key}.parameters[${j}]`;
    if (!object(param) || !snake(param.name) || !text(param.source)) fail(key2, 'name and source required');
    if (params.has(param?.name)) fail(key2, 'duplicate parameter');
    params.add(param?.name);
    if (!oneOf(param?.type, ['string', 'number', 'boolean', 'enum'])) fail(`${key2}.type`, 'unsupported');
    if (param?.type === 'enum' && (!Array.isArray(param.allowedValues) || param.allowedValues.length < 2 || param.allowedValues.length > 20 || !param.allowedValues.every(text))) fail(`${key2}.allowedValues`, 'enum needs 2..20 values');
    if (/phone|email|password|token|secret|credential|raw_?input|full_?url/i.test(param?.name || '')) fail(`${key2}.name`, 'potentially sensitive');
  }

  if (!Array.isArray(event.targets)) fail(`${key}.targets`, 'must be an array');
  for (const [j, target] of (Array.isArray(event.targets) ? event.targets : []).entries()) {
    const key2 = `${key}.targets[${j}]`;
    if (!object(target)) { fail(key2, 'must be an object'); continue; }
    if (!oneOf(target.kind, ['page', 'canvas-board'])) fail(`${key2}.kind`, 'unsupported');
    if (scope?.pageMode === 'infinite-canvas' && target.kind !== 'canvas-board') fail(`${key2}.kind`, 'must target a board iframe');
    if (scope?.pageMode === 'standard' && target.kind !== 'page') fail(`${key2}.kind`, 'must target a page iframe');
    if (target.kind === 'canvas-board' && (!text(target.boardId) || !/^[A-Za-z0-9_-]+$/.test(target.boardId))) fail(`${key2}.boardId`, 'required');
    if (target.kind === 'canvas-board' && target.path !== `boards/${target.boardId}/index.html`) fail(`${key2}.path`, 'must identify board iframe document');
    if (target.kind === 'page' && target.path !== 'index.html') fail(`${key2}.path`, 'must identify page iframe document');
    if (!text(target.path) || target.path.startsWith('/') || target.path.includes('..') || target.path.includes('://') || target.path.includes('\\')) fail(`${key2}.path`, 'unsafe relative path');
    else if (!fs.existsSync(path.join(versionDir, target.path))) fail(`${key2}.path`, 'file not found');
    if (!object(target.anchor) || !oneOf(target.anchor.method, ['data-attribute', 'selector']) || !text(target.anchor.value)) fail(`${key2}.anchor`, 'method/value required');
    if (target.anchor?.method === 'data-attribute' && !/^[a-z][a-z0-9-]*$/.test(target.anchor.value)) fail(`${key2}.anchor.value`, 'invalid token');
    if (!oneOf(target.confidence, ['high', 'medium', 'low'])) fail(`${key2}.confidence`, 'unsupported');
    if (!oneOf(target.status, ['bound', 'needs_review'])) fail(`${key2}.status`, 'unsupported');
    if (target.confidence === 'low' && target.status !== 'needs_review') fail(`${key2}.status`, 'low confidence must be needs_review');
  }
}
if (!Array.isArray(doc?.omitted)) fail('omitted', 'must be an array');
for (const [i, rejected] of (Array.isArray(doc?.omitted) ? doc.omitted : []).entries()) {
  if (!text(rejected?.candidate) || !text(rejected?.reason)) fail(`omitted[${i}]`, 'candidate and reason required');
}

if (errors.length) {
  console.error(`Invalid tracking manifest (${errors.length}):\n${errors.map(error => ' - ' + error).join('\n')}`);
  process.exit(1);
}
console.log(`Valid tracking manifest: ${doc.events.length} event(s), ${doc.omitted.length} rejected candidate(s)`);
