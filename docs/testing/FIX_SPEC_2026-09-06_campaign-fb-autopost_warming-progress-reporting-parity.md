# FIX_SPEC_2026-09-06 — Bo Sung Co Che Bao Tien Do (%) Cho Warming Campaign, Dong Bo Voi Job Posting

**Nguoi yeu cau**: Thuc (Architect). Nguyen tac da xac lap tu truoc: "Warming cung chi la 1 loai campaign" -> moi co che (bao gom bao tien do) phai ap dung chung cho ca 2 loai `campaign_type` ('Job Posting' va 'Warming'), khong duoc de Warming la mot nhanh rieng le, thieu tinh nang so voi Job Posting.

**Boi canh hien trang** (da xac minh qua doc code + Supabase MCP + n8n MCP, khong doan):

1. Job Posting (Workflow A, `9W588GooZeZhiSKm`) da co san co che bao tien do: `Call VPS Bridge: facebook-post-v2` tra ve mang JSON (n8n tu dong tach thanh N item, 1 item/nhom) -> `Process Bridge Results` (code node) map thanh N item `{runId, campaignId, completedItem}` -> `Loop: Report Each Group Result` (node `n8n-nodes-base.splitInBatches`, batchSize mac dinh = 1) -> nhanh loop goi `POST campaign-run-progress` (webhook `src/app/api/webhooks/campaign-run-progress/route.js`) cho TUNG nhom, insert 1 dong `campaign_run_items` + cap nhat notification tai cho khi vuot moc 25/50/75/100% (so voi `campaign_runs.stats.lastNotifiedMilestone`) -> khi Loop het item, nhanh "done" chay `Build Final Run Summary` -> `POST campaign-run-callback` (chi dong lai `campaign_runs`/`campaigns.status`/notification cuoi cung, KHONG insert item nao ca — viec insert item da lam xong o buoc progress).

2. Warming (Workflow C, `L8QdckqW7FDwanRq`) hien **KHONG co co che tuong duong**: `Call VPS Bridge: facebook-warm-join` tra ve toan bo ket qua 1 lan -> `Process Bridge Warm Results` (code node) gop TAT CA account + group thanh 1 mang `items[]` duy nhat trong 1 item n8n -> goi thang `POST warm-join-run-callback` MOT LAN DUY NHAT o cuoi. Route `warm-join-run-callback` (`src/app/api/webhooks/warm-join-run-callback/route.js`) tu lam TAT CA moi viec trong 1 lan: insert het `warm_join_run_items`, cap nhat `fb_accounts`/`social_group_urls`, tinh `stats` — khong co buoc bao moc % nao ca.

3. **Phat hien them (ngoai pham vi user hoi truc tiep nhung lien quan mat thiet)**: `warm-join-run-callback` hien tai **khong bao gio dong/cap nhat notification "FB Warming & Auto-Join in Progress"** (notification duoc tao luc bat dau boi `_acquireWarmJoinRunLock`, `type='warm_join_started'`) thanh trang thai hoan tat — khac voi `campaign-run-callback` cua Job Posting co buoc update notification cuoi cung ro rang (`type='campaign_completed'`, title/message/severity theo status). Neu chi them progress ma khong sua cai nay, notification se bi "ket" mai o trang thai "dang chay X%" ngay ca khi run da xong tu lau — TE HON hien trang (hien tai it nhat no khong noi sai). Spec nay BAT BUOC phai vay them buoc dong notification vao `warm-join-run-callback`.

4. Gioi han kien truc CHUNG cho ca 2 loai (da xac minh qua doc `scripts/bridge-server.js`): VPS Bridge (`executeScript()`) dem het output vao bo nho va chi tra ve 1 response DUY NHAT sau khi child process (`run-batch.js` hoac `warm-and-join.js`) chay xong hoan toan (khong streaming). Vi vay CA HAI co che progress (Job Posting dang co, va Warming sap them) deu KHONG "live" trong luc script chay that tren VPS — cac moc 25/50/75/100% deu duoc bao don don ngay sau khi bridge tra ve toan bo ket qua, chi cach nhau vai trieu giay do do tre HTTP goi tuan tu trong Loop. Day la gioi han da duoc chap nhan cho Job Posting; spec nay CHI ap dung dong bo cung 1 gioi han/co che do cho Warming, khong co gang lam "live that" (se can sua sau `warm-and-join.js` + VPS bridge, ngoai pham vi spec nay).

**Don vi tien do cho Warming**: dung so TAI KHOAN (account) da xu ly xong, KHONG dung so nhom (group). Ly do: `totalPlanned` (tong so account se chay) da biet CHINH XAC ngay tu luc dang ky run (buoc `_acquireWarmJoinRunLock`, truoc khi goi n8n), trong khi so luong nhom join duoc moi account la bien doi (0-2 nhom/acc tuy con nhom trong). Dieu nay cung khop voi UI hien tai da ghi ro "Execution Mode: Strict Sequential (1 by 1)" — nguoi dung dang nhin nhan tien do theo tung account.

---

## PHAN 1 — Backend: `src/app/campaign_actions.js` — ham `_acquireWarmJoinRunLock`

Muc dich: ghi `totalPlanned` (= so account se chay) vao `warm_join_runs.stats` NGAY LUC TAO RUN, de route progress sau nay khong can tinh lai.

Tim doan (buoc 6, insert `warm_join_runs`):

```js
    // 6. Create warm_join_runs record
    const summaryMsg = triggerSource === 'cron'
      ? `[Scheduled Cron] Queued ${targetAccounts.length} active account(s) for auto-warm & join`
      : `Queued ${targetAccounts.length} account(s) and ${targetGroups.length} target group(s) for warming & auto-join`;

    const [run] = await sqlTx`
      INSERT INTO warm_join_runs (
        campaign_id, status, trigger_source, started_at, summary, notification_id, created_time
      ) VALUES (
        ${resolvedCampaignId || null}, 'Running', ${triggerSource}, now(),
        ${summaryMsg},
        ${notif?.id || null},
        now()
      )
      RETURNING id
    `;
```

Sua thanh (them cot `stats` voi `totalPlanned`):

```js
    // 6. Create warm_join_runs record
    const summaryMsg = triggerSource === 'cron'
      ? `[Scheduled Cron] Queued ${targetAccounts.length} active account(s) for auto-warm & join`
      : `Queued ${targetAccounts.length} account(s) and ${targetGroups.length} target group(s) for warming & auto-join`;

    const [run] = await sqlTx`
      INSERT INTO warm_join_runs (
        campaign_id, status, trigger_source, started_at, summary, notification_id, stats, created_time
      ) VALUES (
        ${resolvedCampaignId || null}, 'Running', ${triggerSource}, now(),
        ${summaryMsg},
        ${notif?.id || null},
        ${sqlTx.json({ totalPlanned: targetAccounts.length })},
        now()
      )
      RETURNING id
    `;
```

Ngoai ra, sua metadata cua notification `warm_join_started` (buoc 5, ngay truoc buoc 6) de them 2 truong `total`/`completed` cho dong bo hinh dang voi metadata cua Job Posting (`campaign_started`). Tim:

```js
        ${sqlTx.json({
          campaignId: resolvedCampaignId,
          campaignName,
          triggerSource,
          accountCount: targetAccounts.length,
          targetGroupsCount: targetGroups.length,
          accountIds: activeAccountIds
        })},
```

Sua thanh:

```js
        ${sqlTx.json({
          campaignId: resolvedCampaignId,
          campaignName,
          triggerSource,
          accountCount: targetAccounts.length,
          targetGroupsCount: targetGroups.length,
          accountIds: activeAccountIds,
          total: targetAccounts.length,
          completed: 0
        })},
```

---

## PHAN 2 — Backend: Route MOI `src/app/api/webhooks/warm-join-run-progress/route.js`

Tao file moi, noi dung day du (mo phong chinh xac logic + phong cach cua `campaign-run-progress/route.js`, thay doi don vi tinh tien do thanh "account" va gop them cac side-effect von dang nam trong `warm-join-run-callback` cho tung account):

```js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

const PROGRESS_MILESTONES = [25, 50, 75, 100];

/**
 * POST /api/webhooks/warm-join-run-progress
 * Receives the result of ONE finished FB account (warm + auto-join sub-items) from n8n.
 * Inserts warm_join_run_items rows (1 account-level row + N group-level rows), applies
 * the same side-effects as the old end-of-run callback used to (per account instead of
 * batched at the end), and updates the in-app notification in-place when a new
 * progress milestone (25/50/75/100%) is crossed. Mirrors campaign-run-progress/route.js.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, completedAccount } = body;

    if (!runId || !completedAccount) {
      return NextResponse.json({ error: 'runId and completedAccount are required' }, { status: 400 });
    }

    const {
      fbAccountId = null,
      accountAction = 'Warmed',
      accountErrorMessage = null,
      groupItems = []
    } = completedAccount;

    await sql.begin(async (sqlTx) => {
      // 1. Insert the account-level item row (social_group_id = NULL marks it as the
      //    "1 account done" tick used for progress counting).
      await sqlTx`
        INSERT INTO warm_join_run_items (
          run_id, fb_account_id, social_group_id, group_name, group_url,
          action, error_message, created_time
        ) VALUES (
          ${runId}, ${fbAccountId || null}, NULL, NULL, NULL,
          ${accountAction}, ${accountErrorMessage || null}, now()
        )
      `;

      // 2. If account hit Checkpoint, flag it immediately (don't wait for run to finish)
      if (accountAction === 'Checkpoint' && fbAccountId) {
        await sqlTx`
          UPDATE fb_accounts SET status = 'Checkpoint', updated_time = now()
          WHERE id = ${fbAccountId}
        `;
      }

      // 3. Insert one warm_join_run_items row per group action + apply side-effects
      //    (identical logic to what warm-join-run-callback used to do per item).
      for (const g of groupItems) {
        const socialGroupId = g.socialGroupId || null;
        const groupName = g.groupName || '';
        const groupUrl = g.groupUrl || '';
        const action = g.action || 'Joined';
        const itemError = g.errorMessage || null;
        const adminQuestions = g.adminQuestions || null;
        const needsCustomAnswer = !!g.needsCustomAnswer;

        await sqlTx`
          INSERT INTO warm_join_run_items (
            run_id, fb_account_id, social_group_id, group_name, group_url,
            action, error_message, created_time
          ) VALUES (
            ${runId}, ${fbAccountId || null}, ${socialGroupId}, ${groupName}, ${groupUrl},
            ${action}, ${itemError || null}, now()
          )
        `;

        if (action === 'Joined' && socialGroupId && fbAccountId) {
          await sqlTx`
            UPDATE social_group_urls SET
              join_status = 'Joined',
              last_posted_account_id = ${fbAccountId}
            WHERE id = ${socialGroupId}
          `;
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${fbAccountId}, ${socialGroupId}, now())
            ON CONFLICT (fb_account_id, social_group_id) DO UPDATE
            SET joined_at = EXCLUDED.joined_at
          `;
        }

        if ((needsCustomAnswer || action === 'AutoAnswered' || action === 'JoinRequested') && adminQuestions && socialGroupId) {
          await sqlTx`
            UPDATE social_group_urls SET
              join_status = 'Needs Custom Answer',
              admin_questions = ${adminQuestions}
            WHERE id = ${socialGroupId}
          `;
          await sqlTx`
            INSERT INTO notifications (
              type, title, message, severity, link, metadata, created_at, updated_at
            ) VALUES (
              'warm_join_needs_attention',
              'Can dien cau tra loi xet duyet nhom',
              ${'Nhom "' + (groupName || 'Facebook Group') + '" yeu cau cau hoi xet duyet moi: ' + adminQuestions.substring(0, 150)},
              'warning',
              ${'/campaigns?tab=social-groups&group_id=' + socialGroupId},
              ${sqlTx.json({ runId, socialGroupId, groupName, adminQuestions })},
              now(), now()
            )
          `;
        }
      }

      // 4. Touch last_warmed_at for this account
      if (fbAccountId) {
        await sqlTx`
          UPDATE fb_accounts SET last_warmed_at = now(), updated_time = now()
          WHERE id = ${fbAccountId}
        `;
      }

      // 5. Aggregate progress & update notification in-place (milestones 25/50/75/100)
      const [run] = await sqlTx`
        SELECT wjr.id, wjr.campaign_id, wjr.notification_id, wjr.stats,
               COALESCE(c.campaign_name, 'Global Warming & Auto-Join') AS campaign_name
        FROM warm_join_runs wjr
        LEFT JOIN campaigns c ON wjr.campaign_id = c.id
        WHERE wjr.id = ${runId}
        FOR UPDATE
      `;

      if (run && run.notification_id) {
        const [counts] = await sqlTx`
          SELECT
            COUNT(*) FILTER (WHERE social_group_id IS NULL)::int as completed_accounts,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Warmed')::int as warmed_count,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Failed')::int as failed_account_count,
            COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Checkpoint')::int as checkpoint_count,
            COUNT(*) FILTER (WHERE action = 'Joined')::int as joined_count
          FROM warm_join_run_items
          WHERE run_id = ${runId}
        `;

        const lastNotifiedMilestone = Number(run.stats?.lastNotifiedMilestone) || 0;
        const totalPlanned = Number(run.stats?.totalPlanned) || counts.completed_accounts;
        const currentPct = totalPlanned > 0
          ? Math.floor((counts.completed_accounts / totalPlanned) * 100)
          : 0;

        const newMilestone = PROGRESS_MILESTONES
          .filter(m => currentPct >= m && m > lastNotifiedMilestone)
          .pop();

        if (newMilestone) {
          const progressMessage = `Chien dich "${run.campaign_name}": ${newMilestone}% hoan tat ` +
            `(${counts.completed_accounts}/${totalPlanned} tai khoan - nuoi thanh cong ${counts.warmed_count}` +
            `${counts.joined_count > 0 ? `, da vao ${counts.joined_count} nhom` : ''}` +
            `${counts.failed_account_count > 0 ? `, ${counts.failed_account_count} loi` : ''}` +
            `${counts.checkpoint_count > 0 ? `, ${counts.checkpoint_count} checkpoint` : ''})`;

          await sqlTx`
            UPDATE notifications SET
              title = ${'Dang nuoi tai khoan... (' + newMilestone + '%)'},
              message = ${progressMessage},
              metadata = jsonb_set(
                metadata,
                '{progress}',
                ${sqlTx.json({
                  totalPlanned,
                  completed: counts.completed_accounts,
                  warmed: counts.warmed_count,
                  joined: counts.joined_count,
                  failed: counts.failed_account_count,
                  checkpoint: counts.checkpoint_count,
                  milestone: newMilestone
                })}
              ),
              is_read = false,
              updated_at = now()
            WHERE id = ${run.notification_id}
          `;

          await sqlTx`
            UPDATE warm_join_runs SET
              stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{lastNotifiedMilestone}', ${sqlTx.json(newMilestone)})
            WHERE id = ${runId}
          `;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook warm-join-run-progress] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

Luu y quan trong ve `metadata = jsonb_set(metadata, ...)`: giong het campaign-run-progress, gia dinh cot `metadata` cua notification KHONG NULL (da duoc INSERT voi 1 object jsonb hop le tu `_acquireWarmJoinRunLock` — dung `sqlTx.json({...})` chu khong phai `NULL`) — dieu nay dung voi code hien tai cua `_acquireWarmJoinRunLock`, khong can sua gi them.

---

## PHAN 3 — Backend: Sua `src/app/api/webhooks/warm-join-run-callback/route.js`

Muc dich: (a) BO het logic insert item + side-effect per-item (vi Phan 2 da lam roi, giu lai se INSERT TRUNG LAP du lieu), (b) tinh `stats` cuoi cung bang query aggregate tu `warm_join_run_items` thay vi tu mang `items[]` trong request body (khong con nhan `items` nua), (c) THEM buoc dong notification chinh (`warm_join_started` -> hoan tat) — day la phan VA LOI thuc su, khong chi la "ap dung chung" (xem muc 3 trong Boi Canh o tren).

Thay THE TOAN BO noi dung file bang:

```js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (val) => typeof val === 'string' && UUID_REGEX.test(val.trim());

/**
 * POST /api/webhooks/warm-join-run-callback
 * Called by n8n ONCE after the entire Auto-Warm & Group Auto-Joiner run finishes.
 * As of 2026-09-06, per-item insertion + side-effects moved to
 * warm-join-run-progress/route.js (called once per account, mirroring
 * campaign-run-progress/campaign-run-callback split for Job Posting). This route
 * is now a pure finalizer: closes warm_join_runs, computes final aggregate stats
 * from warm_join_run_items, and closes out the main run notification.
 * Protected by `x-internal-secret` header.
 */
export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      runId,
      status = 'Completed',
      summary = '',
      errorMessage = null,
      n8nExecutionId = null
    } = body;

    let targetRunId = isValidUUID(runId) ? runId.trim() : null;

    if (!targetRunId) {
      return NextResponse.json({ error: 'runId is required and must be a valid UUID' }, { status: 400 });
    }

    await sql.begin(async (sqlTx) => {
      // 1. Compute final aggregate stats from items already inserted by warm-join-run-progress
      const [counts] = await sqlTx`
        SELECT
          COUNT(*) FILTER (WHERE social_group_id IS NULL)::int as total_accounts,
          COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Warmed')::int as warmed_count,
          COUNT(*) FILTER (WHERE action = 'Joined')::int as joined_count,
          COUNT(*) FILTER (WHERE action = 'Failed')::int as failed_count,
          COUNT(*) FILTER (WHERE social_group_id IS NULL AND action = 'Checkpoint')::int as checkpoint_count
        FROM warm_join_run_items
        WHERE run_id = ${targetRunId}
      `;

      // 2. Update warm_join_runs (status + merge final stats, preserve totalPlanned/lastNotifiedMilestone)
      const [run] = await sqlTx`
        UPDATE warm_join_runs SET
          status = ${status},
          completed_at = now(),
          summary = ${summary || null},
          error_message = ${errorMessage || null},
          n8n_execution_id = ${n8nExecutionId || null},
          stats = COALESCE(stats, '{}'::jsonb) || ${sqlTx.json({
            totalItems: counts.total_accounts,
            warmedCount: counts.warmed_count,
            joinedCount: counts.joined_count,
            failedCount: counts.failed_count,
            checkpointCount: counts.checkpoint_count
          })}
        WHERE id = ${targetRunId}
        RETURNING id, notification_id
      `;

      if (!run) {
        throw new Error(`warm_join_runs with ID ${targetRunId} not found`);
      }

      // 3. Close out the main run notification (was previously never closed — bugfix)
      if (run.notification_id) {
        const severity = status === 'Failed' ? 'error' : (status === 'PartialSuccess' ? 'warning' : 'success');
        const notifTitle = status === 'Failed'
          ? 'Phien nuoi tai khoan that bai'
          : (status === 'PartialSuccess' ? 'Phien nuoi tai khoan hoan tat mot phan' : 'Phien nuoi tai khoan hoan tat');

        await sqlTx`
          UPDATE notifications SET
            type = 'warm_join_completed',
            title = ${notifTitle},
            message = ${summary || 'Phien nuoi tai khoan & tu dong tham gia nhom da hoan tat.'},
            severity = ${severity},
            is_read = false,
            updated_at = now()
          WHERE id = ${run.notification_id}
        `;
      }
    });

    return NextResponse.json({ success: true, runId: targetRunId });
  } catch (error) {
    console.error('[Webhook warm-join-run-callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Luu y quan trong**: ban cu co logic "neu `runId` thieu/khong hop le thi TU TAO 1 dong `warm_join_runs` moi" (danh cho truong hop legacy/khong co runId truoc). Ban moi BO logic do (bat buoc phai co `runId` hop le, tra loi 400 neu thieu) — vi voi kien truc moi, `warm_join_runs` LUON duoc tao truoc boi `_acquireWarmJoinRunLock` (ca nhanh cron lan ats_ui deu di qua ham nay), nen callback khong con ly do hop le nao de nhan mot request khong co `runId`. Neu AG phat hien co truong hop thuc te nao con dung duong callback khong-runId (vi du legacy webhook cu chua migrate), BAO LAI Claude truoc khi xoa nhanh do, dung tu y xoa neu chua chac chan an toan.

---

## PHAN 4 — n8n Workflow C (`L8QdckqW7FDwanRq`, "C: FB Auto-Warm & Group Auto-Joiner") — KHONG duoc tu publish/active, giu nguyen trang thai hien tai cho Claude QA truoc

### 4.1 — Sua code node "Process Bridge Warm Results"

Thay THE TOAN BO code hien tai bang (thay doi chinh: KHONG con gop het thanh 1 mang `items[]` phang; thay vao do fan-out thanh N item n8n, moi item = 1 account voi `groupItems` long ben trong; cung khong con tinh `overallStatus`/`summary` o day nua — chuyen sang node moi "Build Final Warm Run Summary" o buoc 4.3):

```js
const bridgeOutput = $input.first().json;
const allocatorData = $('Smart Group Allocator & Dispatcher').first().json;
const accounts = allocatorData.accounts || [];
const runId = allocatorData.runId;

const accMap = {};
for (const a of accounts) {
  accMap[a.accountId] = a;
}

let rawResults = [];
if (Array.isArray(bridgeOutput)) {
  rawResults = bridgeOutput;
} else if (bridgeOutput.data && Array.isArray(bridgeOutput.data)) {
  rawResults = bridgeOutput.data;
} else if (typeof bridgeOutput.output === 'string') {
  try {
    const parsed = JSON.parse(bridgeOutput.output.trim());
    if (Array.isArray(parsed)) rawResults = parsed;
    else if (parsed && Array.isArray(parsed.data)) rawResults = parsed.data;
  } catch (e) {}
} else if (Array.isArray(bridgeOutput.output)) {
  rawResults = bridgeOutput.output;
}

const isBridgeError = rawResults.length === 0 && (!bridgeOutput.success || (bridgeOutput.exitCode !== undefined && bridgeOutput.exitCode !== 0) || bridgeOutput.error || bridgeOutput.message);

const perAccountItems = [];

if (isBridgeError) {
  const errMsg = bridgeOutput.error || bridgeOutput.message || 'VPS Bridge execution failed';
  for (const a of accounts) {
    perAccountItems.push({
      fbAccountId: a.fbAccountId,
      accountAction: 'Failed',
      accountErrorMessage: String(errMsg).substring(0, 500),
      groupItems: []
    });
  }
} else {
  for (const r of rawResults) {
    const accMeta = accMap[r.accountId] || {};
    const fbAccountId = accMeta.fbAccountId || r.accountId;

    if (r.success) {
      const groupItems = [];
      const groups = r.groupsJoined || [];
      for (const g of groups) {
        let action = 'Joined';
        if (g.status === 'Pending Approval') action = 'Joined';
        else if (g.status === 'Needs Custom Answer') action = 'AutoAnswered';
        else if (g.status === 'Error') action = 'Failed';

        groupItems.push({
          socialGroupId: g.groupId || null,
          groupName: g.groupName || '',
          groupUrl: g.groupUrl || '',
          action: action,
          adminQuestions: (g.questions && g.questions.length > 0) ? g.questions.join('\n') : null,
          needsCustomAnswer: g.status === 'Needs Custom Answer',
          errorMessage: g.details || null
        });
      }

      perAccountItems.push({
        fbAccountId: fbAccountId,
        accountAction: 'Warmed',
        accountErrorMessage: null,
        groupItems: groupItems
      });
    } else {
      const isCheckpoint = (r.error || '').toLowerCase().includes('checkpoint');
      perAccountItems.push({
        fbAccountId: fbAccountId,
        accountAction: isCheckpoint ? 'Checkpoint' : 'Failed',
        accountErrorMessage: (r.error || 'Warming failed').substring(0, 500),
        groupItems: []
      });
    }
  }
}

return perAccountItems.map(function (acc) {
  return { json: { runId: runId, completedAccount: acc } };
});
```

### 4.2 — Them node MOI: "Loop: Report Each Account Result"

- Type: `n8n-nodes-base.splitInBatches`, typeVersion 3, parameters `{ "options": {} }` (batchSize mac dinh = 1) — copy y het cau hinh cua "Loop: Report Each Group Result" ben Workflow A.
- Vi tri: dat sau "Process Bridge Warm Results", truoc "POST warm-join-run-callback".

### 4.3 — Them node MOI: "POST warm-join-run-progress"

- Type: `n8n-nodes-base.httpRequest`, method POST.
- URL: `https://ats-local.thucnguyen8n.space/api/webhooks/warm-join-run-progress`
- `authentication: genericCredentialType`, `genericAuthType: httpHeaderAuth`, credential: `Je1dHcRXyZhrXODl` ("ATS 3.0 Internal Webhook Secret") — dung CHINH XAC credential nay, khong hardcode secret.
- `sendBody: true`, `specifyBody: json`, `jsonBody: ={{ $json }}`.
- `options.timeout: 15000`.
- `onError: continueRegularOutput` (giong het cach lam cua "POST campaign-run-progress" ben Workflow A — 1 loi bao 1 account khong duoc lam sap ca vong loop).

### 4.4 — Them node MOI: "Build Final Warm Run Summary" (code node)

```js
const allAccounts = $('Process Bridge Warm Results').all().map(function (i) { return i.json.completedAccount; });
const runId = $('Process Bridge Warm Results').first().json.runId;

let warmedTotal = 0;
let joinedTotal = 0;
let failedTotal = 0;
let checkpointTotal = 0;

for (const acc of allAccounts) {
  if (acc.accountAction === 'Warmed') warmedTotal++;
  else if (acc.accountAction === 'Checkpoint') checkpointTotal++;
  else failedTotal++;

  for (const g of (acc.groupItems || [])) {
    if (g.action === 'Joined') joinedTotal++;
    else if (g.action === 'Failed') failedTotal++;
  }
}

const totalAccounts = allAccounts.length;

let overallStatus = 'Completed';
if (totalAccounts > 0 && warmedTotal === 0 && failedTotal > 0) overallStatus = 'Failed';
else if (checkpointTotal > 0 || failedTotal > 0) overallStatus = 'PartialSuccess';

let summary = 'Nuoi nick hoan tat: ' + warmedTotal + '/' + totalAccounts + ' acc thanh cong';
if (joinedTotal > 0) summary += ', da xin vao ' + joinedTotal + ' nhom';
if (checkpointTotal > 0) summary += ', ' + checkpointTotal + ' acc dinh checkpoint';
if (failedTotal > 0) summary += ', ' + failedTotal + ' loi';

return [{
  json: {
    runId: runId,
    status: overallStatus,
    summary: summary,
    errorMessage: null,
    n8nExecutionId: $execution ? $execution.id : null
  }
}];
```

Luu y: KHONG con truong `items` trong output nay (khac ban cu) — vi `warm-join-run-callback` moi (Phan 3) khong con nhan/can `items` nua.

### 4.5 — Noi lai day (connections), thay the day cu

Day CU can XOA: `Process Bridge Warm Results -> POST warm-join-run-callback` (truc tiep).

Day MOI can co (mo phong dung 1:1 cach Workflow A noi "Loop: Report Each Group Result"):

- `Process Bridge Warm Results` -> `Loop: Report Each Account Result`
- `Loop: Report Each Account Result` output[0] (done) -> `Build Final Warm Run Summary`
- `Loop: Report Each Account Result` output[1] (loop) -> `POST warm-join-run-progress`
- `POST warm-join-run-progress` -> `Loop: Report Each Account Result` (vong lai, dung cau truc SplitInBatches chuan cua n8n)
- `Build Final Warm Run Summary` -> `POST warm-join-run-callback` (node co san, giu nguyen, KHONG sua node nay, chi sua route backend no goi toi)

### 4.6 — Cap nhat Sticky Note C

Sua noi dung Sticky Note "C: FB Auto-Warm & Group Auto-Joiner" de phan anh flow moi, vi du them cau: "Process Results -> Loop: Report Each Account Result (per-account progress via warm-join-run-progress) -> Build Final Warm Run Summary -> Supabase Callback (warm-join-run-callback, finalize only)."

### QUAN TRONG — Khong duoc tu active/publish

Giu workflow o dung trang thai hien tai (`active: true` — KHONG duoc tat active trong luc sua, va cung KHONG duoc bam Publish/Save mot phien ban moi ma chua bao Claude QA truoc). Neu n8n yeu cau save draft truoc khi Claude xem duoc, cu luu draft (chua publish) va bao Claude vao QA qua `get_workflow_details`/`get_workflow_version` (xem duoc draft version khong can publish). Day la workflow DANG CHAY THAT (webhook + cron dang active), sua sai co the gay loi that cho lan cron chay tiep theo (08:30/12:30/20:30) — CAN THAN nhu da lam voi Workflow A o PHAN 4b truoc do.

---

## PHAN 5 — Kiem tra sau khi implement (AG tu verify truoc khi bao Claude QA)

1. `npm run build` PASS 100% (khong lien quan n8n nhung phai dam bao 2 file route.js moi/sua khong co loi cu phap JS).
2. Doc lai `_acquireWarmJoinRunLock`: xac nhan `warm_join_runs.stats` co `totalPlanned` dung bang so account trong `activeAccountIds`.
3. Test thu (neu co the, qua n8n Test Workflow voi du lieu gia hoac that neu da co it nhat 1 FB account Active trong DB — hien tai bang `fb_accounts` dang co 0 dong, N8N test that se khong chay duoc cho den khi co account that, KHONG PHAI LOI CUA FIX NAY): xac nhan tung account goi `warm-join-run-progress` dung 1 lan, KHONG bi goi trung/thieu so voi so account thuc te trong batch.
4. Xac nhan sau khi run xong: notification chinh (`warm_join_started` ban dau) chuyen dung thanh `warm_join_completed` voi title/severity dung theo status (Completed/PartialSuccess/Failed) — KHONG con bi "ket" o trang thai dang chay.
5. Xac nhan `warm_join_run_items` KHONG bi insert trung lap (moi dong item chi duoc insert DUY NHAT 1 lan, hoac tu progress route hoac — khong con truong hop nao khac vi callback moi khong insert item nua).
6. Grep toan bo repo xac nhan khong con noi nao khac goi `warm-join-run-callback` voi payload co truong `items` (vi route moi khong doc truong do nua, neu con noi nao gui se bi bo qua am tham — CAN kiem tra khong sot cho goi cu).
7. Cap nhat CA HAI phan cua `docs/DEVELOPMENT_LOG.md` (Bang Tong Hop + Chi Tiet Tung Snapshot) theo dung cau truc chuan cua du an — ghi ro: file moi/sua, thay doi n8n Workflow C (KEM commit hash implement code, va GHI RO trang thai n8n la "draft, chua publish, cho Claude QA" neu chua active).

**KHONG duoc tu active/publish workflow trong n8n — Claude se QA truoc, User se la nguoi bam Active/Publish cuoi cung (gioi han platform da xac nhan o PHAN 4b truoc do).**
