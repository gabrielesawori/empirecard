// Optional real-browser verification using an installed Chrome; no npm dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { SOUND_FILES } from '../public/audio.js';

const soundDurations = {};
for (const [name, url] of Object.entries(SOUND_FILES)) {
  const wav = await readFile(new URL(`../${decodeURIComponent(url.slice(1))}`, import.meta.url));
  let byteRate, dataSize;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const type = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    // Derive PCM duration from samples; some supplied WAV byte-rate fields are inconsistent.
    if (type === 'fmt ') byteRate = wav.readUInt32LE(offset + 12) * wav.readUInt16LE(offset + 10) * wav.readUInt16LE(offset + 22) / 8;
    if (type === 'data') dataSize = size;
    offset += 8 + size + size % 2;
  }
  soundDurations[name] = dataSize / byteRate;
  assert.ok(soundDurations[name] > 0, `Invalid WAV: ${url}`);
}
const soundCount = (tab, name) => tab.evaluate(`window.smokeEffects.filter(duration => Math.abs(duration - ${soundDurations[name]}) < 0.002).length`);

export async function createBrowserSession(base = process.env.TEST_URL || 'http://localhost:3000') {
  const chromePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
  const profile = await mkdtemp(path.join(tmpdir(), 'empire-card-browser-'));
  const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const chromeClosed = new Promise(resolve => chrome.once('close', resolve));
  let counter = 0;
  let pendingBuffer = '';
  const pending = new Map();
  const errors = [];
  let stderr = '';
  chrome.stderr.on('data', chunk => { stderr += chunk.toString(); });
  chrome.stdio[4].on('data', chunk => {
    pendingBuffer += chunk.toString();
    let end;
    while ((end = pendingBuffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(pendingBuffer.slice(0, end));
      pendingBuffer = pendingBuffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, timeout } = pending.get(message.id);
        clearTimeout(timeout);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++counter;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}. ${stderr.slice(-1000)}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout });
      chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function page(width, height, { register = true } = {}) {
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Log.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.smokeEffects = JSON.parse(sessionStorage.getItem('smoke.effects') || '[]');
      const original = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function (...args) {
        const context = this;
        const voice = original.apply(this, args);
        const start = voice.start;
        voice.start = function (...params) {
          const result = start.apply(this, params);
          if (context.state === 'running') {
            window.smokeEffects.push(this.buffer.duration);
            sessionStorage.setItem('smoke.effects', JSON.stringify(window.smokeEffects));
          }
          return result;
        };
        return voice;
      };
    ` }, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async (expression, timeout = 12000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) { if (await evaluate(expression)) return; await pause(100); }
      throw new Error(`Browser condition not reached: ${expression}`);
    };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill = (selector, value) => evaluate(`{ const input = document.querySelector(${JSON.stringify(selector)}); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', {bubbles: true})); }`);
    const screenshot = async name => {
      const { cssContentSize } = await send('Page.getLayoutMetrics', {}, sessionId);
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.max(height, cssContentSize.height), scale: 1 } }, sessionId);
      const file = path.join(tmpdir(), `empire-card-${name}.png`);
      await writeFile(file, Buffer.from(data, 'base64'));
      console.log(`Screenshot: ${file}`);
    };
    const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Overflow at ${width}px`);
    await send('Page.navigate', { url: base }, sessionId);
    await wait('document.querySelector("#account-form")');
    if (register) {
      const username = `Test${Date.now().toString(36)}${counter}`;
      const registered = await evaluate(`fetch('/api/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({username,email:`${username}@example.test`,password:'empire-test-password'})})}).then(r => r.ok)`);
      assert.equal(registered, true, 'Create isolated test account');
      await send('Page.reload', {}, sessionId);
    }
    await wait(`document.querySelector('${register ? '.menu-layout' : '#account-form'}') && document.querySelector("#connection-label").textContent === "Arena online"`);
    await wait('[...document.images].every(image => image.complete && image.naturalWidth > 0)');
    return { evaluate, wait, click, fill, screenshot, noOverflow, sessionId };
  }

  async function close() {
    try { await send('Browser.close'); } catch { chrome.kill('SIGTERM'); }
    for (const item of pending.values()) clearTimeout(item.timeout);
    const shutdown = setTimeout(() => chrome.kill('SIGKILL'), 3000);
    await chromeClosed;
    clearTimeout(shutdown);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  return { page, send, pause, errors, close, soundCount, soundDurations };
}
