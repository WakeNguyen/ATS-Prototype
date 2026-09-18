/**
 * warm-and-join.js (v2.0 Multi-Account Facebook Auto-Warm & Group Auto-Joiner)
 * Simulates natural human behavior (Feed scroll, Reels watch, Story view, Likes)
 * and automatically joins target Facebook Groups with membership question extraction
 * and custom answer support (Human-in-the-Loop).
 *
 * Usage:
 *   node warm-and-join.js <path_to_json_payload>
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

async function saveDebugScreenshot(page, accountId, label, groupId = 'general') {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const filename = `warm-${label}-${accountId}-${groupId}-${Date.now()}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    console.error(`[Screenshot] Saved: ${filepath}`);

    const gdriveDir = 'G:\\My Drive\\AI project\\ATS\\facebook auto posting 2.0\\puppeteer image';
    if (fs.existsSync('G:\\My Drive\\AI project\\ATS')) {
      if (!fs.existsSync(gdriveDir)) fs.mkdirSync(gdriveDir, { recursive: true });
      const gdrivePath = path.join(gdriveDir, filename);
      fs.copyFileSync(filepath, gdrivePath);
      console.error(`[Screenshot] Synced to Google Drive: ${gdrivePath}`);
    }
    return { filename, filepath };
  } catch (e) {
    console.error(`[Screenshot Error] Could not save screenshot: ${e.message}`);
    return { filename: '', filepath: '' };
  }
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
        console.error('[4G Mobile Proxy] Waiting 10s for modem to acquire new cellular IP...');
        setTimeout(() => resolve(true), 10000);
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

async function safeGoto(page, url, timeout = 60000) {
  try {
    return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (err) {
    console.error(`[Navigation Retry] First attempt to ${url} failed (${err.message}). Retrying...`);
    await page.waitForTimeout(3000);
    return await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
  }
}

async function isFacebookLoginPrompt(page) {
  try {
    return await page.evaluate(() => {
      // 1. Password input or login form exists
      if (document.querySelector('input[type="password"], input[name="pass"], form[action*="login"]')) {
        return true;
      }
      // 2. Dialog or banner containing login / authentication text
      const dialogs = document.querySelectorAll('[role="dialog"], [data-pagelet="root"]');
      for (const d of dialogs) {
        const text = (d.textContent || '').toLowerCase();
        const hasLoginKeyword = text.includes('đăng nhập') || text.includes('log in') || text.includes('tạo tài khoản') || text.includes('sign up');
        const hasAuthIndicator = text.includes('quên mật khẩu') || text.includes('forgot password') || text.includes('email hoặc số điện thoại') || text.includes('xem thêm trên facebook');
        if (hasLoginKeyword && hasAuthIndicator) {
          return true;
        }
      }
      return false;
    });
  } catch (e) {
    return false;
  }
}

/**
 * Phase 1: Natural User Actions (Newsfeed, Reels, Story, Notifications)
 */
async function performFeedWarming(page, accountId) {
  console.error(`\n--- [Phase 1: Human Emulation & Feed Warming for ${accountId}] ---`);

  // 1. Visit Home Feed
  console.error('[Action 1/4] Visiting Facebook Home Feed...');
  await safeGoto(page, 'https://www.facebook.com');
  await page.waitForTimeout(randomDelay(4000, 7000));
  await saveDebugScreenshot(page, accountId, '01-feed-start');

  // Check Checkpoint or Login Prompt on Home
  const url = page.url();
  const isLoginPrompt = await isFacebookLoginPrompt(page);
  if (url.includes('checkpoint') || url.includes('login') || url.includes('recover') || isLoginPrompt) {
    await saveDebugScreenshot(page, accountId, 'checkpoint-feed');
    throw new Error(`Facebook Checkpoint / Re-login required for account [${accountId}]`);
  }

  // 2. Scroll Feed & Micro-Interactions (Like dạo)
  const scrollCount = randomDelay(4, 7);
  let totalLiked = 0;
  console.error(`[Action 2/4] Scrolling feed timeline (${scrollCount} times)...`);

  for (let i = 0; i < scrollCount; i++) {
    const scrollY = randomDelay(400, 800);
    await page.evaluate((y) => window.scrollBy(0, y), scrollY);
    await page.waitForTimeout(randomDelay(2500, 5000));

    // 25% chance to click "See more" / "Xem thêm"
    if (Math.random() < 0.25) {
      try {
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('[role="button"], span, div'));
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            if (text === 'xem thêm' || text === 'see more') {
              const rect = el.getBoundingClientRect();
              if (rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0) {
                el.click();
                return true;
              }
            }
          }
          return false;
        });
      } catch (e) {}
    }

    // 40% chance to like 1 visible post
    if (Math.random() < 0.40 && totalLiked < 2) {
      try {
        const liked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('[role="button"], div[aria-label="Thích"], div[aria-label="Like"]'));
          const valid = btns.filter(b => {
            const text = (b.textContent || '').trim().toLowerCase();
            const label = (b.getAttribute('aria-label') || '').trim().toLowerCase();
            const isPressed = b.getAttribute('aria-pressed') === 'true';
            const rect = b.getBoundingClientRect();
            return !isPressed && (text === 'thích' || text === 'like' || label === 'thích' || label === 'like') && rect.top >= 0 && rect.bottom <= window.innerHeight;
          });
          if (valid.length > 0) {
            valid[Math.floor(Math.random() * valid.length)].click();
            return true;
          }
          return false;
        });
        if (liked) {
          totalLiked++;
          console.error(`  -> Liked a post on Home Feed (Total: ${totalLiked})`);
          await page.waitForTimeout(randomDelay(2000, 4000));
        }
      } catch (e) {}
    }
  }

  await saveDebugScreenshot(page, accountId, '02-feed-scrolled-liked');

  // 3. Watch Facebook Reels / Video (60% probability)
  if (Math.random() < 0.6) {
    console.error('[Action 3/4] Navigating to Facebook Reels / Watch video...');
    try {
      await safeGoto(page, 'https://www.facebook.com/watch');
      const watchTimeSec = randomDelay(20, 35);
      console.error(`  -> Watching video stream for ${watchTimeSec} seconds...`);
      await page.waitForTimeout(watchTimeSec * 1000);
      await saveDebugScreenshot(page, accountId, '03-watch-reels');

      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(randomDelay(4000, 8000));
    } catch (e) {
      console.error(`  [Watch Note] Video browsing bypassed: ${e.message}`);
    }
  }

  // 4. View Notifications
  console.error('[Action 4/4] Checking notifications and header bar...');
  try {
    await safeGoto(page, 'https://www.facebook.com');
    await page.waitForTimeout(randomDelay(2000, 3500));
    await page.evaluate(() => {
      const bell = document.querySelector('[aria-label="Thông báo"], [aria-label="Notifications"]');
      if (bell) bell.click();
    });
    await page.waitForTimeout(randomDelay(3000, 5000));
    await saveDebugScreenshot(page, accountId, '04-notifications');
    await page.evaluate(() => document.body.click());
  } catch (e) {}
  console.error(`[Phase 1 Complete] Feed warming finished for ${accountId}.`);
}

/**
 * Phase 2: Auto-Join Target Facebook Groups with Question Extraction & Custom Answer Support
 */
async function joinTargetGroup(page, accountId, groupUrl, groupName, customAnswer = '', groupId = '') {
  console.error(`\n--- [Phase 2: Auto-Join Group "${groupName}" (${groupUrl})] ---`);
  if (customAnswer) console.error(`  -> Using Custom Join Answer (ATS 3.0): "${customAnswer.substring(0, 50)}..."`);

  const result = {
    groupId: groupId,
    groupName: groupName,
    groupUrl: groupUrl,
    accountId: accountId,
    status: 'Unknown',
    questions: [],
    screenshotFile: '',
    details: ''
  };

  try {
    await safeGoto(page, groupUrl, 45000);
    await page.waitForTimeout(randomDelay(3000, 5000));

    // Check if Facebook Login / Session Expired prompt is displayed on group page
    const isLoginPrompt = await isFacebookLoginPrompt(page);
    if (isLoginPrompt) {
      console.error(`[Auth Error] Facebook login prompt detected on group page. Session expired for [${accountId}].`);
      await saveDebugScreenshot(page, accountId, 'checkpoint-group-login', groupId);
      result.status = 'Error';
      result.details = `Facebook session expired or login required for account [${accountId}].`;
      return result;
    }

    // Check if already a member or already requested
    const pageStatus = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], div[role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        if (text.includes('đã tham gia') || label.includes('đã tham gia') || text.includes('joined') || label.includes('joined')) {
          return 'Already Joined';
        }
        if (text.includes('đã gửi yêu cầu') || text.includes('yêu cầu đang chờ') || text.includes('cancel request') || text.includes('pending')) {
          return 'Already Pending';
        }
      }
      return null;
    });

    if (pageStatus) {
      console.error(`[Group Status] ${pageStatus}`);
      result.status = pageStatus === 'Already Joined' ? 'Joined' : 'Pending Approval';
      result.details = pageStatus;
      return result;
    }

    // Find and click "Tham gia nhóm" / "Join group" button
    let joinClicked = false;
    joinClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], div[role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        if ((text === 'tham gia nhóm' || text === 'join group' || label === 'tham gia nhóm' || label === 'join group') && !btn.closest('[role="article"]')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!joinClicked) {
      console.error('[Group Warning] Could not find "Tham gia nhóm" button.');
      result.status = 'Error';
      result.details = 'Join button not found';
      await saveDebugScreenshot(page, accountId, 'no-join-button', groupId);
      return result;
    }

    console.error('[Action] Clicked "Tham gia nhóm" button. Checking for membership questions popup...');
    await page.waitForTimeout(randomDelay(3000, 5000));

    // Check if dialog is actually a login popup rather than survey
    const isLoginDialog = await isFacebookLoginPrompt(page);
    if (isLoginDialog) {
      console.error(`[Auth Error] Facebook login dialog popped up after clicking Join. Session expired for [${accountId}].`);
      await saveDebugScreenshot(page, accountId, 'checkpoint-join-login', groupId);
      result.status = 'Error';
      result.details = `Facebook session expired or login required for account [${accountId}].`;
      return result;
    }

    // Check if Membership Questionnaire / Rules Modal appears
    const hasModal = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return dialogs.length > 0;
    });

    if (hasModal) {
      console.error('[Survey Handler] Membership Questions / Rules dialog detected!');

      // 1. Extract genuine question texts from the dialog (excluding auth noise)
      const extractedQuestions = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        const questionsFound = [];
        const ignoredKeywords = [
          'xem thêm trên facebook',
          'email hoặc số điện thoại',
          'mật khẩu',
          'đăng nhập',
          'quên mật khẩu',
          'tạo tài khoản mới',
          'điều khoản',
          'chính sách quyền riêng tư'
        ];
        for (const d of dialogs) {
          // Skip if dialog text is predominantly a login form
          const dialogText = (d.textContent || '').toLowerCase();
          if (dialogText.includes('quên mật khẩu') && (dialogText.includes('đăng nhập') || dialogText.includes('log in'))) {
            continue;
          }

          const textNodes = d.querySelectorAll('span, div, p, label');
          for (const node of textNodes) {
            const txt = (node.textContent || '').trim();
            const lower = txt.toLowerCase();
            // Skip noisy auth phrases
            if (ignoredKeywords.some(kw => lower === kw || (lower.startsWith('xem thêm trên facebook') && lower.includes('đăng nhập')))) {
              continue;
            }
            // Typical question patterns
            if (txt.length > 15 && txt.length < 300 && (txt.includes('?') || txt.includes('Câu hỏi') || txt.includes('Question') || txt.includes('Vui lòng') || txt.includes('nhập') || txt.includes('Quy tắc') || txt.includes('mã'))) {
              if (!questionsFound.includes(txt) && !questionsFound.some(existing => existing.includes(txt))) {
                questionsFound.push(txt);
              }
            }
          }
        }
        return questionsFound;
      });

      result.questions = extractedQuestions;
      console.error(`[Survey Handler] Extracted ${extractedQuestions.length} question(s):`);
      extractedQuestions.forEach((q, idx) => console.error(`   Q${idx + 1}: ${q}`));

      // Capture screenshot of question modal for User review (ATS 3.0 Notification Center)
      const shot = await saveDebugScreenshot(page, accountId, 'survey-questions', groupId);
      result.screenshotFile = shot.filename;

      // Check if this question seems to require strict secret code / custom verification
      const isStrictQuestion = extractedQuestions.some(q => {
        const lower = q.toLowerCase();
        return lower.includes('mật khẩu') || lower.includes('mã') || lower.includes('password') || lower.includes('code') || lower.includes('bài ghim') || lower.includes('số điện thoại') || lower.includes('sđt');
      });

      if (isStrictQuestion && !customAnswer) {
        console.error('[Survey Handler Alert] Strict/Custom question detected and NO Custom Answer was found in ATS 3.0 (custom_join_answer)!');
        result.status = 'Needs Custom Answer';
        result.details = 'Nhóm có câu hỏi bảo mật đặc biệt (mã bí mật/quy tắc riêng). Cần người dùng cấu hình câu trả lời trong tab Social Group URLs (ATS 3.0).';
        // Cancel / close dialog for now
        await page.evaluate(() => {
          const closeBtn = document.querySelector('[role="dialog"] [aria-label="Đóng"], [role="dialog"] [aria-label="Close"]');
          if (closeBtn) closeBtn.click();
        });
        return result;
      }

      // Fill questions
      await page.evaluate((answerToUse) => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          // A. Tick all agreement checkboxes
          const checkboxes = d.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
          for (const cb of checkboxes) {
            const isChecked = cb.checked || cb.getAttribute('aria-checked') === 'true';
            if (!isChecked) {
              cb.click();
            }
          }

          // B. Fill text inputs and textareas
          const defaultAnswer = answerToUse || 'Tôi muốn tìm kiếm thông tin và cơ hội hợp tác theo đúng quy định nhóm.';
          const textInputs = d.querySelectorAll('textarea, input[type="text"]');
          for (const input of textInputs) {
            if (!input.value || input.value.trim().length === 0) {
              input.focus();
              input.value = defaultAnswer;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }

          // C. Select radio buttons if any
          const radioGroups = d.querySelectorAll('[role="radiogroup"], div');
          for (const rg of radioGroups) {
            const radios = rg.querySelectorAll('input[type="radio"], [role="radio"]');
            if (radios.length > 0 && !Array.from(radios).some(r => r.checked || r.getAttribute('aria-checked') === 'true')) {
              radios[0].click();
            }
          }
        }
      }, customAnswer);

      await page.waitForTimeout(randomDelay(1500, 3000));

      // Click Submit Button
      const submitted = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          const buttons = Array.from(d.querySelectorAll('[role="button"], button'));
          for (const btn of buttons) {
            const text = (btn.textContent || '').trim().toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
            if (text === 'gửi' || text === 'gửi cho quản trị viên' || text === 'submit' || text === 'hoàn tất' || label.includes('gửi') || label.includes('submit')) {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (submitted) {
        console.error('[Survey Handler] Form submitted successfully.');
      }
      await page.waitForTimeout(randomDelay(3000, 5000));
    }

    await saveDebugScreenshot(page, accountId, 'join-completed', groupId);
    result.status = 'Pending Approval';
    result.details = 'Join request submitted successfully';
    console.error(`[Result] Successfully submitted join request for "${groupName}"!`);
    return result;

  } catch (err) {
    console.error(`[Group Error] Failed joining group ${groupUrl}: ${err.message}`);
    result.status = 'Error';
    result.details = err.message;
    await saveDebugScreenshot(page, accountId, 'join-error', groupId);
    return result;
  }
}

/**
 * Main Runner for a single account
 */
async function warmAndJoinAccount(accountId, proxyUrl, targetGroups, resetIpUrl) {
  const SESSIONS_DIR = path.join(DATA_DIR, 'sessions', accountId);
  let sessionPath = path.join(SESSIONS_DIR, 'fb-session.json');

  if (!fs.existsSync(sessionPath) && fs.existsSync(path.join(DATA_DIR, 'fb-session.json'))) {
    sessionPath = path.join(DATA_DIR, 'fb-session.json');
  }

  if (!fs.existsSync(sessionPath)) {
    return {
      accountId: accountId,
      success: false,
      error: `Session not found for account [${accountId}]. Please run save-session.js first.`,
      groupsJoined: []
    };
  }

  let browser = null;
  let context = null;
  let page = null;
  const groupsResults = [];

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

    // 1. Phase 1: Natural User Actions (Feed, Reels, Story, Likes)
    await performFeedWarming(page, accountId);

    // 2. Phase 2: Auto-Join Target Groups
    if (Array.isArray(targetGroups) && targetGroups.length > 0) {
      console.error(`\n[Auto-Join] Preparing to join ${targetGroups.length} target group(s)...`);
      for (let i = 0; i < targetGroups.length; i++) {
        const g = targetGroups[i];
        const res = await joinTargetGroup(page, accountId, g.groupUrl, g.groupName || 'Unknown Group', g.customAnswer || '', g.id || '');
        groupsResults.push(res);

        // Delay between group joins (30 - 60s)
        if (i < targetGroups.length - 1) {
          const delayMs = randomDelay(30000, 60000);
          console.error(`[Pacing] Waiting ${(delayMs / 1000).toFixed(0)}s before next group join...`);
          await page.waitForTimeout(delayMs);
        }
      }
    }

    // Save updated session state
    try {
      await context.storageState({ path: sessionPath });
      console.error(`[Session Sync] Updated session cookies saved to: ${sessionPath}`);
    } catch (e) {}

    return {
      accountId: accountId,
      success: true,
      groupsJoined: groupsResults
    };

  } catch (err) {
    return {
      accountId: accountId,
      success: false,
      error: err.message,
      groupsJoined: groupsResults
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

/**
 * Batch Handler (Invoked via Host Bridge or CLI JSON payload)
 */
async function runWarmAndJoinBatch(payloadFile) {
  let payload = {};
  try {
    payload = JSON.parse(fs.readFileSync(payloadFile, 'utf-8'));
  } catch (e) {
    console.error(`Failed to read payload file: ${e.message}`);
    process.exit(1);
  }

  const accounts = payload.accounts || [];
  const resetIpUrl = payload.resetIpUrl || '';
  const batchResults = [];

  console.error(`\n===============================================================`);
  console.error(`[FB Auto-Warm & Group Auto-Joiner v2] Starting Batch Run`);
  console.error(`  Total Accounts: ${accounts.length}`);
  console.error(`===============================================================\n`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const accountId = acc.accountId || 'acc_01';
    const proxyUrl = acc.proxyUrl || '';
    const accResetUrl = acc.resetIpUrl || resetIpUrl;
    const targetGroups = acc.targetGroups || [];

    console.error(`\n[Account ${i + 1}/${accounts.length}] Starting warming for [${accountId}]`);

    // Rotate 4G IP before opening account
    if (accResetUrl) {
      console.error(`[4G Rotation] Triggering IP reset for account [${accountId}]...`);
      await resetProxyIp(accResetUrl);
    }

    const result = await warmAndJoinAccount(accountId, proxyUrl, targetGroups, accResetUrl);
    batchResults.push(result);

    // Delay between accounts (20 - 45s)
    if (i < accounts.length - 1) {
      const waitMs = randomDelay(20000, 45000);
      console.error(`[Pacing] Waiting ${(waitMs / 1000).toFixed(0)}s before next account...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // Clean up temp payload
  try { fs.unlinkSync(payloadFile); } catch (e) {}

  console.error(`\n===============================================================`);
  console.error(`[FB Auto-Warm & Group Auto-Joiner v2] Batch Completed`);
  console.error(`===============================================================\n`);

  console.log(JSON.stringify(batchResults));
}

// CLI Execution
if (require.main === module) {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) {
    runWarmAndJoinBatch(arg);
  } else {
    console.error('Usage: node warm-and-join.js <path_to_json_payload>');
  }
}

module.exports = { warmAndJoinAccount, runWarmAndJoinBatch };
