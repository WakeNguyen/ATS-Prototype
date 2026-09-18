/**
 * bridge-server.js (v1.0 HTTP Microservice Bridge for n8n ↔ Playwright on VPS)
 * 
 * Exposes internal HTTP endpoints on VPS host (0.0.0.0:5680) to allow n8n containers
 * (n8n, n8n-worker) to dispatch Facebook Auto-Post and Auto-Warm/Join batches to 
 * Playwright host processes via Docker gateway (172.18.0.1).
 * 
 * Security & Design:
 * - Requires 'x-internal-secret' header matching BRIDGE_INTERNAL_SECRET env var.
 * - Log Sanitization: Never logs raw payload or credentials (proxy_url, passwords, 2FA).
 * - Spawns child processes asynchronously using child_process.spawn with 55m timeout guard.
 * - Automatic temp JSON payload lifecycle management.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Load environment variables from local .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const PORT = parseInt(process.env.BRIDGE_PORT || '5680', 10);
const SECRET = process.env.BRIDGE_INTERNAL_SECRET;
const PROCESS_TIMEOUT_MS = parseInt(process.env.BRIDGE_TIMEOUT_MS || '3300000', 10); // 55 minutes

if (!SECRET) {
  console.error('[BRIDGE WARNING] BRIDGE_INTERNAL_SECRET is not configured in environment or .env!');
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Connection': 'close'
  });
  res.end(JSON.stringify(data));
}

/**
 * Execute child node script with temp JSON payload
 * 
 * @param {string} scriptName - 'run-batch.js' or 'warm-and-join.js'
 * @param {string} tempPrefix - Prefix for temp file
 * @param {Object} payload - JSON payload from client
 * @param {string} runLabel - Sanitized label for logging
 * @returns {Promise<{statusCode: number, data: Object}>}
 */
async function executeScript(scriptName, tempPrefix, payload, runLabel) {
  const tempId = crypto.randomUUID();
  const tempFilePath = path.join('/tmp', `${tempPrefix}-${tempId}.json`);
  const scriptFullPath = path.join(__dirname, scriptName);

  if (!fs.existsSync(scriptFullPath)) {
    return {
      statusCode: 500,
      data: { success: false, error: `Script not found: ${scriptName}` }
    };
  }

  // 1. Write payload to temporary file
  try {
    fs.writeFileSync(tempFilePath, JSON.stringify(payload), 'utf-8');
  } catch (err) {
    console.error(`[${runLabel}] Failed to create temp file: ${err.message}`);
    return {
      statusCode: 500,
      data: { success: false, error: `Failed to write temp payload: ${err.message}` }
    };
  }

  console.log(`[${new Date().toISOString()}] [${runLabel}] Spawning: node ${scriptName} (temp: ${tempFilePath})`);
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let isFinished = false;

    const child = spawn(process.execPath, [scriptFullPath, tempFilePath], {
      cwd: __dirname,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const progressFilePath = path.join('/tmp', `${tempPrefix}-${tempId}.ndjson`);

    // 55m Timeout guard against hung browser sessions
    const timeoutHandle = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        console.error(`[${runLabel}] Process timed out after ${PROCESS_TIMEOUT_MS / 1000}s. Terminating...`);
        try { child.kill('SIGKILL'); } catch (e) {}

        const partialResults = parseNdjsonResults(progressFilePath);

        cleanupTempFile();
        resolve({
          statusCode: 504,
          data: {
            success: false,
            error: `Execution timed out after ${PROCESS_TIMEOUT_MS / 1000}s`,
            partialResults: partialResults,
            output: partialResults.length > 0 ? JSON.stringify(partialResults) : stdoutData.slice(-2000),
            stdout: stdoutData.slice(-2000),
            stderr: stderrData.slice(-2000)
          }
        });
      }
    }, PROCESS_TIMEOUT_MS);

    function cleanupTempFile() {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (e) {}
      try {
        if (fs.existsSync(progressFilePath)) {
          fs.unlinkSync(progressFilePath);
        }
      } catch (e) {}
    }

    function parseNdjsonResults(filePath) {
      const completedResults = [];
      let startedItem = null;

      if (fs.existsSync(filePath)) {
        try {
          const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line.trim());
              if (obj.phase === 'STARTED') {
                startedItem = obj;
              } else if (obj.phase === 'COMPLETED' || obj.success !== undefined) {
                completedResults.push(obj);
                if (startedItem && startedItem.groupUrl === obj.groupUrl) {
                  startedItem = null;
                }
              }
            } catch (pe) {}
          }
        } catch (e) {}
      }

      // If an item was STARTED but never reached COMPLETED before SIGKILL/timeout
      if (startedItem) {
        completedResults.push({
          groupName: startedItem.groupName || 'Unknown Group',
          groupUrl: startedItem.groupUrl,
          accountId: startedItem.accountId,
          success: false,
          error: 'INTERRUPTED_MID_PROCESSING',
          interrupted: true,
          phase: 'INTERRUPTED'
        });
      }

      return completedResults;
    }

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      // Stream progress to bridge stderr without logging sensitive credentials
      process.stderr.write(chunk);
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeoutHandle);
      cleanupTempFile();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[${runLabel}] Child process error (${elapsed}s): ${err.message}`);
      resolve({
        statusCode: 500,
        data: {
          success: false,
          error: `Process error: ${err.message}`,
          stderr: stderrData.slice(-2000)
        }
      });
    });

    child.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeoutHandle);
      const parsedFromNdjson = parseNdjsonResults(progressFilePath);
      cleanupTempFile();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${runLabel}] Finished with exit code ${code} in ${elapsed}s`);

      // Try parsing stdout JSON output from script
      let parsedOutput = null;
      const trimmedStdout = stdoutData.trim();

      // 1. Thu parse TOAN BO truoc — day la truong hop chuan: script chi in DUY NHAT 1 dong
      //    console.log(JSON.stringify(...)) ra stdout, moi log khac deu qua stderr.
      try {
        parsedOutput = JSON.parse(trimmedStdout);
      } catch (directParseErr) {
        // 2. Fallback: neu stdout co lan them text thua o DAU (truong hop hiem), tim vi tri
        //    ky tu '[' hoac '{' DAU TIEN (indexOf, KHONG PHAI lastIndexOf)
        try {
          const jsonStart = trimmedStdout.indexOf('[');
          const jsonObjStart = trimmedStdout.indexOf('{');
          const startIdx = (jsonStart >= 0 && (jsonObjStart === -1 || jsonStart < jsonObjStart)) ? jsonStart : jsonObjStart;
          if (startIdx >= 0) {
            parsedOutput = JSON.parse(trimmedStdout.substring(startIdx));
          }
        } catch (fallbackParseErr) {
          parsedOutput = null;
        }
      }

      if (!parsedOutput && parsedFromNdjson.length > 0) {
        parsedOutput = parsedFromNdjson;
      }

      if (parsedOutput) {
        resolve({
          statusCode: 200,
          data: parsedOutput
        });
      } else {
        // Return raw summary
        resolve({
          statusCode: code === 0 ? 200 : 500,
          data: {
            success: code === 0,
            exitCode: code,
            elapsedSeconds: parseFloat(elapsed),
            output: stdoutData.slice(-3000),
            error: stderrData.slice(-2000)
          }
        });
      }
    });
  });
}

/**
 * HTTP Server Dispatcher
 */
const server = http.createServer(async (req, res) => {
  const method = req.method;
  const url = req.url || '';

  // Optional Health check endpoint
  if (method === 'GET' && (url === '/health' || url === '/')) {
    return sendJson(res, 200, {
      status: 'ok',
      service: 'fb-bridge-server',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // Authentication check on all API routes
  const reqSecret = req.headers['x-internal-secret'];
  if (!SECRET || !reqSecret || reqSecret !== SECRET) {
    console.warn(`[${new Date().toISOString()}] Unauthorized access attempt from ${req.socket.remoteAddress} on ${url}`);
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  // Parse Body
  let rawBody = '';
  req.on('data', chunk => {
    rawBody += chunk.toString();
    // Safety limit: max 20MB payload
    if (rawBody.length > 20 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on('end', async () => {
    let payload = {};
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON payload' });
      }
    }

    // Route: POST /api/facebook-post-v2
    if (method === 'POST' && url === '/api/facebook-post-v2') {
      const totalJobs = (payload.jobs || payload.groups || []).length;
      const runLabel = `FB-POST (runId: ${payload.runId || 'direct'}, jobs: ${totalJobs})`;
      console.log(`[${new Date().toISOString()}] Incoming ${runLabel}`);

      const result = await executeScript('run-batch.js', 'fb-post', payload, runLabel);
      return sendJson(res, result.statusCode, result.data);
    }

    // Route: POST /api/facebook-warm-join
    if (method === 'POST' && url === '/api/facebook-warm-join') {
      const totalAccounts = (payload.accounts || []).length;
      const totalGroups = (payload.targetGroups || []).length;
      const runLabel = `WARM-JOIN (accounts: ${totalAccounts}, groups: ${totalGroups})`;
      console.log(`[${new Date().toISOString()}] Incoming ${runLabel}`);

      const result = await executeScript('warm-and-join.js', 'fb-warm', payload, runLabel);
      return sendJson(res, result.statusCode, result.data);
    }

    // Route: POST /api/facebook-sync-joins (Workflow D: Fast Group Membership Sync)
    if (method === 'POST' && url === '/api/facebook-sync-joins') {
      const totalAccounts = (payload.accounts || []).length;
      const runLabel = `SYNC-JOINS (accounts: ${totalAccounts})`;
      console.log(`[${new Date().toISOString()}] Incoming ${runLabel}`);

      const result = await executeScript('sync-group-memberships.js', 'fb-sync', payload, runLabel);
      return sendJson(res, result.statusCode, result.data);
    }

    // Route Not Found
    return sendJson(res, 404, { error: `Not found: ${method} ${url}` });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 FB Playwright HTTP Bridge Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔐 Internal Authentication: Enabled ('x-internal-secret' required)`);
  console.log(`📁 Working Directory: ${__dirname}`);
  console.log(`⏱️ Timeout Guard: ${PROCESS_TIMEOUT_MS / 1000}s`);
  console.log(`===============================================================\n`);
});
