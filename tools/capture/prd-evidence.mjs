#!/usr/bin/env node
import fs from 'node:fs/promises';
import { getWorkspaceRoot } from '../../server/workspace.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = getWorkspaceRoot();
const DEVICE_PROFILES = {
  'iphone-17': {
    label: 'iPhone 17 inner screen',
    viewport: { width: 490, height: 900 },
    deviceScaleFactor: 3,
    isMobile: false,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    captureSelector: '.phone-screen',
  },
  iphone17: {
    label: 'iPhone 17 inner screen',
    viewport: { width: 490, height: 900 },
    deviceScaleFactor: 3,
    isMobile: false,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    captureSelector: '.phone-screen',
  },
  'iphone-17-pro': {
    label: 'iPhone 17 Pro inner screen',
    viewport: { width: 490, height: 900 },
    deviceScaleFactor: 3,
    isMobile: false,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    captureSelector: '.phone-screen',
  },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function getDeviceProfile(value) {
  const key = String(value || 'iphone-17').trim().toLowerCase();
  return DEVICE_PROFILES[key] || DEVICE_PROFILES['iphone-17'];
}

function parseViewport(value, fallback = DEVICE_PROFILES['iphone-17'].viewport) {
  if (!value) return { ...fallback };
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid viewport "${value}". Use WIDTHxHEIGHT, for example 390x844.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function safeName(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function resolveFromRepoRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

function defaultOutDir(pageDir) {
  const pageRoot = path.dirname(pageDir);
  return path.join(pageRoot, 'docs', 'prd-assets');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function waitForUserConfirmation(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await rl.question(message);
  rl.close();
}

function printUsage() {
  console.error([
    'Usage:',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --shot-name feature-1-settings',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --feature "背景图调整" --shot-name feature-1-background',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --annotation 2 --shot-name feature-2',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --selector "#backgroundEditorPreview" --shot-name feature-editor',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --feature "背景乐" --actions "click:更多;click:背景乐"',
    '  npm --prefix .claude/skills/generate-business-prd run capture -- --page-dir src/pages/reader/v9 --feature "更多设置" --actions "click:Aa;click:更多设置" --capture-steps --shot-name feature-more-settings',
    '  npm --prefix .claude/skills/generate-business-prd run capture:confirm -- --page-dir src/pages/reader/v9 --feature "背景乐" --shot-name feature-1',
    '  npm --prefix .claude/skills/generate-business-prd run capture:evidence -- --page-dir src/pages/reader/v9',
    '  node tools/capture/prd-evidence.mjs --page-dir src/pages/reader/v9 --list-targets',
  ].join('\n'));
}

function annotationText(annotation) {
  return normalizeText([
    annotation?.id,
    annotation?.description,
    annotation?.selector,
    annotation?.meta?.textContent,
    annotation?.meta?.ariaLabel,
    annotation?.meta?.title,
    annotation?.meta?.id,
    annotation?.meta?.className,
  ].filter(Boolean).join(' '));
}

function tokenize(value) {
  const normalized = normalizeText(value)
    .replace(/[，。、“”‘’：:；;,.!?！？()[\]{}<>《》|/\\_-]+/g, ' ')
    .replace(/(支持|如果|以及|或者|并且|然后|这里|用户|可以|需要|点击|新增|功能|入口|进行|调整|设置|显示|文案|大小|这个|这个|页面|界面)/g, ' ');
  const raw = normalized.match(/[\u4e00-\u9fa5A-Za-z0-9]+/g) || [];
  const terms = [];
  for (const item of raw) {
    if (item.length < 2) continue;
    terms.push(item);
    if (/^[\u4e00-\u9fa5]{7,}$/.test(item)) {
      for (let size = 4; size <= Math.min(8, item.length); size += 1) {
        for (let i = 0; i <= item.length - size; i += 1) {
          terms.push(item.slice(i, i + size));
        }
      }
    }
  }
  return [...new Set(terms)].slice(0, 40);
}

function scoreAnnotation(annotation, query) {
  const haystack = annotationText(annotation).toLowerCase();
  const queryText = normalizeText(query).toLowerCase();
  if (!queryText) return 0;
  if (annotation?.id && annotation.id.toLowerCase() === queryText) return 1000;
  if (annotation?.description && normalizeText(annotation.description).toLowerCase() === queryText) return 900;
  if (annotation?.meta?.textContent && normalizeText(annotation.meta.textContent).toLowerCase().includes(queryText)) return 700;
  if (haystack.includes(queryText)) return 500 + Math.min(queryText.length, 100);
  let score = 0;
  for (const term of tokenize(queryText)) {
    if (haystack.includes(term.toLowerCase())) score += Math.min(80, term.length * 8);
  }
  return score;
}

function annotationByOrdinal(annotations, value) {
  const raw = normalizeText(value);
  const match = raw.match(/^(?:a|ann|annotation|功能|feature)?\s*0*(\d+)$/i);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10) - 1;
  return annotations[index] || null;
}

function resolveTarget(args, annotations) {
  const selector = args.selector || args['target-selector'];
  const text = args.text || args['target-text'];
  const annotationArg = args.annotation || args['annotation-id'];
  const featureArg = args.feature || args.target;

  if (selector) {
    return {
      source: 'selector',
      selector,
      name: normalizeText(args.feature || args.target || selector),
      searchTexts: [args.feature, args.target, selector].filter(Boolean),
    };
  }

  if (text) {
    return {
      source: 'text',
      text,
      name: normalizeText(args.feature || args.target || text),
      searchTexts: [text, args.feature, args.target].filter(Boolean),
    };
  }

  if (annotationArg) {
    const byOrdinal = annotationByOrdinal(annotations, annotationArg);
    const annotation = byOrdinal || annotations.find((item) => item.id === annotationArg);
    if (!annotation) {
      throw new Error(`Cannot find annotation "${annotationArg}". Run with --list-targets to inspect available targets.`);
    }
    return targetFromAnnotation(annotation, annotations.indexOf(annotation) + 1, 'annotation');
  }

  if (featureArg) {
    const byOrdinal = annotationByOrdinal(annotations, featureArg);
    if (byOrdinal) return targetFromAnnotation(byOrdinal, annotations.indexOf(byOrdinal) + 1, 'feature-number');

    const ranked = annotations
      .map((annotation, index) => ({ annotation, index, score: scoreAnnotation(annotation, featureArg) }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]?.score > 0) {
      return targetFromAnnotation(ranked[0].annotation, ranked[0].index + 1, 'feature-query', featureArg, ranked[0].score);
    }

    return {
      source: 'feature-query',
      text: featureArg,
      name: normalizeText(featureArg),
      searchTexts: [featureArg],
    };
  }

  return null;
}

function targetFromAnnotation(annotation, number, source, query = '', score = 0) {
  const name = normalizeText(annotation.description)
    || normalizeText(annotation.meta?.textContent)
    || annotation.id
    || `annotation-${number}`;
  return {
    source,
    number,
    score,
    id: annotation.id || '',
    selector: annotation.selector || '',
    text: normalizeText(annotation.meta?.textContent || annotation.meta?.ariaLabel || annotation.description),
    name,
    query: normalizeText(query),
    annotation,
    searchTexts: [
      query,
      annotation.description,
      annotation.meta?.textContent,
      annotation.meta?.ariaLabel,
      annotation.meta?.title,
      annotation.meta?.id,
      annotation.id,
    ].filter(Boolean),
  };
}

function printTargets(annotations) {
  if (!annotations.length) {
    console.log('No annotations found.');
    return;
  }
  for (const [index, annotation] of annotations.entries()) {
    const text = normalizeText(annotation.meta?.textContent).slice(0, 80);
    const description = normalizeText(annotation.description).slice(0, 80);
    console.log([
      `A${index + 1}`,
      annotation.id ? `id=${annotation.id}` : '',
      description ? `description=${description}` : '',
      text ? `text=${text}` : '',
      annotation.selector ? `selector=${annotation.selector}` : '',
    ].filter(Boolean).join(' | '));
  }
}

function parseActionSteps(value) {
  if (!value) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('--actions JSON must be an array.');
    return parsed;
  }
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.includes(':') ? ':' : '=';
      const [type, ...rest] = item.split(separator);
      return {
        type: normalizeText(type).toLowerCase(),
        value: rest.join(separator).trim(),
      };
    });
}

function buildSearchTerms(target, extraHints = '') {
  if (!target) return tokenize(extraHints);
  return [
    ...target.searchTexts.flatMap((item) => tokenize(item)),
    ...tokenize(extraHints),
  ].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).slice(0, 60);
}

async function waitAfterAction(page, waitMs) {
  await page.waitForTimeout(Number.isFinite(waitMs) ? waitMs : 500);
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {});
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }).catch(() => {});
}

async function clickSelector(page, selector, waitMs) {
  const clicked = await page.evaluate((cssSelector) => {
    const element = document.querySelector(cssSelector);
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const visible = rect.width > 0
      && rect.height > 0
      && style.visibility !== 'hidden'
      && style.display !== 'none'
      && Number(style.opacity || 1) > 0.02;
    if (!visible) return false;
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, selector).catch(() => false);
  if (!clicked) {
    const locator = page.locator(selector).first();
    try {
      await locator.click({ timeout: 1200 });
    } catch {
      await page.evaluate((cssSelector) => {
      const element = document.querySelector(cssSelector);
      if (!element) throw new Error(`Cannot find selector ${cssSelector}`);
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }, selector);
    }
  }
  await waitAfterAction(page, waitMs);
}

async function clickText(page, text, waitMs) {
  const clicked = await page.evaluate((needle) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const candidates = [...document.querySelectorAll('button, [role="button"], a, label, summary, [onclick], [tabindex]')];
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== 'hidden'
          && style.display !== 'none'
          && Number(style.opacity || 1) > 0.02;
      };
      const element = candidates.find((item) => isVisible(item) && (
        normalize(item.textContent).includes(needle)
        || normalize(item.getAttribute('aria-label')).includes(needle)
      ));
      if (!element) return false;
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
  }, text).catch(() => false);
  if (!clicked) {
    const escaped = String(text).replace(/"/g, '\\"');
    const locator = page.locator(`text="${escaped}"`).first();
    try {
      await locator.click({ timeout: 1200 });
    } catch {
      throw new Error(`Cannot find clickable text "${text}"`);
    }
  }
  await waitAfterAction(page, waitMs);
}

async function clickTarget(page, target, waitMs) {
  if (!target) return false;
  const clicked = await page.evaluate((input) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity || 1) > 0.02;
    };
    const isClickable = (element) => {
      if (!element) return false;
      return element.matches('button, [role="button"], a, label, summary, [onclick], [tabindex]');
    };
    const text = normalize(input.text || input.name);
    const matchesText = (element) => {
      if (!text) return true;
      return normalize(element.textContent).includes(text)
        || normalize(element.getAttribute('aria-label')).includes(text);
    };
    const fromSelector = () => {
      if (!input.selector) return [];
      try {
        return [...document.querySelectorAll(input.selector)];
      } catch {
        return [];
      }
    };
    const fromText = () => [...document.querySelectorAll('button, [role="button"], a, label, summary, [onclick], [tabindex]')]
      .filter((element) => matchesText(element));
    const candidates = [...new Set([...fromSelector(), ...fromText()])]
      .filter((element) => isVisible(element) && isClickable(element));
    const element = candidates.find(matchesText) || candidates[0];
    if (!element) return false;
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, target);
  if (clicked) await waitAfterAction(page, waitMs);
  return clicked;
}

async function executeActionStep(page, step, waitMs) {
  const type = String(step.type || step.action || '').toLowerCase();
  const value = step.value ?? step.selector ?? step.text ?? '';
  if (!type) return;
  if (type === 'wait') {
    await page.waitForTimeout(Number.parseInt(value || step.ms || '500', 10));
    return;
  }
  if (type === 'click' || type === 'tap') {
    const selector = step.selector || (String(value).startsWith('.') || String(value).startsWith('#') || String(value).includes('[') ? value : '');
    if (selector) {
      await clickSelector(page, selector, waitMs);
    } else {
      await clickText(page, String(step.text || value), waitMs);
    }
    return;
  }
  if (type === 'click-selector') {
    await clickSelector(page, String(value), waitMs);
    return;
  }
  if (type === 'click-text') {
    await clickText(page, String(value), waitMs);
    return;
  }
  if (type === 'press') {
    await page.keyboard.press(String(value || step.key));
    await waitAfterAction(page, waitMs);
    return;
  }
  if (type === 'fill') {
    const selector = step.selector || String(value).split('|')[0];
    const text = step.text ?? String(value).split('|').slice(1).join('|');
    await page.locator(selector).first().fill(String(text));
    await waitAfterAction(page, waitMs);
    return;
  }
  if (type === 'scroll' || type === 'scroll-to') {
    await scrollTargetIntoView(page, { selector: String(value) });
    await waitAfterAction(page, waitMs);
    return;
  }
  throw new Error(`Unsupported action step "${type}". Use click, click-selector, click-text, fill, press, wait, or scroll.`);
}

async function executeActionSteps(page, steps, waitMs) {
  for (const step of steps) {
    await executeActionStep(page, step, waitMs);
  }
}

async function findTargetState(page, target) {
  if (!target) return null;
  return page.evaluate((input) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visibleText = (element) => normalize(element?.innerText || element?.value || element?.textContent);
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity || 1) > 0.02;
    };
    const summarize = (element, matchedBy) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        matchedBy,
        visible: isVisible(element),
        tagName: element.tagName,
        id: element.id || '',
        className: element.className || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        text: visibleText(element).slice(0, 240),
        box: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          viewportX: rect.left,
          viewportY: rect.top,
          width: rect.width,
          height: rect.height,
        },
      };
    };
    const fromSelector = () => {
      if (!input.selector) return null;
      try {
        const elements = [...document.querySelectorAll(input.selector)];
        const text = normalize(input.text || input.name);
        if (text) {
          const byText = elements.find((element) => isVisible(element) && (
            visibleText(element).includes(text)
            || normalize(element.getAttribute('aria-label')).includes(text)
          ));
          if (byText) return byText;
        }
        return elements.find(isVisible) || elements[0] || null;
      } catch {
        return null;
      }
    };
    const fromText = () => {
      const text = normalize(input.text || input.name);
      if (!text) return null;
      const narrow = [...document.querySelectorAll('button, [role="button"], a, input, label, span, strong, p, h1, h2, h3, h4, h5, h6')];
      const broad = [...document.querySelectorAll('section, div')];
      const rank = (element, exactOnly = false) => {
        const elementText = visibleText(element);
        const aria = normalize(element.getAttribute('aria-label'));
        const exact = elementText === text || aria === text;
        const includes = elementText.includes(text) || aria.includes(text);
        if (!exact && (exactOnly || !includes)) return 0;
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        const interactive = element.matches('button, [role="button"], a, input, label') ? 40 : 0;
        return (exact ? 1000 : 500) + interactive - Math.min(300, area / 1000);
      };
      const choose = (elements, exactOnly = false) => elements
        .filter(isVisible)
        .map((element) => ({ element, score: rank(element, exactOnly) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.element || null;
      return choose(narrow, true) || choose(narrow) || choose(broad, true) || choose(broad);
    };

    const selectorElement = fromSelector();
    if (selectorElement) return summarize(selectorElement, 'selector');
    const textElement = fromText();
    if (textElement) return summarize(textElement, 'text');
    return null;
  }, target);
}

async function collectScreenState(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity || 1) > 0.02
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= window.innerHeight
        && rect.left <= window.innerWidth;
    };
    const items = (selector, limit) => [...document.querySelectorAll(selector)]
      .filter(isVisible)
      .map((element) => normalize(element.innerText || element.value || element.textContent || element.getAttribute('aria-label')))
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, limit);

    return {
      titleCandidates: items('h1, h2, h3, [role="heading"], .sheet-header, .panel-title', 10),
      actionCandidates: items('button, [role="button"], a, label, summary', 20),
    };
  });
}

async function scrollTargetIntoView(page, target) {
  if (!target) return null;
  return page.evaluate((input) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visibleText = (element) => normalize(element?.innerText || element?.value || element?.textContent);
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const findElement = () => {
      if (input.selector) {
        try {
          const matches = [...document.querySelectorAll(input.selector)];
          const visible = matches.find(isVisible);
          if (visible) return visible;
          if (matches[0]) return matches[0];
        } catch {
          // Fall through to text matching.
        }
      }
      const text = normalize(input.text || input.name);
      if (!text) return null;
      const narrow = [...document.querySelectorAll('button, [role="button"], a, input, label, span, strong, p, h1, h2, h3')];
      const broad = [...document.querySelectorAll('section, div')];
      const choose = (matches) => matches
        .filter((element) => isVisible(element) && (
        visibleText(element).includes(text)
        || normalize(element.getAttribute('aria-label')).includes(text)
        ))
        .sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          return (aRect.width * aRect.height) - (bRect.width * bRect.height);
        })[0] || null;
      return choose(narrow) || choose(broad);
    };
    const element = findElement();
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = element.getBoundingClientRect();
    return {
      visible: isVisible(element),
      box: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        viewportX: rect.left,
        viewportY: rect.top,
        width: rect.width,
        height: rect.height,
      },
      text: visibleText(element).slice(0, 240),
    };
  }, target);
}

async function getActionCandidates(page, terms, limit) {
  return page.evaluate(({ searchTerms, maxItems }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const cssEscape = (value) => (window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"'));
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity || 1) > 0.02
        && rect.bottom >= 0
        && rect.right >= 0
        && rect.top <= window.innerHeight
        && rect.left <= window.innerWidth;
    };
    const isClickable = (element) => {
      const tag = element.tagName.toLowerCase();
      return tag === 'button'
        || tag === 'a'
        || tag === 'summary'
        || tag === 'label'
        || element.getAttribute('role') === 'button'
        || element.hasAttribute('onclick')
        || element.tabIndex >= 0
        || [...element.attributes].some((attribute) => attribute.name.startsWith('data-open') || attribute.name.startsWith('data-select') || attribute.name.startsWith('data-close'));
    };
    const stableSelector = (element) => {
      if (element.id) return `#${cssEscape(element.id)}`;
      const preferredData = [
        'data-open-music',
        'data-close-music',
        'data-close-menu',
        'data-select-external',
        'data-source-tab',
        'data-category',
        'data-sound-id',
        'data-mode-panel',
      ];
      for (const name of preferredData) {
        if (element.hasAttribute(name)) {
          const value = element.getAttribute(name);
          return value ? `${element.tagName.toLowerCase()}[${name}="${cssEscape(value)}"]` : `${element.tagName.toLowerCase()}[${name}]`;
        }
      }
      const parts = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = [...parent.children].filter((item) => item.tagName === current.tagName);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
      }
      return `body > ${parts.join(' > ')}`;
    };
    const score = (element) => {
      const text = normalize([
        element.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.id,
        element.className,
        ...[...element.attributes].filter((attribute) => attribute.name.startsWith('data-')).map((attribute) => `${attribute.name} ${attribute.value}`),
      ].join(' ')).toLowerCase();
      let value = 0;
      for (const term of searchTerms) {
        const needle = String(term).toLowerCase();
        if (!needle) continue;
        if (text.includes(needle)) value += Math.min(80, needle.length * 8);
      }
      if (element.hasAttribute('data-open-music') || /背景乐|设置|更多|more/i.test(text)) value += 18;
      if (element.hasAttribute('data-source-tab') || element.hasAttribute('data-category') || element.hasAttribute('data-select-external')) value += 12;
      if (element.hasAttribute('data-toast')) value -= 10;
      if (/返回|关闭|收起|分享|书签|目录/.test(text)) value -= 14;
      return value;
    };
    const candidates = [...document.querySelectorAll('button, [role="button"], a, label, summary, [onclick], [tabindex]')]
      .filter((element) => isVisible(element) && isClickable(element))
      .map((element, index) => ({
        selector: stableSelector(element),
        text: normalize(element.textContent || element.getAttribute('aria-label')).slice(0, 120),
        ariaLabel: normalize(element.getAttribute('aria-label')).slice(0, 120),
        score: score(element),
        index,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const seen = new Set();
    return candidates
      .filter((candidate) => {
        const key = candidate.selector;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxItems);
  }, { searchTerms: terms, maxItems: limit });
}

async function resetPage(page, indexPath, waitMs) {
  await page.goto(pathToFileURL(indexPath).href, { waitUntil: 'domcontentloaded' });
  await waitAfterAction(page, waitMs);
}

async function applyCandidatePath(page, pathItems, waitMs) {
  for (const item of pathItems) {
    await clickSelector(page, item.selector, waitMs);
  }
}

async function discoverFeatureState(page, options) {
  const {
    indexPath,
    target,
    terms,
    waitMs,
    maxDepth,
    maxCandidates,
    baseSteps,
  } = options;
  if (!target) return { status: 'no-target', path: [] };

  let state = await findTargetState(page, target);
  if (state?.visible) {
    return { status: 'already-visible', path: [], state };
  }

  const queue = [[]];
  const visitedPaths = new Set(['']);
  const visitedClicks = new Set();
  const resetToBase = async () => {
    // Preview scaling is presentation-only; evidence keeps the original layout size.
await page.addInitScript(() => { window.__PROTA_DISABLE_FRAME_FIT__ = true; });
await resetPage(page, indexPath, waitMs);
    if (baseSteps?.length) {
      await executeActionSteps(page, baseSteps, waitMs);
    }
  };
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i += 1) {
      const basePath = queue.shift();
      await resetToBase();
      try {
        await applyCandidatePath(page, basePath, waitMs);
      } catch {
        continue;
      }

      state = await findTargetState(page, target);
      if (state?.visible) {
        return { status: 'visible-after-path', path: basePath, state };
      }

      const candidates = await getActionCandidates(page, terms, maxCandidates);
      for (const candidate of candidates) {
        const nextPath = [...basePath, candidate];
        const pathKey = nextPath.map((item) => item.selector).join(' > ');
        if (visitedPaths.has(pathKey) || visitedClicks.has(`${basePath.length}:${candidate.selector}`)) continue;
        visitedPaths.add(pathKey);
        visitedClicks.add(`${basePath.length}:${candidate.selector}`);

        await resetToBase();
        try {
          await applyCandidatePath(page, nextPath, waitMs);
        } catch {
          continue;
        }
        state = await findTargetState(page, target);
        if (state?.visible) {
          return { status: 'discovered', path: nextPath, state };
        }
        if (nextPath.length < maxDepth) queue.push(nextPath);
      }
    }
  }

  await resetToBase();
  return { status: 'not-found', path: [], state: await findTargetState(page, target) };
}

async function targetClip(page, target, padding) {
  const state = await findTargetState(page, target);
  if (!state?.box) return null;
  const pageSize = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight),
  }));
  const clip = {
    x: Math.max(0, Math.floor(state.box.x - padding)),
    y: Math.max(0, Math.floor(state.box.y - padding)),
    width: Math.ceil(state.box.width + padding * 2),
    height: Math.ceil(state.box.height + padding * 2),
  };
  if (clip.x + clip.width > pageSize.width) clip.width = pageSize.width - clip.x;
  if (clip.y + clip.height > pageSize.height) clip.height = pageSize.height - clip.y;
  if (clip.width <= 0 || clip.height <= 0) return null;
  return clip;
}

async function elementClip(page, selector) {
  if (!selector) return null;
  return page.evaluate((cssSelector) => {
    const element = document.querySelector(cssSelector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.floor(rect.left + window.scrollX)),
      y: Math.max(0, Math.floor(rect.top + window.scrollY)),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    };
  }, selector);
}

async function prepareInnerScreenForExport(page, selector) {
  if (!selector) return;
  await page.evaluate((cssSelector) => {
    const el = document.querySelector(cssSelector);
    if (!el) return;

    // Remove phone screen's border radius, box shadow and outer frame styling to prevent bleeding corners, making it a clean rectangle
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
  }, selector);
}

const args = parseArgs(process.argv.slice(2));
if (!args['page-dir']) {
  printUsage();
  process.exit(1);
}

const pageDir = resolveFromRepoRoot(args['page-dir']);
const htmlFile = args['html-file'] || 'index.html';
const indexPath = path.join(pageDir, htmlFile);
const annotationsPath = path.join(pageDir, 'annotations.json');
const outDir = args.out ? resolveFromRepoRoot(args.out) : defaultOutDir(pageDir);
const deviceProfile = getDeviceProfile(args.device);
const viewport = parseViewport(args.viewport, deviceProfile.viewport);
const confirmBeforeShot = Boolean(args['confirm-before-shot'] || args.confirm);
const fullPage = Boolean(args['full-page']);
const evidenceMode = Boolean(args.evidence);
const annotateEvidence = Boolean(args.annotate || args['annotation-overlay']);
const captureSteps = Boolean(args['capture-steps'] || args['capture-states']);
const captureEntryDetail = Boolean(args['capture-entry-detail'] || args['entry-detail'] || args['capture-target-flow']);
const captureInitial = Boolean(args['capture-initial']);
const waitMs = Number.parseInt(args.wait || '500', 10);
const shotName = safeName(args['shot-name'] || args.name || 'feature-shot', 'feature-shot');
const annotations = await readJson(annotationsPath, []);
const target = resolveTarget(args, annotations);
const actionSteps = parseActionSteps(args.actions || args.steps);
const terms = buildSearchTerms(target, args.hint || args.hints || '');
const maxDepth = Math.max(0, Number.parseInt(args['max-depth'] || '3', 10));
const maxCandidates = Math.max(1, Number.parseInt(args['max-candidates'] || '16', 10));
const disableAutoState = Boolean(args['no-auto-state']);
const clipTarget = Boolean(args['clip-target'] || args.clip);
const clipPadding = Number.parseInt(args['clip-padding'] || '32', 10);
const captureSelector = args['capture-selector'] === 'none'
  ? ''
  : args['capture-selector'] || deviceProfile.captureSelector || '';

if (args['list-targets']) {
  printTargets(annotations);
  process.exit(0);
}

await fs.access(indexPath);
await fs.mkdir(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is required. Run: npm install playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({ headless: !confirmBeforeShot });
const page = await browser.newPage({
  viewport,
  deviceScaleFactor: Number.parseFloat(args['device-scale-factor'] || '') || deviceProfile.deviceScaleFactor || 2,
  isMobile: deviceProfile.isMobile,
  hasTouch: deviceProfile.hasTouch,
  userAgent: deviceProfile.userAgent,
});

await resetPage(page, indexPath, waitMs);

async function collectAnnotationEvidence() {
  return page.evaluate(({ items, shouldAnnotate }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const classTokens = (value) => normalize(value)
      .split(' ')
      .filter(Boolean)
      .filter((token) => token !== '__readify_selected');

    function queryCandidates(annotation) {
      const candidates = [];
      if (annotation?.meta?.id) {
        const byId = document.getElementById(annotation.meta.id);
        if (byId) candidates.push(byId);
      }
      if (annotation?.selector) {
        try {
          candidates.push(...document.querySelectorAll(annotation.selector));
        } catch {
          // Keep item unmatched.
        }
      }
      return [...new Set(candidates)];
    }

    function chooseElement(annotation, candidates) {
      if (!candidates.length) return null;
      const metaText = normalize(annotation?.meta?.textContent);
      if (metaText) {
        const byText = candidates.find((element) => normalize(element.textContent).includes(metaText.slice(0, 60)));
        if (byText) return byText;
      }
      const tokens = classTokens(annotation?.meta?.className);
      if (tokens.length) {
        const byClass = candidates.find((element) => tokens.every((token) => element.classList.contains(token)));
        if (byClass) return byClass;
      }
      return candidates[0];
    }

    function summarizeElement(element) {
      if (!element) return null;
      const clone = element.cloneNode(true);
      clone.querySelectorAll('script, style').forEach((node) => node.remove());
      return {
        tagName: element.tagName,
        id: element.id || '',
        className: element.className || '',
        role: element.getAttribute('role') || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        title: element.getAttribute('title') || '',
        text: normalize(element.textContent).slice(0, 240),
        outerHTML: normalize(clone.outerHTML).slice(0, 1200),
      };
    }

    let overlayRoot = null;
    if (shouldAnnotate) {
      overlayRoot = document.createElement('div');
      overlayRoot.setAttribute('data-prd-overlay-root', 'true');
      document.body.appendChild(overlayRoot);

      const style = document.createElement('style');
      style.textContent = `
        [data-prd-overlay-root] .prd-box {
          position: absolute;
          z-index: 2147483646;
          border: 3px solid #ff3b30;
          background: rgba(255, 59, 48, 0.08);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.9);
          pointer-events: none;
          box-sizing: border-box;
        }
        [data-prd-overlay-root] .prd-label {
          position: absolute;
          z-index: 2147483647;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 12px;
          background: #ff3b30;
          color: #fff;
          font: 700 13px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 2px 8px rgba(0,0,0,0.22);
          pointer-events: none;
          text-align: center;
        }
      `;
      document.head.appendChild(style);
    }

    return items.map((annotation, index) => {
      const candidates = queryCandidates(annotation);
      const element = chooseElement(annotation, candidates);
      const rect = element?.getBoundingClientRect();
      const visible = Boolean(rect && rect.width > 0 && rect.height > 0);
      const box = visible ? {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      } : null;

      if (box && overlayRoot) {
        const outline = document.createElement('div');
        outline.className = 'prd-box';
        outline.style.left = `${box.x}px`;
        outline.style.top = `${box.y}px`;
        outline.style.width = `${box.width}px`;
        outline.style.height = `${box.height}px`;

        const label = document.createElement('div');
        label.className = 'prd-label';
        label.textContent = `A${index + 1}`;
        label.style.left = `${Math.max(6, box.x)}px`;
        label.style.top = `${Math.max(6, box.y - 28)}px`;

        overlayRoot.append(outline, label);
      }

      return {
        number: index + 1,
        label: `A${index + 1}`,
        id: annotation.id || '',
        selector: annotation.selector || '',
        description: annotation.description || '',
        matchCount: candidates.length,
        visible,
        box,
        dom: summarizeElement(element),
        meta: annotation.meta || {},
      };
    });
  }, { items: annotations, shouldAnnotate: annotateEvidence });
}

let discovery = null;

if (evidenceMode) {
  const evidence = await collectAnnotationEvidence();
  const fileName = annotateEvidence ? 'annotation-overview.png' : 'prototype-overview.png';
  await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });
  await fs.writeFile(
    path.join(outDir, 'annotation-evidence.json'),
    `${JSON.stringify({
      pageDir,
      generatedAt: new Date().toISOString(),
      viewport,
      device: {
        name: args.device || 'iphone-17',
        label: deviceProfile.label,
        deviceScaleFactor: Number.parseFloat(args['device-scale-factor'] || '') || deviceProfile.deviceScaleFactor || 2,
        isMobile: deviceProfile.isMobile,
        hasTouch: deviceProfile.hasTouch,
        captureSelector,
      },
      overviewImage: `prd-assets/${fileName}`,
      annotated: annotateEvidence,
      annotations: evidence,
    }, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, fileName))}`);
  console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, 'annotation-evidence.json'))}`);
} else {
  const deviceMetadata = {
    name: args.device || 'iphone-17',
    label: deviceProfile.label,
    deviceScaleFactor: Number.parseFloat(args['device-scale-factor'] || '') || deviceProfile.deviceScaleFactor || 2,
    isMobile: deviceProfile.isMobile,
    hasTouch: deviceProfile.hasTouch,
    captureSelector,
  };
  const targetMetadata = target ? {
    source: target.source,
    number: target.number,
    id: target.id,
    selector: target.selector,
    text: target.text,
    name: target.name,
    query: target.query,
    score: target.score,
  } : null;
  const captureOne = async (fileName) => {
    const screenshotOptions = { path: path.join(outDir, fileName), fullPage };
    if (clipTarget && target) {
      const clip = await targetClip(page, target, Number.isFinite(clipPadding) ? clipPadding : 32);
      if (clip) {
        screenshotOptions.clip = clip;
        delete screenshotOptions.fullPage;
      }
    } else if (!fullPage && captureSelector) {
      await prepareInnerScreenForExport(page, captureSelector);
      const clip = await elementClip(page, captureSelector);
      if (clip) {
        screenshotOptions.clip = clip;
        delete screenshotOptions.fullPage;
      }
    }
    await page.screenshot(screenshotOptions);
  };

  if (captureEntryDetail && target) {
    const images = [];

    if (actionSteps.length) {
      await executeActionSteps(page, actionSteps, waitMs);
    }

    if (!disableAutoState) {
      discovery = await discoverFeatureState(page, {
        indexPath,
        target,
        terms,
        waitMs,
        maxDepth,
        maxCandidates,
        baseSteps: actionSteps,
      });
    } else {
      discovery = { status: 'auto-state-disabled', path: [], state: await findTargetState(page, target) };
    }

    const captureFlowImage = async ({ fileName, label, step }) => {
      if (confirmBeforeShot) {
        await waitForUserConfirmation(`Verify screenshot state "${label}", then press Enter to capture. `);
      }
      await captureOne(fileName);
      const finalState = target ? await findTargetState(page, target) : null;
      images.push({
        stepIndex: images.length + 1,
        step,
        label,
        image: `prd-assets/${fileName}`,
        screenState: await collectScreenState(page),
        finalState,
      });
      console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, fileName))}`);
    };

    await captureFlowImage({
      fileName: `${shotName}-entry.png`,
      label: 'entry',
      step: { type: 'target-entry', value: target.name || target.text || target.selector || '' },
    });

    const clicked = await clickTarget(page, target, waitMs);
    if (clicked) {
      await captureFlowImage({
        fileName: `${shotName}-detail.png`,
        label: 'detail-after-entry-click',
        step: { type: 'target-detail', value: target.name || target.text || target.selector || '' },
      });
    } else {
      console.warn(`Warning: target "${target.name}" could not be clicked for detail capture. Use --actions with --capture-steps for deeper pages.`);
    }

    const metadataFile = `${shotName}.json`;
    await fs.writeFile(
      path.join(outDir, metadataFile),
      `${JSON.stringify({
        pageDir,
        generatedAt: new Date().toISOString(),
        viewport,
        device: deviceMetadata,
        captureMode: 'entry-detail',
        fullPage,
        clipTarget,
        target: targetMetadata,
        explicitActions: actionSteps,
        discovery: discovery ? {
          status: discovery.status,
          path: discovery.path.map((item) => ({
            selector: item.selector,
            text: item.text,
            ariaLabel: item.ariaLabel,
            score: item.score,
          })),
        } : null,
        images,
      }, null, 2)}\n`,
      'utf8',
    );
    console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, metadataFile))}`);
  } else if (captureSteps && actionSteps.length) {
    const images = [];

    const captureCurrentStep = async ({ fileName, stepIndex, step, label }) => {
      if (confirmBeforeShot) {
        await waitForUserConfirmation(`Verify screenshot state "${label}", then press Enter to capture. `);
      }
      await captureOne(fileName);
      const finalState = target ? await findTargetState(page, target) : null;
      const item = {
        stepIndex,
        step,
        label,
        image: `prd-assets/${fileName}`,
        screenState: await collectScreenState(page),
        finalState,
      };
      images.push(item);
      console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, fileName))}`);
      if (target && !finalState?.visible) {
        console.warn(`Warning: target "${target.name}" was not visible in ${fileName}.`);
      }
    };

    const captureEntryBeforeClick = async (step, index) => {
      const type = String(step.type || step.action || '').toLowerCase();
      const value = step.value ?? step.selector ?? step.text ?? '';
      const isClick = type === 'click' || type === 'tap' || type === 'click-selector' || type === 'click-text';
      if (!isClick || index === 0) return;

      const selector = step.selector || (type === 'click-selector' ? value : '');
      const text = step.text || (type === 'click-text' ? value : '');
      if (selector) {
        await page.locator(String(selector)).first().scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      } else if (text) {
        const escaped = String(text).replace(/"/g, '\\"');
        await page.locator(`text="${escaped}"`).first().scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      }
      await waitAfterAction(page, waitMs);
      await captureCurrentStep({
        fileName: `${shotName}-${index + 1}-entry.png`,
        stepIndex: index + 1,
        step: { ...step, captureTiming: 'before-click' },
        label: `entry-before-${step.type || step.action || 'click'}:${value}`,
      });
    };

    if (captureInitial) {
      await captureCurrentStep({
        fileName: `${shotName}-0.png`,
        stepIndex: 0,
        step: { type: 'initial', value: '' },
        label: 'initial',
      });
    }

    for (const [index, step] of actionSteps.entries()) {
      await captureEntryBeforeClick(step, index);
      await executeActionStep(page, step, waitMs);
      const fileName = `${shotName}-${index + 1}.png`;
      const label = `${step.type || step.action || 'step'}:${step.value ?? step.selector ?? step.text ?? ''}`;
      await captureCurrentStep({
        fileName,
        stepIndex: index + 1,
        step,
        label,
      });
    }

    const metadataFile = `${shotName}.json`;
    await fs.writeFile(
      path.join(outDir, metadataFile),
      `${JSON.stringify({
        pageDir,
        generatedAt: new Date().toISOString(),
        viewport,
        device: deviceMetadata,
        captureMode: 'steps',
        fullPage,
        clipTarget,
        target: targetMetadata,
        explicitActions: actionSteps,
        images,
      }, null, 2)}\n`,
      'utf8',
    );
    console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, metadataFile))}`);
  } else {
    if (actionSteps.length) {
    await executeActionSteps(page, actionSteps, waitMs);
    }

    if (target && !disableAutoState) {
    discovery = await discoverFeatureState(page, {
      indexPath,
      target,
      terms,
      waitMs,
      maxDepth,
      maxCandidates,
      baseSteps: actionSteps,
    });
    } else if (target) {
    discovery = { status: 'auto-state-disabled', path: [], state: await findTargetState(page, target) };
    }

    if (confirmBeforeShot) {
    const targetLabel = target?.name ? ` for "${target.name}"` : '';
    await waitForUserConfirmation(`Set or verify the exact feature state${targetLabel}, then press Enter to capture the raw screenshot. `);
    }

    const fileName = `${shotName}.png`;
    await captureOne(fileName);

    const metadataFile = `${shotName}.json`;
    const finalState = target ? await findTargetState(page, target) : null;
    await fs.writeFile(
    path.join(outDir, metadataFile),
    `${JSON.stringify({
      pageDir,
      generatedAt: new Date().toISOString(),
      viewport,
      device: deviceMetadata,
      image: `prd-assets/${fileName}`,
      fullPage,
      clipTarget,
      target: targetMetadata,
      explicitActions: actionSteps,
      discovery: discovery ? {
        status: discovery.status,
        path: discovery.path.map((item) => ({
          selector: item.selector,
          text: item.text,
          ariaLabel: item.ariaLabel,
          score: item.score,
        })),
      } : null,
      finalState,
    }, null, 2)}\n`,
    'utf8',
    );

    console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, fileName))}`);
    console.log(`Wrote ${path.relative(process.cwd(), path.join(outDir, metadataFile))}`);
    if (discovery?.path?.length) {
    console.log(`Discovered path: ${discovery.path.map((item) => item.text || item.ariaLabel || item.selector).join(' -> ')}`);
    }
    if (target && !finalState?.visible) {
    console.warn(`Warning: target "${target.name}" was not visible when captured. Use --actions or capture:confirm to force the exact state.`);
    }
  }
}

await browser.close();
