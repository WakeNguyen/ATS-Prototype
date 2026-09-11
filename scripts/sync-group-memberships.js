/**
 * sync-group-memberships.js (v1.0 Facebook Group Membership Fast Scanner)
 * 
 * Scrapes https://www.facebook.com/groups/joins for each active account
 * to extract the complete list of groups the account currently belongs to.
 * Fast execution (~15s per account) without heavy warming routines.
 * 
 * Usage:
 *   node sync-group-memberships.js <path_to_json_payload>
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    playwright = require(path.join(__dirname, '..', 'facebook auto posting', 'node_modules', 'playwright'));
  } catch (e2) {
    console.error('Error loading Playwright module: ' + e2.message);
    process.exit(1);
  }
}
const { chromium } = playwright;

const DATA_DIR = process.env.FB_POSTER_DATA_DIR || path.join(__dirname, 'data');
const SCREENSHOT_DIR = path.join(DATA_DIR, 'puppeteer image');

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs) + minMs);
}

/**
 * Trigger 4G Proxy Reset IP URL (mProxy / ProxyXoay)
 */
function resetProxyIp(resetUrl) {
  if (!resetUrl || !resetUrl.startsWith('http')) return Promise.resolve(false);
  return new Promise((resolve) => {
    console.error(`[4G Mobile Proxy] Requesting new IP from: ${resetUrl} ...`);
    const protocol = resetUrl.startsWith('https') ? https : http;
    const req = protocol.get(resetUrl, { timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        console.error(`[4G Mobile Proxy] Reset response (${res.statusCode}): ${body.trim().substring(0, 150)}`);
        console.error('[4G Mobile Proxy] Waiting 8s for modem to acquire new cellular IP...');
        setTimeout(() => resolve(true), 8000);
      });
    });
    req.on('error', (err) => {
      console.error(`[4G Mobile Proxy Warning] Failed to trigger Reset IP: ${err.message}`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error('[4G Mobile Proxy Warning] Reset IP request timed out.');
      resolve(false);
    });
  });
}

/**
 * Scan joined groups for a single account
 */
async function scanAccountJoinedGroups(account) {
  const accountId = account.accountId || account.account_ref || account.id || 'acc_01';
  const fbAccountId = account.fbAccountId || account.id || accountId;
  const proxyUrl = account.proxyUrl || account.proxy_url || '';

  const SESSIONS_DIR = path.join(DATA_DIR, 'sessions', accountId);
  let sessionPath = path.join(SESSIONS_DIR, 'fb-session.json');

  if (!fs.existsSync(sessionPath) && fs.existsSync(path.join(DATA_DIR, 'fb-session.json'))) {
    sessionPath = path.join(DATA_DIR, 'fb-session.json');
  }

  if (!fs.existsSync(sessionPath)) {
    return {
      fbAccountId,
      accountId,
      success: false,
      error: `Session file not found for account [${accountId}]`,
      joinedGroupUrls: []
    };
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    const launchOptions = {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };

    if (proxyUrl) {
      try {
        const urlObj = new URL(proxyUrl);
        launchOptions.proxy = {
          server: `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}`,
          username: urlObj.username || undefined,
          password: urlObj.password || undefined
        };
      } catch (e) {
        console.error(`[Proxy Warning] Failed to parse proxy "${proxyUrl}": ${e.message}`);
      }
    }

    browser = await chromium.launch(launchOptions);

    context = await browser.newContext({
      storageState: sessionPath,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh'
    });

    page = await context.newPage();

    console.error(`[Sync] Navigating to https://www.facebook.com/groups/joins for [${accountId}]...`);
    await page.goto('https://www.facebook.com/groups/joins', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('/checkpoint/') || currentUrl.includes('checkpoint')) {
      return {
        fbAccountId,
        accountId,
        success: false,
        error: 'Checkpoint detected during membership sync',
        joinedGroupUrls: []
      };
    }

    // Scroll down 2-3 times to load full list of joined groups
    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1500);
    }

    // Extract all group links from the page
    const extractedUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
      const groupUrls = new Set();
      const ignoreKeywords = ['/groups/feed', '/groups/joins', '/groups/create', '/groups/discover', '/groups/search', '/groups/notifications'];

      for (const a of links) {
        const href = a.href || '';
        if (!href.includes('/groups/')) continue;
        if (ignoreKeywords.some(kw => href.includes(kw))) continue;

        try {
          const urlObj = new URL(href);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          const groupsIdx = parts.indexOf('groups');
          if (groupsIdx >= 0 && parts[groupsIdx + 1]) {
            const groupSlug = parts[groupsIdx + 1];
            if (!['feed', 'joins', 'create', 'discover', 'search'].includes(groupSlug)) {
              groupUrls.add(`https://facebook.com/groups/${groupSlug}`);
            }
          }
        } catch (e) {}
      }
      return Array.from(groupUrls);
    });

    console.error(`[Sync] Extracted ${extractedUrls.length} joined group(s) for account [${accountId}].`);

    // Save fresh storage state
    try {
      await context.storageState({ path: sessionPath });
    } catch (e) {}

    return {
      fbAccountId,
      accountId,
      success: true,
      joinedGroupUrls: extractedUrls,
      error: null
    };

  } catch (err) {
    console.error(`[Sync Error] Failed to scan account [${accountId}]: ${err.message}`);
    return {
      fbAccountId,
      accountId,
      success: false,
      error: err.message,
      joinedGroupUrls: []
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

/**
 * Batch Handler
 */
async function runGroupMembershipSyncBatch(payloadFile) {
  let payload = {};
  try {
    payload = JSON.parse(fs.readFileSync(payloadFile, 'utf-8'));
  } catch (e) {
    console.error(`Failed to read payload file: ${e.message}`);
    process.exit(1);
  }

  const accounts = payload.accounts || [];
  const batchResults = [];

  console.error(`\n===============================================================`);
  console.error(`[FB Group Membership Auto-Sync] Starting Batch Run`);
  console.error(`  Total Accounts: ${accounts.length}`);
  console.error(`===============================================================\n`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const accountId = acc.accountId || acc.account_ref || acc.id || 'acc_01';
    const accResetUrl = acc.resetIpUrl || acc.reset_ip_url || payload.resetIpUrl;

    console.error(`\n[Account ${i + 1}/${accounts.length}] Syncing joined groups for [${accountId}]`);

    // Rotate 4G IP before opening account
    if (accResetUrl) {
      await resetProxyIp(accResetUrl);
    }

    const result = await scanAccountJoinedGroups(acc);
    batchResults.push(result);

    // Delay between accounts (5 - 10s)
    if (i < accounts.length - 1) {
      const waitMs = randomDelay(5000, 10000);
      console.error(`[Pacing] Waiting ${(waitMs / 1000).toFixed(0)}s before next account...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // Clean up temp payload
  try { fs.unlinkSync(payloadFile); } catch (e) {}

  console.error(`\n===============================================================`);
  console.error(`[FB Group Membership Auto-Sync] Batch Completed`);
  console.error(`===============================================================\n`);

  console.log(JSON.stringify(batchResults));
}

// CLI Execution
if (require.main === module) {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) {
    runGroupMembershipSyncBatch(arg);
  } else {
    console.error('Usage: node sync-group-memberships.js <path_to_json_payload>');
  }
}

module.exports = { scanAccountJoinedGroups, runGroupMembershipSyncBatch };
