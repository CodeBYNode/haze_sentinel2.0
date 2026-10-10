import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.MOBILE_PREVIEW_URL || 'http://127.0.0.1:5173';
await mkdir('outputs/mobile-preview', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
async function check(name, work) { await work(); checks.push(name); console.log('PASS ' + name); }
async function screenshot(name, fullPage = true) { await page.screenshot({ path: `outputs/mobile-preview/${name}.png`, fullPage }); }
const nav = title => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: title, exact: true });
try {
  await check('Three-step onboarding and relevant vector illustration', async () => {
    await page.goto(base);
    await page.getByRole('heading', { name: 'A little clarity. A better day.' }).waitFor();
    await screenshot('onboarding', false);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'Your plans, with the air in mind.' }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Explore my day' }).click();
    await nav('Today').waitFor();
  });
  await check('Today includes current API, arrival/relief, map and affected plans', async () => {
    assert.equal(await page.locator('.api-number').textContent(), '86');
    assert.equal(await page.locator('.outlook-windows strong').first().textContent(), '1 PM');
    assert.equal(await page.locator('.outlook-windows strong').last().textContent(), '7 PM');
    await page.getByRole('button', { name: /2 plans may be affected/ }).waitFor();
    assert.equal(await page.locator('.map-marker').count(), 6);
    await screenshot('today');
  });
  await check('Prediction opens transparent, dated news sources; Escape closes the sheet', async () => {
    await page.getByRole('button', { name: 'View haze prediction and its sources' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Behind the outlook' }).waitFor();
    assert.equal(await dialog.locator('.news-source').count(), 2);
    assert.match(await dialog.innerText(), /not used to calculate today/);
    await screenshot('sources', false);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
  });
  await check('Map selection and zoom work without replacing the home city', async () => {
    await page.getByRole('button', { name: 'Petaling Jaya, sample API 112' }).click();
    assert.equal(await page.locator('.map-location strong').textContent(), 'Petaling Jaya');
    assert.equal(await page.locator('.api-number').textContent(), '86');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  });
  await check('Affected-plan bar opens the review list and Schedule', async () => {
    await page.getByRole('button', { name: /2 plans may be affected/ }).click();
    assert.equal(await page.locator('.affected-plan').count(), 2);
    await page.getByRole('button', { name: 'Review my schedule' }).click();
    await page.getByRole('heading', { name: 'Saturday', exact: true }).waitFor();
    await screenshot('schedule');
    await page.getByRole('button', { name: 'Next day', exact: true }).click();
    await page.getByRole('heading', { name: 'Sunday', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  });
  await check('Add, persist, edit and delete an activity through sheets', async () => {
    await page.getByRole('button', { name: 'Add activity', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Activity name').fill('Yoga by the lake');
    await dialog.getByLabel('Location', { exact: true }).fill('KLCC Lake');
    await dialog.getByRole('button', { name: 'Add activity', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Yoga by the lake', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Activity name').fill('Stretch by the lake');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for Stretch by the lake' }).click();
    await page.getByRole('button', { name: 'Delete activity', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete activity', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Stretch by the lake', exact: true }).count(), 0);
  });
  await check('Schedule AI opens on icon tap and waits for proposal confirmation', async () => {
    await page.getByRole('button', { name: 'Open AI rescheduling chat' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Replan my day', exact: true }).click();
    await page.getByRole('button', { name: 'Review 2 changes', exact: true }).click();
    assert.equal(await page.locator('.review-change').count(), 2);
    const original = JSON.parse(await page.evaluate(() => localStorage.getItem('haze-sentinel-mobile-plans-v1')));
    assert.equal(original.find(p => p.id === 'run').time, '15:00');
    await screenshot('proposal', false);
    await page.getByRole('button', { name: 'Confirm 2 changes', exact: true }).click();
    await page.reload();
    const updated = JSON.parse(await page.evaluate(() => localStorage.getItem('haze-sentinel-mobile-plans-v1')));
    assert.equal(updated.find(p => p.id === 'run').time, '19:00');
    assert.equal(updated.find(p => p.id === 'cycle').time, '20:00');
    assert.equal(updated.find(p => p.id === 'class').time, '13:00');
    await page.getByRole('button', { name: 'Actions for Design lecture' }).click();
    assert.equal(await page.getByRole('button', { name: 'Find a better time', exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape');
  });
  await check('Assistant has icon prompts, chat input, and a working new conversation', async () => {
    await nav('Assistant').click();
    await page.getByRole('button', { name: 'New conversation' }).click();
    await screenshot('assistant', false);
    await page.getByRole('button', { name: 'Go jogging', exact: true }).click();
    await page.getByText(/isn’t a live observation/).waitFor();
    await page.getByLabel('Ask Haze Sentinel').fill('What news is this prediction based on?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByText(/Live news retrieval isn’t connected/).waitFor();
    await page.getByRole('button', { name: 'New conversation' }).click();
    assert.equal(await page.locator('.message').count(), 0);
  });
  await check('Profile, notifications, optional health and privacy controls', async () => {
    await nav('Profile').click();
    await screenshot('profile');
    await page.getByRole('button', { name: /Personal details Your name/ }).click();
    await page.getByLabel('Your name', { exact: true }).fill('Taylor');
    await page.getByRole('button', { name: 'Save details' }).click();
    await page.getByRole('heading', { name: 'Taylor', exact: true }).waitFor();
    await page.getByRole('button', { name: /Notifications Helpful/ }).click();
    await page.getByRole('switch', { name: /Daily air summary/ }).check();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await page.getByRole('button', { name: /Health preferences Optional/ }).click();
    await page.getByLabel('Asthma', { exact: true }).check();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify(localStorage)), /Asthma/);
    await page.getByRole('button', { name: /Privacy & your data View/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export my profile/ }).click();
    assert.equal((await downloadPromise).suggestedFilename(), 'haze-sentinel-profile.json');
    await page.getByRole('button', { name: /Clear profile information/ }).click();
    await page.getByRole('button', { name: 'Clear profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Guest', exact: true }).waitFor();
  });
  await check('Email login, registration and guest routes do not fake authentication', async () => {
    await page.getByRole('button', { name: 'Log in or sign up' }).click();
    await screenshot('login', false);
    await page.getByLabel('Email address', { exact: true }).fill('test@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Email sign-in isn’t connected yet.').waitFor();
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await screenshot('signup', false);
    await page.getByRole('button', { name: 'Continue as guest' }).click();
  });
  await check('Location selector updates conditions; light appearance survives a dark system setting', async () => {
    await page.getByRole('button', { name: 'Change location' }).click();
    await page.getByRole('button', { name: /Petaling Jaya Selangor/ }).click();
    assert.equal(await page.locator('.api-number').textContent(), '112');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
  });
  await check('No horizontal page overflow at 320, 375, 390, 430 and 768 pixels', async () => {
    for (const width of [320, 375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['today', 'schedule', 'assistant', 'profile', 'login', 'signup']) {
        await page.goto(base + '/#' + route);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflows at ' + width);
      }
    }
  });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await writeFile('outputs/mobile-preview/verification.json', JSON.stringify({ checks, runtimeErrors: errors, widths: [320, 375, 390, 430, 768] }, null, 2));
  console.log(`Verified ${checks.length} mobile flows; no runtime errors.`);
} finally { await browser.close(); }
