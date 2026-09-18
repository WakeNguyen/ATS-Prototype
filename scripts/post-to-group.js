/**
 * post-to-group.js (v2.0 Multi-Account & Anti-Detection)
 * Posts content to a Facebook Group using Playwright browser automation
 * with per-account session isolation, proxy support, and human emulation.
 *
 * Usage:
 *   node post-to-group.js <group_url> <post_content_base64> [image_url_or_json] [account_id] [proxy_url]
 *   node post-to-group.js --account=acc_01 --groupUrl="..." --content="BASE64:..." --images="[...]" --proxy="..."
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

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

// --- Parse CLI Arguments ---
const rawArgs = process.argv.slice(2);
let groupUrl = '';
let postContent = '';
let imageUrlsArg = '';
let accountId = 'acc_01';
let proxyUrl = '';
let allowPostWithoutJoin = false;

const hasNamedCore = rawArgs.some(a => a.startsWith('--groupUrl=') || a.startsWith('--content='));

if (hasNamedCore) {
  for (const arg of rawArgs) {
    if (arg.startsWith('--groupUrl=')) groupUrl = arg.slice(11).trim();
    else if (arg.startsWith('--content=')) postContent = arg.slice(10).trim();
    else if (arg.startsWith('--images=')) imageUrlsArg = arg.slice(9).trim();
    else if (arg.startsWith('--account=')) accountId = arg.slice(10).trim();
    else if (arg.startsWith('--proxy=')) proxyUrl = arg.slice(8).trim();
    else if (arg === '--allowPostWithoutJoin' || arg === '--allow-post-without-join' || arg.startsWith('--allowPostWithoutJoin=true') || arg.startsWith('--allow-post-without-join=true')) {
      allowPostWithoutJoin = true;
    }
  }
} else {
  groupUrl = rawArgs[0] || '';
  postContent = rawArgs[1] || '';
  imageUrlsArg = rawArgs[2] || '';
  accountId = rawArgs[3] || 'acc_01';
  proxyUrl = rawArgs[4] || '';
  if (rawArgs.includes('--allowPostWithoutJoin') || rawArgs.includes('--allow-post-without-join') || rawArgs[5] === 'true' || rawArgs.some(a => a.startsWith('--allowPostWithoutJoin=true') || a.startsWith('--allow-post-without-join=true'))) {
    allowPostWithoutJoin = true;
  }
}

// Decode base64 content if prefixed
if (postContent.startsWith('BASE64:')) {
  try {
    postContent = Buffer.from(postContent.replace('BASE64:', ''), 'base64').toString('utf-8');
  } catch (e) {
    console.error('Failed to decode Base64 content: ' + e.message);
  }
}

const DATA_DIR = process.env.FB_POSTER_DATA_DIR || path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions', accountId);
let SESSION_PATH = path.join(SESSIONS_DIR, 'fb-session.json');

// Fallback to legacy root session if account-specific session doesn't exist yet
if (!fs.existsSync(SESSION_PATH) && fs.existsSync(path.join(DATA_DIR, 'fb-session.json'))) {
  SESSION_PATH = path.join(DATA_DIR, 'fb-session.json');
}

const SCREENSHOT_DIR = path.join(DATA_DIR, 'puppeteer image');

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs) + minMs);
}

async function saveDebugScreenshot(page, label) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    let groupId = 'unknown';
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('groups/')) {
        const parts = currentUrl.split('groups/')[1] || '';
        groupId = parts.split('/')[0] || 'unknown';
      }
    } catch (e) {}

    const filename = `${label}-${accountId}-group_${groupId}-${Date.now()}.png`;
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
  } catch (e) {
    console.error(`[Screenshot Error] Could not save screenshot: ${e.message}`);
  }
}

async function isFacebookLoginPrompt(page) {
  try {
    return await page.evaluate(() => {
      if (document.querySelector('input[type="password"], input[name="pass"], form[action*="login"]')) {
        return true;
      }
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

function normalizeGoogleDriveUrl(url) {
  if (!url) return '';
  if (!url.includes('drive.google.com') && !url.includes('lh3.googleusercontent.com')) return url;
  if (url.includes('lh3.googleusercontent.com/d/')) return url;

  let fileId = '';
  if (url.includes('/file/d/')) {
    const parts = url.split('/file/d/')[1] || '';
    fileId = parts.split('/')[0] || '';
  } else if (url.includes('id=')) {
    const parts = url.split('id=')[1] || '';
    fileId = parts.split('&')[0] || '';
  }

  if (fileId) return 'https://lh3.googleusercontent.com/d/' + fileId;
  return url;
}

function downloadImage(url, maxRedirects = 5) {
  url = normalizeGoogleDriveUrl(url);
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
        return downloadImage(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' downloading image from ' + url));
      const ext = (res.headers['content-type'] || '').includes('png') ? '.png' : '.jpg';
      const tempPath = path.join(os.tmpdir(), 'fb-post-image-' + Date.now() + '-' + Math.floor(Math.random() * 1000) + ext);
      const file = fs.createWriteStream(tempPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tempPath); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadImages(urls) {
  const downloadedPaths = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    try {
      console.error(`[Media] Downloading image ${i + 1}/${urls.length}: ${u}`);
      const filePath = await downloadImage(u);
      downloadedPaths.push(filePath);
    } catch (e) {
      console.error(`[Media Warning] Failed to download image ${i + 1} (${u}): ${e.message}`);
    }
  }
  return downloadedPaths;
}

async function postToGroup(targetGroupUrl, content, imagesArg, targetAccountId, targetProxy, allowPostWithoutJoin = false) {
  const startTime = Date.now();
  console.error(`\n[Post Engine 2.0] Starting post execution...`);
  console.error(`  Account: ${targetAccountId}`);
  console.error(`  Group URL: ${targetGroupUrl}`);
  console.error(`  Session Path: ${SESSION_PATH}`);
  if (targetProxy) console.error(`  Proxy: ${targetProxy}`);

  if (!fs.existsSync(SESSION_PATH)) {
    return {
      success: false,
      accountId: targetAccountId,
      groupUrl: targetGroupUrl,
      error: `fb-session.json not found for account "${targetAccountId}". Please run "node save-session.js ${targetAccountId}" first.`,
      isCheckpoint: false
    };
  }

  // Parse Image URLs
  let rawUrls = [];
  if (Array.isArray(imagesArg)) {
    rawUrls = imagesArg.filter(u => u && typeof u === 'string' && u.trim().length > 0);
  } else if (typeof imagesArg === 'string' && imagesArg.trim().length > 0) {
    try {
      if (imagesArg.startsWith('[') && imagesArg.endsWith(']')) {
        const parsed = JSON.parse(imagesArg);
        if (Array.isArray(parsed)) rawUrls = parsed.filter(Boolean);
      }
    } catch (e) {}
    if (rawUrls.length === 0) {
      if (imagesArg.includes('|||')) {
        rawUrls = imagesArg.split('|||').map(s => s.trim()).filter(Boolean);
      } else {
        rawUrls = [imagesArg.trim()];
      }
    }
  }

  const hasImages = rawUrls.length > 0;
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

    if (targetProxy) {
      try {
        const urlObj = new URL(targetProxy);
        launchOptions.proxy = {
          server: `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}`,
          username: urlObj.username || undefined,
          password: urlObj.password || undefined
        };
      } catch (e) {
        console.error(`[Proxy Warning] Failed to parse proxy "${targetProxy}": ${e.message}`);
      }
    }

    browser = await chromium.launch(launchOptions);

    context = await browser.newContext({
      storageState: SESSION_PATH,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      permissions: ['clipboard-read', 'clipboard-write']
    });

    page = await context.newPage();

    if (!hasImages) {
      await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,webm}', (route) => route.abort());
    }

    // --- Step 1: Session Warm-up & Feed Liveness (Anti-Detection) ---
    console.error('[Anti-Detect] Step 1: Visiting Home Feed for session warm-up...');
    try {
      await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(randomDelay(2500, 4500));

      // Check Checkpoint / Login Required on Home
      const currentHomeUrl = page.url();
      const isHomeLogin = await isFacebookLoginPrompt(page);
      if (currentHomeUrl.includes('checkpoint') || currentHomeUrl.includes('login') || currentHomeUrl.includes('recover') || isHomeLogin) {
        await saveDebugScreenshot(page, 'checkpoint-home');
        return {
          success: false,
          accountId: targetAccountId,
          groupUrl: targetGroupUrl,
          error: `Facebook Checkpoint / Re-login required for account [${targetAccountId}].`,
          isCheckpoint: true
        };
      }

      // Small natural scroll on Home Feed
      await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 400 + 300)));
      await page.waitForTimeout(randomDelay(1500, 3000));
    } catch (e) {
      console.error(`[Warm-up Note] Feed warm-up bypassed: ${e.message}`);
    }

    // --- Step 2: Navigate to Target Group ---
    console.error(`[Navigation] Step 2: Navigating to group: ${targetGroupUrl}`);
    await page.goto(targetGroupUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(randomDelay(3000, 5000));

    // Check Checkpoint or Login Prompt on Group Page
    const pageUrl = page.url();
    const isGroupLogin = await isFacebookLoginPrompt(page);
    if (pageUrl.includes('checkpoint') || pageUrl.includes('security') || pageUrl.includes('login') || isGroupLogin) {
      await saveDebugScreenshot(page, 'checkpoint-group');
      return {
        success: false,
        accountId: targetAccountId,
        groupUrl: targetGroupUrl,
        error: `Facebook Checkpoint or Login required on group navigation for account [${targetAccountId}].`,
        isCheckpoint: true
      };
    }

    // --- Step 3: Human Emulation in Group Timeline ---
    console.error('[Human Emulation] Exploring group feed timeline...');
    const scrolls = randomDelay(3, 5);
    let totalLiked = 0;

    for (let i = 0; i < scrolls; i++) {
      const scrollY = randomDelay(450, 850);
      await page.evaluate((y) => window.scrollBy(0, y), scrollY);
      await page.waitForTimeout(randomDelay(2000, 4000));

      // 25% chance to click "See more" / "Xem thêm"
      if (Math.random() < 0.25) {
        try {
          await page.evaluate(() => {
            const seeMores = Array.from(document.querySelectorAll('[role="button"], span, div'));
            for (const el of seeMores) {
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

      // 40% chance to like 1 visible post (up to 2 posts total)
      if (Math.random() < 0.4 && totalLiked < 2) {
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
            console.error(`[Human Emulation] Liked a post in group timeline (Total liked: ${totalLiked})`);
            await page.waitForTimeout(randomDelay(2500, 4500));
          }
        } catch (e) {}
      }
    }

    // Scroll back to top
    console.error('[Human Emulation] Scrolling back to top for post composer...');
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });
    await page.keyboard.press('Home');
    await page.waitForTimeout(randomDelay(3000, 5000));

    // Check if Account is a member of the group
    const notMember = await page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="button"]');
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if ((text === 'tham gia nhóm' || text === 'join group') && !btn.closest('[role="article"]')) {
          return text;
        }
      }
      return null;
    });

    if (notMember) {
      if (allowPostWithoutJoin) {
        console.error(`[Membership Note] Account [${targetAccountId}] is NOT a member of this group, but allowPostWithoutJoin is enabled. Proceeding to post composer...`);
      } else {
        return {
          success: false,
          accountId: targetAccountId,
          groupUrl: targetGroupUrl,
          error: `Account [${targetAccountId}] is NOT a member of this group. Please join group first.`,
          isCheckpoint: false
        };
      }
    }

    // --- Step 4: Close Messenger chat windows to prevent overlay blocking ---
    try {
      await page.evaluate(() => {
        const closeSelectors = [
          '[aria-label="Đóng đoạn chat"]',
          '[aria-label="Close chat"]',
          '[aria-label="Đóng cuộc trò chuyện"]',
          '[aria-label="Close conversation"]'
        ];
        for (const sel of closeSelectors) {
          document.querySelectorAll(sel).forEach(b => b.click());
        }
      });
    } catch (e) {}

    // --- Step 5: Click Post Composer ---
    let composerClicked = false;
    try {
      composerClicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('span, div, input')).reverse();
        for (const el of elements) {
          const text = (el.textContent || '').trim().toLowerCase();
          if ((text === 'bạn viết gì đi...' || text === 'bạn viết gì đi' || text === 'write something...') && el.children.length === 0) {
            const clickable = el.closest('[role="button"]') || el;
            clickable.click();
            return 'matched text: ' + text;
          }
        }
        return null;
      });
    } catch (e) {}

    if (!composerClicked) {
      try {
        await page.click('[data-pagelet="GroupInlineComposer"] [role="button"]', { timeout: 5000 });
        composerClicked = true;
      } catch (e1) {
        try {
          await page.click('[role="dialog"] [contenteditable="true"]', { timeout: 3000 });
          composerClicked = true;
        } catch (e2) {
          await saveDebugScreenshot(page, 'no-composer');
          return {
            success: false,
            accountId: targetAccountId,
            groupUrl: targetGroupUrl,
            error: 'Could not find post composer in group.',
            isCheckpoint: false
          };
        }
      }
    }

    await page.waitForTimeout(randomDelay(2000, 3500));

    // Handle Anonymous Post Dialog if it opens
    await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const dialog of dialogs) {
        const text = (dialog.textContent || '').toLowerCase();
        if (text.includes('ẩn danh') || text.includes('anonymous')) {
          const closeBtn = dialog.querySelector('[aria-label="Close"], [aria-label="Đóng"]');
          if (closeBtn) closeBtn.click();
        }
      }
    });

    // Wait for post composer dialog
    let composerDialog = null;
    try {
      await page.waitForFunction(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const d of dialogs) {
          const visible = d.offsetWidth > 0 || d.offsetHeight > 0;
          if (!visible) continue;
          const headers = d.querySelectorAll('h2, h3, h1, span[role="heading"]');
          for (const h of headers) {
            const t = (h.textContent || '').trim().toLowerCase();
            if (t.includes('tạo bài viết') || t.includes('create post') || t.includes('create a post')) return true;
          }
        }
        return false;
      }, { timeout: 10000 });
    } catch (e) {}

    const dialogs = await page.$$('[role="dialog"]');
    for (const d of dialogs) {
      const isPostDialog = await d.evaluate(el => {
        const headers = el.querySelectorAll('h2, h3, h1, span[role="heading"]');
        for (const h of headers) {
          const t = (h.textContent || '').trim().toLowerCase();
          if (t.includes('tạo bài viết') || t.includes('create post') || t.includes('create a post')) return true;
        }
        return false;
      });
      if (isPostDialog) {
        composerDialog = d;
        break;
      }
    }

    // --- Step 6: Find Text Editor & Paste Content ---
    let editor = null;
    if (composerDialog) {
      editor = await composerDialog.$('[contenteditable="true"]');
    } else {
      editor = await page.$('[data-pagelet="GroupInlineComposer"] [contenteditable="true"]');
    }

    if (!editor) {
      await saveDebugScreenshot(page, 'no-editor');
      return {
        success: false,
        accountId: targetAccountId,
        groupUrl: targetGroupUrl,
        error: 'Could not find text editor in post dialog.',
        isCheckpoint: false
      };
    }

    console.error('[Human Emulation] Inserting post content via Clipboard API & Keyboard...');
    await editor.click();
    await page.waitForTimeout(randomDelay(800, 1500));

    let pasteSuccess = false;
    try {
      await page.evaluate(async (txt) => {
        await navigator.clipboard.writeText(txt);
      }, content);
      await editor.focus();
      const modifier = os.platform() === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.press(`${modifier}+v`);
      await page.waitForTimeout(randomDelay(1000, 2000));
      pasteSuccess = await editor.evaluate(el => (el.textContent || '').trim().length > 0);
    } catch (e) {}

    if (!pasteSuccess) {
      console.error('[Fallback] Typing content line-by-line...');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
          await page.keyboard.type(lines[i], { delay: randomDelay(10, 25) });
        }
        if (i < lines.length - 1) {
          await page.keyboard.press('Enter');
          await page.waitForTimeout(randomDelay(100, 200));
        }
      }
    }

    await page.waitForTimeout(randomDelay(2500, 4500));

    // --- Step 7: Upload Media / Images ---
    if (hasImages) {
      try {
        const imageTempPaths = await downloadImages(rawUrls);
        if (imageTempPaths.length > 0) {
          console.error(`[Media] Uploading ${imageTempPaths.length} image(s)...`);
          let photoBtn = null;
          const searchContainer = composerDialog || page;
          const photoSelectors = [
            '[aria-label="Ảnh/video"]',
            '[aria-label="Ảnh/Video"]',
            '[aria-label="Photo/video"]',
            '[aria-label="Photo/Video"]',
            '[aria-label*="ảnh"]',
            '[aria-label*="Ảnh"]'
          ];
          for (const sel of photoSelectors) {
            photoBtn = await searchContainer.$(sel);
            if (photoBtn) break;
          }

          let fileChooser = null;
          if (photoBtn) {
            const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
            await photoBtn.click();
            fileChooser = await chooserPromise;
          }

          const uploadWaitMs = Math.max(6000, imageTempPaths.length * 3500);
          if (fileChooser) {
            await fileChooser.setFiles(imageTempPaths);
            await page.waitForTimeout(randomDelay(uploadWaitMs, uploadWaitMs + 3000));
          } else {
            const fileInputs = await searchContainer.$$('input[type="file"]');
            if (fileInputs.length > 0) {
              await fileInputs[0].setInputFiles(imageTempPaths);
              await page.waitForTimeout(randomDelay(uploadWaitMs, uploadWaitMs + 3000));
            }
          }
        }
      } catch (imgErr) {
        console.error(`[Media Warning] Image upload error: ${imgErr.message}`);
      }
    }

    // --- Step 8: Click Post Button ---
    console.error('[Action] Submitting post to Facebook Group...');
    let postBtn = null;
    const postSelectors = [
      '[aria-label="Đăng"]',
      '[aria-label="Post"]',
      '[aria-label="Gửi"]',
      '[aria-label="Submit"]'
    ];

    const containerForPost = composerDialog || page;
    for (const sel of postSelectors) {
      postBtn = await containerForPost.$(sel);
      if (postBtn) {
        const disabled = await postBtn.getAttribute('aria-disabled');
        if (disabled === 'true') {
          await page.waitForTimeout(3000);
        }
        await postBtn.click();
        console.error(`[Action] Clicked Post button via selector: ${sel}`);
        break;
      }
    }

    // Wait for post submission to settle
    await page.waitForTimeout(randomDelay(6000, 9000));

    // Check if dialog closed or if Action Blocked popup appeared
    const hasActionBlocked = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Bạn tạm thời bị chặn') || text.includes('You’re Temporarily Blocked') || text.includes('Action Blocked');
    });

    if (hasActionBlocked) {
      await saveDebugScreenshot(page, 'action-blocked');
      return {
        success: false,
        accountId: targetAccountId,
        groupUrl: targetGroupUrl,
        error: `Facebook Action Blocked for account [${targetAccountId}]. Daily limit reached or temporary spam block.`,
        isCheckpoint: true,
        durationSeconds: Math.round((Date.now() - startTime) / 1000)
      };
    }

    // Capture success screenshot
    await saveDebugScreenshot(page, 'success');

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error(`[Post Engine 2.0] Successfully posted to group in ${durationSeconds}s!`);

    return {
      success: true,
      accountId: targetAccountId,
      groupUrl: targetGroupUrl,
      durationSeconds: durationSeconds,
      proxy: targetProxy || 'Direct'
    };

  } catch (err) {
    if (page) await saveDebugScreenshot(page, 'exception');
    return {
      success: false,
      accountId: targetAccountId,
      groupUrl: targetGroupUrl,
      error: `Execution Exception: ${err.message}`,
      isCheckpoint: err.message.toLowerCase().includes('checkpoint'),
      durationSeconds: Math.round((Date.now() - startTime) / 1000)
    };
  } finally {
    // Luôn lưu lại cookie mới nhất (dù thành công hay thất bại) TRƯỚC khi đóng browser —
    // Facebook xoay token (xs/fr/sb) sau mỗi tương tác; nếu không lưu, lần chạy account
    // này tiếp theo (hoặc job kế tiếp trong cùng run-batch) sẽ gửi lại cookie cũ đã hết
    // hạn, bị Facebook coi là dấu hiệu replay/chiếm đoạt phiên và khóa session (RCA đã
    // xác nhận qua run #9437 ngày 2026-09-15: 9/15 lần Failed liên tiếp không phải
    // Checkpoint nhưng vẫn không lưu cookie mới). Không giới hạn chỉ nhánh success như
    // sync-group-memberships.js/warm-and-join.js, vì lỗi UI (không phải checkpoint) vẫn
    // cần lưu cookie đã xoay.
    if (context) {
      try {
        await context.storageState({ path: SESSION_PATH });
        console.error(`[Session Sync] Updated session cookies saved to: ${SESSION_PATH}`);
      } catch (e) {
        console.error(`[Session Sync Warning] Failed to save session state: ${e.message}`);
      }
    }
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

// CLI Direct Invocation Handler
if (require.main === module) {
  (async () => {
    if (!groupUrl || !postContent) {
      console.error('Usage: node post-to-group.js <group_url> <post_content_base64> [images] [accountId] [proxy] [--allowPostWithoutJoin]');
      process.exit(1);
    }
    const result = await postToGroup(groupUrl, postContent, imageUrlsArg, accountId, proxyUrl, allowPostWithoutJoin);
    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  })();
}

module.exports = { postToGroup };
