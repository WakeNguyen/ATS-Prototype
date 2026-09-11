/**
 * run-batch.js (v2.0 Multi-Account, Proxy & Smart 4G Reset IP Dispatcher)
 * Coordinates batch execution of Facebook group posts across multiple accounts,
 * with automatic 4G Mobile Proxy IP Rotation (mProxy.vn API integration).
 *
 * Usage:
 *   node run-batch.js <path_to_temp_json_payload>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawnSync, execSync } = require('child_process');

const jsonFile = process.argv[2];
if (!jsonFile || !fs.existsSync(jsonFile)) {
  console.error('[run-batch v2] Error: JSON payload file not found: ' + jsonFile);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
} catch (e) {
  console.error('[run-batch v2] Failed to parse JSON file: ' + e.message);
  process.exit(1);
}

const defaultContentB64 = data.postContentB64 || '';
const defaultImageUrls = data.postImageUrls || (data.postImageUrl ? [data.postImageUrl] : []);
const defaultImageUrl = data.postImageUrl || (defaultImageUrls.length > 0 ? defaultImageUrls[0] : '');

// Support both 'jobs' (v3 multi-account schema) and 'groups' (v2 legacy schema)
const jobs = data.jobs || data.groups || [];
const results = [];
const scriptPath = path.join(__dirname, 'post-to-group.js');

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
        // Wait 10s for 4G modem to re-establish cellular data connection
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

(async () => {
  console.error(`\n===============================================================`);
  console.error(`[run-batch v2] Starting Multi-Account Batch Runner`);
  console.error(`  Total Jobs / Groups: ${jobs.length}`);
  console.error(`  Default Images Count: ${defaultImageUrls.length}`);
  console.error(`===============================================================\n`);

  // Track per-account state during this batch
  const accountState = {}; // { acc_01: { lastPostTime: 0, postCount: 0, isBlocked: false } }
  let lastUsedAccountId = null;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const groupName = job.groupName || 'Unknown Group';
    const groupUrl = job.groupUrl || '';
    const accountId = job.accountId || job.account || 'acc_01';
    const proxyUrl = job.proxyUrl || job.proxy || '';
    const resetIpUrl = job.resetIpUrl || job.resetUrl || data.resetIpUrl || '';
    const contentB64 = job.postContentB64 || defaultContentB64;
    const imageUrls = job.postImageUrls || defaultImageUrls;
    const allowPostWithoutJoin = Boolean(job.allowPostWithoutJoin || data.allowPostWithoutJoin);

    if (!accountState[accountId]) {
      accountState[accountId] = { lastPostTime: 0, postCount: 0, isBlocked: false };
    }

    console.error(`\n[Job ${i + 1}/${jobs.length}] Processing "${groupName}" via Account [${accountId}] (allowPostWithoutJoin: ${allowPostWithoutJoin})`);

    // If this account was flagged as Checkpoint / Blocked earlier in this run, skip its remaining jobs
    if (accountState[accountId].isBlocked) {
      console.error(`[Skip] Account [${accountId}] is in Blocked/Checkpoint state. Skipping this group.`);
      const skipResult = {
        groupName: groupName,
        groupUrl: groupUrl,
        accountId: accountId,
        success: false,
        error: `Account [${accountId}] previously encountered Facebook Checkpoint/Block in this batch.`,
        isCheckpoint: true,
        phase: 'COMPLETED'
      };
      results.push(skipResult);
      try {
        const progressFile = jsonFile.replace(/\.json$/, '.ndjson');
        fs.appendFileSync(progressFile, JSON.stringify(skipResult) + '\n', 'utf-8');
      } catch (e) {}
      continue;
    }

    // --- Automatic 4G IP Rotation on Account Switch ---
    // If switching to a new account and Reset IP URL is provided, rotate 4G IP
    if (lastUsedAccountId !== null && lastUsedAccountId !== accountId && resetIpUrl) {
      console.error(`[Account Switch] Switching from [${lastUsedAccountId}] -> [${accountId}]. Triggering 4G IP rotation...`);
      await resetProxyIp(resetIpUrl);
    }

    // --- Smart Inter-Account Cooldown ---
    // If same account posted recently, enforce safe delay (default: 3 - 8 minutes)
    const now = Date.now();
    const timeSinceLastPostForThisAcc = now - accountState[accountId].lastPostTime;
    const minAccCooldownMs = (parseInt(process.env.MIN_ACCOUNT_COOLDOWN_SEC) || 120) * 1000;

    if (accountState[accountId].postCount > 0 && timeSinceLastPostForThisAcc < minAccCooldownMs) {
      const waitMs = minAccCooldownMs - timeSinceLastPostForThisAcc + Math.floor(Math.random() * 30000);
      console.error(`[Pacing] Account [${accountId}] posted recently. Waiting ${(waitMs / 1000 / 60).toFixed(2)} min for safety cooldown...`);
      execSync(`node -e "setTimeout(() => {}, ${waitMs})"`);
    }

    // Write STARTED marker to ndjson before running child process
    const progressFile = jsonFile.replace(/\.json$/, '.ndjson');
    try {
      const startMarker = {
        groupUrl,
        groupName,
        accountId,
        phase: 'STARTED',
        startedAt: new Date().toISOString()
      };
      fs.appendFileSync(progressFile, JSON.stringify(startMarker) + '\n', 'utf-8');
    } catch (e) {}

    let stdoutStr = '';
    let stderrStr = '';
    let processSuccess = false;
    let processError = '';

    try {
      const imagesPayload = Array.isArray(imageUrls) && imageUrls.length > 0
        ? JSON.stringify(imageUrls)
        : (defaultImageUrl || '');

      const spawnArgs = [
        scriptPath,
        groupUrl,
        `BASE64:${contentB64}`,
        imagesPayload,
        accountId,
        proxyUrl
      ];
      if (allowPostWithoutJoin) {
        spawnArgs.push('--allowPostWithoutJoin');
      }

      const res = spawnSync('node', spawnArgs, {
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 3600000 // 1 hour max per group
      });

      if (res.stdout) stdoutStr = res.stdout;
      if (res.stderr) stderrStr = res.stderr;
      processSuccess = (res.status === 0);
      if (!processSuccess) {
        processError = res.error ? res.error.message : `Process exited with code ${res.status}`;
      }
    } catch (e) {
      processSuccess = false;
      processError = e.message || 'Spawn error';
    }

    // Parse structured JSON output from post-to-group.js
    let parsed = null;
    try {
      const lines = stdoutStr.trim().split('\n');
      for (let j = lines.length - 1; j >= 0; j--) {
        const line = lines[j].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          parsed = JSON.parse(line);
          break;
        }
      }
    } catch (err) {}

    const finalResult = {
      groupName: groupName,
      groupUrl: groupUrl,
      accountId: accountId,
      success: parsed ? parsed.success : processSuccess,
      error: parsed ? (parsed.error || '') : (stderrStr || processError).substring(0, 300),
      isCheckpoint: parsed ? (parsed.isCheckpoint || false) : false,
      durationSeconds: parsed ? (parsed.durationSeconds || 0) : 0,
      proxy: proxyUrl || 'Direct',
      phase: 'COMPLETED'
    };

    results.push(finalResult);
    try {
      fs.appendFileSync(progressFile, JSON.stringify(finalResult) + '\n', 'utf-8');
    } catch (e) {}

    // Update account tracking
    accountState[accountId].lastPostTime = Date.now();
    lastUsedAccountId = accountId;

    if (finalResult.success) {
      accountState[accountId].postCount++;
      console.error(`[Job ${i + 1}] SUCCESS! (Account [${accountId}] total today in batch: ${accountState[accountId].postCount})`);
    } else {
      console.error(`[Job ${i + 1}] FAILED. Error: ${finalResult.error}`);
      if (finalResult.isCheckpoint) {
        accountState[accountId].isBlocked = true;
        console.error(`[Checkpoint Alert] Account [${accountId}] marked as Blocked/Checkpoint.`);
      }
    }

    // Brief random delay before next job in batch (15 - 45s between different accounts)
    if (i < jobs.length - 1) {
      const nextJob = jobs[i + 1];
      const isSameAcc = (nextJob.accountId || 'acc_01') === accountId;
      const interJobDelaySec = isSameAcc ? (parseInt(process.env.MIN_SAME_ACC_DELAY_SEC) || 90) : (parseInt(process.env.MIN_DIFF_ACC_DELAY_SEC) || 20);
      const delayMs = Math.floor(Math.random() * 15000 + (interJobDelaySec * 1000));
      console.error(`[Anti-Spam Delay] Waiting ${(delayMs / 1000).toFixed(0)}s before next job...`);
      execSync(`node -e "setTimeout(() => {}, ${delayMs})"`);
    }
  }

  // Clean up temp payload
  try {
    fs.unlinkSync(jsonFile);
  } catch (e) {}

  console.error(`\n===============================================================`);
  console.error(`[run-batch v2] Batch completed for ${jobs.length} jobs.`);
  console.error(`===============================================================\n`);

  // Output final structured JSON array to stdout for Host Bridge
  console.log(JSON.stringify(results));
})();
