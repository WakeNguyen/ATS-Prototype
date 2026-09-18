# FIX_SPEC_2026-09-06 — Workflow D (Group Membership Auto-Sync Engine): Per-Account Mutex Lock + Dynamic Jitter Scheduler + API Contract

**Người viết**: Claude (Architect — được AG bàn giao lại vai trò cho đúng 2 mục này, xem `docs/architecture/HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md`).
**Phạm vi spec này**: CHỈ 2 mục hạ tầng kỹ thuật trung lập của Trụ cột 9 (Workflow D) trong `BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md`:
1. Cơ chế khoá "Per-Account Mutex Lock" (không đụng hàng đợi/tài khoản nào đang bận).
2. Cơ chế lên lịch "Dynamic Jitter Scheduler" + toàn bộ API contract (data-fetch route + callback route) cho Workflow D.

**NGOÀI phạm vi spec này (giữ nguyên của AG / chờ User)**:
- Script Playwright quét `facebook.com/groups/joins` (~15-20s/nick) — thuộc phần hành vi/tương tác trực tiếp với Facebook, AG tự thiết kế.
- Con số/tần suất cụ thể của lịch trình né tránh phát hiện (bao nhiêu mốc giờ/ngày, biên độ jitter bao nhiêu phút, khung giờ nào trong ngày) — đây là quyết định chính sách của AG/User, spec này CHỈ xây hạ tầng để THỰC THI đúng lịch đã quyết định, không tự chọn số.
- Toàn bộ Phase 5 (Quota Selector, Accounts Joined UX, Run History colors, Smart Allocator) — AG code như đã chốt.

---

## 0. Bối cảnh đã xác minh (qua đọc code + Supabase MCP, không đoán)

- `_acquireWarmJoinRunLock` (`src/app/campaign_actions.js` ~dòng 1404) dùng `pg_advisory_xact_lock(hashtext('warm_join_run_lock'))` để khoá RĂNG BƯỚC ĐĂNG KÝ run, còn cơ chế "đang có run nào chạy không" thật sự dùng trạng thái lưu trong bảng (`SELECT ... WHERE status = 'Running' AND started_at > now() - interval '2 hours'`) — đây là pattern chuẩn của dự án cho các tiến trình dài chạy NGOÀI transaction (VPS Bridge). Spec này tái dùng đúng pattern này cho Workflow D, không phát minh cơ chế mới.
- **Job Posting (Workflow A) không có khái niệm "khoá theo account"** — `one_running_run_per_campaign` chỉ khoá theo `campaign_id`. Không có cột/bảng nào lưu "account nào đang được dùng bởi run đang Running". Tập account đang bận vì Job Posting phải suy ra LIVE qua `campaign_fb_accounts JOIN campaign_runs (status='Running')`.
- **Warming (Workflow C) khoá TOÀN CỤC** (`one_running_warm_join_run`) — 1 run Warming đang chạy nghĩa là TẤT CẢ account trong run đó đang bận, nhưng hiện DB **không lưu trực tiếp danh sách account_ids trên `warm_join_runs`** (chỉ có trong `notifications.metadata` — không nên dùng làm nguồn tin cậy vì notification có thể bị sửa/archive độc lập). Spec này thêm 1 cột mới để khắc phục.
- Bảng `social_group_urls.join_status` là cột đơn (1 giá trị / group), không phản ánh được tỷ lệ đa tài khoản mà Trụ cột 8 (Phase 5) đang xây (`ACCOUNTS JOINED 2/2`, `1/2`...). Nguồn dữ liệu ĐÚNG cho tỷ lệ đa tài khoản là đếm dòng trong `fb_account_groups` theo `social_group_id`, so với số `fb_accounts WHERE status='Active'`. **Lưu ý chéo cho AG khi code Phase 5**: nên lấy tỷ lệ Accounts Joined từ `COUNT(fb_account_groups) / COUNT(fb_accounts Active)`, KHÔNG từ `social_group_urls.join_status` (cột này chỉ nên coi là nhãn tổng quan phụ, best-effort).
- Toàn bộ workflow n8n trong dự án gọi vào ATS 3.0 qua HTTP webhook tới Next.js API route (`/api/webhooks/...`), KHÔNG có node Postgres trực tiếp nào trong n8n. Spec này giữ đúng pattern đó — mọi thao tác DB đều qua route mới, n8n chỉ gọi HTTP.

---

## PHẦN 1 — Migration DB (SQL, AG tự áp dụng qua `apply_migration`)

### 1.1. Thêm cột `account_ids` vào `warm_join_runs`
Mục đích: để Workflow D biết chính xác account nào đang bận vì Warming, không phải suy đoán qua notification.

```sql
ALTER TABLE public.warm_join_runs
  ADD COLUMN account_ids uuid[] DEFAULT NULL;
```

Sửa `_acquireWarmJoinRunLock` (bước 6, insert `warm_join_runs`) để ghi thêm cột này — CHỈ thêm 1 cột vào câu INSERT đã có, không đổi hành vi Warming hiện tại:

```js
    const [run] = await sqlTx`
      INSERT INTO warm_join_runs (
        campaign_id, status, trigger_source, started_at, summary, notification_id, account_ids, created_time
      ) VALUES (
        ${resolvedCampaignId || null}, 'Running', ${triggerSource}, now(),
        ${summaryMsg},
        ${notif?.id || null},
        ${activeAccountIds},
        now()
      )
      RETURNING id
    `;
```

### 1.2. Bảng mới `group_membership_sync_runs`
Đóng 2 vai trò: (a) khoá "chỉ 1 Workflow D chạy tại 1 thời điểm" (mirror `warm_join_runs`), (b) audit/QA log.

```sql
CREATE TABLE public.group_membership_sync_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  schedule_id uuid REFERENCES public.group_membership_sync_schedule(id),
  status text NOT NULL DEFAULT 'Running'
    CHECK (status = ANY (ARRAY['Running','Completed','Failed','PartialSuccess'])),
  trigger_source text NOT NULL DEFAULT 'cron_jitter',
  account_ids uuid[] DEFAULT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stats jsonb,
  summary text,
  error_message text,
  n8n_execution_id text,
  created_time timestamptz NOT NULL DEFAULT now()
);
```

> Lưu ý thứ tự tạo bảng: `group_membership_sync_schedule` (mục 1.3) phải tạo TRƯỚC bảng này vì có FK trỏ tới nó — hoặc AG có thể tạo `group_membership_sync_runs` trước rồi `ALTER TABLE ... ADD CONSTRAINT` FK sau khi có bảng schedule. Tuỳ AG chọn thứ tự migration cho gọn.

### 1.3. Bảng mới `group_membership_sync_schedule`
Lưu các mốc giờ đã "roll" trong ngày — giải quyết việc n8n Schedule Trigger không tự chọn giờ ngẫu nhiên được.

```sql
CREATE TABLE public.group_membership_sync_schedule (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  for_date date NOT NULL,
  slot_index int NOT NULL CHECK (slot_index IN (1, 2)),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status = ANY (ARRAY['Pending','Fired','Cancelled'])),
  fired_at timestamptz,
  created_time timestamptz NOT NULL DEFAULT now(),
  UNIQUE (for_date, slot_index)
);
```

`UNIQUE (for_date, slot_index)` đảm bảo dù workflow "Roll Dice" (00:05) có bị n8n retry/chạy lại trong cùng 1 ngày, cũng không tạo trùng lịch — route ở PHẦN 3.1 sẽ dùng `ON CONFLICT (for_date, slot_index) DO NOTHING`.

---

## PHẦN 2 — Per-Account Mutex Lock: hàm helper dùng chung

Thêm 1 hàm (không export ra ngoài, dùng nội bộ cho các route ở PHẦN 3) trong `src/app/campaign_actions.js`, đặt gần `_acquireWarmJoinRunLock`:

```js
/**
 * Tính danh sách fb_account_id đang "bận" vì 1 trong các nguồn:
 * 1. Job Posting: account nằm trong pool (campaign_fb_accounts) của 1 campaign đang có campaign_runs.status = 'Running'.
 * 2. Warming: account nằm trong account_ids của 1 warm_join_runs đang status = 'Running'
 *    (cửa sổ 2 giờ, đồng bộ đúng ngưỡng đã dùng trong _acquireWarmJoinRunLock).
 * 3. Chính Workflow D: account nằm trong account_ids của 1 group_membership_sync_runs đang status = 'Running'
 *    (chống trường hợp phiên trước chạy quá hạn đè lên phiên sau — xem PHẦN 3.2 timeout).
 * @param {object} sqlTx - transaction client (hoặc `sql` nếu gọi ngoài transaction)
 * @returns {Promise<string[]>} - mảng fb_account_id (uuid string) đang bận
 */
async function _getBusyFbAccountIds(sqlTx) {
  const [jobPostingBusy, warmingBusy, syncBusy] = await Promise.all([
    sqlTx`
      SELECT DISTINCT cfa.fb_account_id
      FROM campaign_fb_accounts cfa
      JOIN campaign_runs cr ON cr.campaign_id = cfa.campaign_id
      WHERE cr.status = 'Running'
    `,
    sqlTx`
      SELECT DISTINCT unnest(account_ids) AS fb_account_id
      FROM warm_join_runs
      WHERE status = 'Running' AND started_at > now() - interval '2 hours'
        AND account_ids IS NOT NULL
    `,
    sqlTx`
      SELECT DISTINCT unnest(account_ids) AS fb_account_id
      FROM group_membership_sync_runs
      WHERE status = 'Running' AND started_at > now() - interval '30 minutes'
        AND account_ids IS NOT NULL
    `
  ]);

  const busySet = new Set([
    ...jobPostingBusy.map(r => r.fb_account_id),
    ...warmingBusy.map(r => r.fb_account_id),
    ...syncBusy.map(r => r.fb_account_id)
  ]);
  return Array.from(busySet);
}
```

Giải thích 2 con số ngưỡng (không phải chính sách né tránh — chỉ là timeout an toàn kỹ thuật chống deadlock nếu 1 phiên bị treo):
- `2 hours` cho Warming: tái dùng nguyên ngưỡng đã có sẵn trong `_acquireWarmJoinRunLock`, không tự đặt số mới.
- `30 minutes` cho chính Workflow D: mỗi account quét ~15-20s, kể cả vài chục account cũng chỉ vài phút — 30 phút là buffer rộng rãi để không tự khoá chết nếu 1 phiên treo. AG có thể điều chỉnh nếu số lượng account thực tế lớn hơn dự kiến.

---

## PHẦN 3 — API Route mới cho Workflow D

### 3.1. `POST /api/webhooks/group-membership-sync-schedule-roll`
Gọi bởi node "Roll Dice" của n8n lúc 00:05 hằng ngày. **AG tự quyết định trong n8n Code Node cách chọn 2 mốc giờ ngẫu nhiên** (khung giờ nào, jitter bao nhiêu phút — đây là chính sách của AG/User, không thuộc spec này). Route này CHỈ nhận 2 timestamp đã tính sẵn và lưu lại 1 cách an toàn (idempotent).

Request body:
```json
{ "scheduledTimes": ["2026-09-07T10:17:00+07:00", "2026-09-07T16:42:00+07:00"] }
```

```js
// src/app/api/webhooks/group-membership-sync-schedule-roll/route.js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scheduledTimes = [] } = await request.json();
    if (!Array.isArray(scheduledTimes) || scheduledTimes.length !== 2) {
      return NextResponse.json({ error: 'scheduledTimes must be an array of exactly 2 ISO timestamps' }, { status: 400 });
    }

    const forDate = new Date(scheduledTimes[0]).toISOString().slice(0, 10);
    const inserted = [];

    for (let i = 0; i < scheduledTimes.length; i++) {
      const [row] = await sql`
        INSERT INTO group_membership_sync_schedule (for_date, slot_index, scheduled_for, status)
        VALUES (${forDate}, ${i + 1}, ${scheduledTimes[i]}, 'Pending')
        ON CONFLICT (for_date, slot_index) DO NOTHING
        RETURNING id, scheduled_for
      `;
      if (row) inserted.push(row);
    }

    return NextResponse.json({ success: true, forDate, inserted });
  } catch (error) {
    console.error('[Webhook group-membership-sync-schedule-roll] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 3.2. `POST /api/webhooks/group-membership-sync-claim-schedule`
Gọi bởi 1 n8n Schedule Trigger chạy DÀY (đề xuất mỗi 5 phút — con số này AG có thể đổi, không ảnh hưởng tính đúng đắn). Atomic-claim: chỉ 1 lệnh gọi "trúng" được 1 slot dù có polling chồng nhau.

```js
// src/app/api/webhooks/group-membership-sync-claim-schedule/route.js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Atomic claim: UPDATE ... WHERE status='Pending' RETURNING đảm bảo chỉ 1 request "trúng" 1 hàng
    // dù nhiều lần poll xảy ra gần như đồng thời (Postgres row-level lock tự xử lý).
    const [claimed] = await sql`
      UPDATE group_membership_sync_schedule
      SET status = 'Fired', fired_at = now()
      WHERE id = (
        SELECT id FROM group_membership_sync_schedule
        WHERE status = 'Pending' AND scheduled_for <= now()
        ORDER BY scheduled_for ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, scheduled_for
    `;

    if (!claimed) {
      return NextResponse.json({ claimed: false });
    }

    return NextResponse.json({ claimed: true, scheduleId: claimed.id, scheduledFor: claimed.scheduled_for });
  } catch (error) {
    console.error('[Webhook group-membership-sync-claim-schedule] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

`FOR UPDATE SKIP LOCKED` an toàn hơn 1 `UPDATE` đơn thuần nếu sau này có > 1 tiến trình poll song song — mỗi request luôn chỉ lấy đúng 1 hàng chưa bị khoá, không bao giờ trả trùng.

### 3.3. `GET /api/webhooks/group-membership-sync-data?scheduleId=...`
Gọi bởi n8n SAU KHI claim thành công. Trả về danh sách account đủ điều kiện quét (Active, KHÔNG bận) + đồng thời đăng ký (khoá) 1 dòng `group_membership_sync_runs` — pattern y hệt `_acquireWarmJoinRunLock`.

```js
// src/app/api/webhooks/group-membership-sync-data/route.js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { decryptSecret } from '../../../../lib/crypto.js'; // dùng đúng hàm decrypt đã có cho proxy_url

export async function GET(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduleId = new URL(request.url).searchParams.get('scheduleId') || null;
    let result = null;

    await sql.begin(async (sqlTx) => {
      // 1. Khoá đăng ký, chống 2 phiên Workflow D chồng nhau
      await sqlTx`SELECT pg_advisory_xact_lock(hashtext('group_membership_sync_run_lock'))`;

      const [activeSync] = await sqlTx`
        SELECT id FROM group_membership_sync_runs
        WHERE status = 'Running' AND started_at > now() - interval '30 minutes'
        LIMIT 1
      `;
      if (activeSync) {
        result = { success: false, error: 'already_running', activeRunId: activeSync.id };
        return;
      }

      // 2. Loại account đang bận (Per-Account Mutex)
      const busyIds = await _getBusyFbAccountIds(sqlTx);

      const eligible = await sqlTx`
        SELECT id, account_name, account_ref, proxy_url
        FROM fb_accounts
        WHERE status = 'Active'
          ${busyIds.length > 0 ? sqlTx`AND id != ALL(${busyIds})` : sqlTx``}
        ORDER BY account_ref ASC
      `;

      const eligibleIds = eligible.map(a => a.id);

      // 3. Đăng ký run (đóng vai trò khoá cho tới khi callback đóng lại)
      const [run] = await sqlTx`
        INSERT INTO group_membership_sync_runs (schedule_id, status, trigger_source, account_ids, started_at, created_time)
        VALUES (${scheduleId}, 'Running', 'cron_jitter', ${eligibleIds}, now(), now())
        RETURNING id
      `;

      result = {
        success: true,
        runId: run.id,
        skippedBusyCount: busyIds.length,
        accounts: eligible.map(a => ({
          id: a.id,
          account_ref: a.account_ref,
          account_name: a.account_name,
          proxy_url: decryptSecret(a.proxy_url) || ''
        }))
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Webhook group-membership-sync-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

> Nếu `eligible.length === 0` (mọi account đều Active nhưng đang bận, hoặc không có account Active nào), n8n nên tự kết thúc workflow êm (no-op), KHÔNG gọi callback với mảng rỗng gây nhiễu log. Đề nghị AG thêm 1 node IF ngay sau bước gọi route này.

### 3.4. `POST /api/webhooks/group-membership-sync-callback`
Gọi bởi n8n sau khi quét xong tất cả account (hoặc từng account — tuỳ AG thiết kế node, route xử lý được cả 2 kiểu vì nhận mảng `items`).

Request body:
```json
{
  "runId": "uuid-cua-group_membership_sync_runs",
  "status": "Completed",
  "n8nExecutionId": "...",
  "items": [
    { "fbAccountId": "uuid", "joinedGroupUrls": ["https://facebook.com/groups/abc", "..."] },
    { "fbAccountId": "uuid", "error": "Checkpoint detected" }
  ]
}
```

```js
// src/app/api/webhooks/group-membership-sync-callback/route.js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db.js';
import { normalizeSocialGroupUrl } from '../../../../campaign_actions.js'; // cần export hàm này (hiện đang private)

export async function POST(request) {
  try {
    const secret = request.headers.get('x-internal-secret');
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { runId, status = 'Completed', n8nExecutionId = null, errorMessage = null, items = [] } = body;

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    let matchedCount = 0;
    let unmatchedUrls = [];

    await sql.begin(async (sqlTx) => {
      // Cache toàn bộ social_group_urls đã normalize 1 lần cho cả batch (1028 nhóm — nhẹ, không cần query riêng lẻ từng URL)
      const allGroups = await sqlTx`SELECT id, url FROM social_group_urls WHERE is_active = true`;
      const urlToGroupId = new Map(
        allGroups.map(g => [normalizeSocialGroupUrl(g.url), g.id])
      );

      for (const item of items) {
        const fbAccountId = item.fbAccountId || item.fb_account_id;
        if (!fbAccountId) continue;

        const joinedUrls = Array.isArray(item.joinedGroupUrls) ? item.joinedGroupUrls : [];

        for (const rawUrl of joinedUrls) {
          const normalized = normalizeSocialGroupUrl(rawUrl);
          const socialGroupId = urlToGroupId.get(normalized);

          if (!socialGroupId) {
            // Nhóm quét được không nằm trong thư viện 1028 nhóm — bỏ qua an toàn, không lỗi cả batch
            unmatchedUrls.push(rawUrl);
            continue;
          }

          // Upsert membership — idempotent, gọi lại nhiều lần không nhân đôi dữ liệu
          await sqlTx`
            INSERT INTO fb_account_groups (fb_account_id, social_group_id, joined_at)
            VALUES (${fbAccountId}, ${socialGroupId}, now())
            ON CONFLICT (fb_account_id, social_group_id) DO UPDATE
            SET joined_at = EXCLUDED.joined_at
          `;
          matchedCount++;

          // Best-effort: giữ social_group_urls.join_status không bị "kẹt" ở Not Joined
          // (nguồn đúng cho tỷ lệ đa-account vẫn là fb_account_groups — xem PHẦN 0)
          await sqlTx`
            UPDATE social_group_urls SET join_status = 'Joined'
            WHERE id = ${socialGroupId} AND join_status = 'Not Joined'
          `;
        }

        if (item.error && /checkpoint/i.test(item.error)) {
          await sqlTx`
            UPDATE fb_accounts SET status = 'Checkpoint', updated_time = now()
            WHERE id = ${fbAccountId}
          `;
        }
      }

      // Đóng run — v1 KHÔNG xử lý trường hợp account bị "rời nhóm" (group từng joined nay biến mất khỏi kết quả quét):
      // đây là giới hạn đã biết, chấp nhận cho v1 vì xoá dữ liệu tự động rủi ro hơn giá trị mang lại. Có thể làm ở spec sau.
      await sqlTx`
        UPDATE group_membership_sync_runs SET
          status = ${status},
          completed_at = now(),
          n8n_execution_id = ${n8nExecutionId},
          error_message = ${errorMessage},
          stats = ${sqlTx.json({ totalItems: items.length, matchedGroups: matchedCount, unmatchedUrlCount: unmatchedUrls.length })}
        WHERE id = ${runId}
      `;
    });

    return NextResponse.json({ success: true, matchedCount, unmatchedCount: unmatchedUrls.length });
  } catch (error) {
    console.error('[Webhook group-membership-sync-callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

Yêu cầu nhỏ đi kèm: đổi `function normalizeSocialGroupUrl(rawUrl)` (dòng ~2165 `campaign_actions.js`) thành `export function normalizeSocialGroupUrl(rawUrl)` để route trên import lại được — tránh copy trùng logic normalize URL ở 2 nơi.

---

## PHẦN 4 — Thiết kế n8n Workflow D (2 workflow con, theo đúng pattern hiện có — chỉ gọi HTTP, không Postgres node)

**Workflow D.1 — "Roll Dice"** (Schedule Trigger tĩnh `5 0 * * *`):
1. Code Node: tự chọn 2 mốc giờ ngẫu nhiên trong ngày (AG tự quyết định khung giờ/thuật toán).
2. HTTP Request: `POST group-membership-sync-schedule-roll` với 2 mốc giờ vừa tính.

**Workflow D.2 — "Poll & Execute"** (Schedule Trigger tĩnh, ví dụ mỗi 5 phút — `*/5 * * * *`):
1. HTTP Request: `POST group-membership-sync-claim-schedule`.
2. IF `claimed == false` → dừng (no-op run).
3. HTTP Request: `GET group-membership-sync-data?scheduleId=...`.
4. IF `accounts.length == 0` → dừng (no-op run, không gọi callback).
5. Loop tuần tự qua từng account (Strict Sequential, giống Workflow C) → mở `facebook.com/groups/joins` qua proxy của account → trích xuất URL nhóm đã join.
6. HTTP Request: `POST group-membership-sync-callback` với toàn bộ kết quả.

---

## PHẦN 5 — Kế hoạch QA trước khi bật cron thật (bắt buộc, vì đây là workflow chạm tài khoản Facebook thật hoàn toàn tự động)

1. Test `group-membership-sync-data` với 1 kịch bản có Job Posting run + Warming run đang "Running" giả lập trong DB (schema `sandbox`) — xác nhận `skippedBusyCount` đúng và các account đó KHÔNG xuất hiện trong `accounts` trả về.
2. Gọi `group-membership-sync-schedule-roll` 2 lần liên tiếp trong cùng ngày — xác nhận lần 2 không tạo thêm hàng (nhờ `ON CONFLICT DO NOTHING`).
3. Gọi `group-membership-sync-claim-schedule` nhiều lần liên tiếp ngay sau khi 1 slot đến hạn — xác nhận chỉ 1 lần trả `claimed: true`, các lần sau `claimed: false`.
4. Gọi `group-membership-sync-callback` 2 lần với CÙNG payload — xác nhận `fb_account_groups` không bị nhân đôi/lỗi (nhờ `ON CONFLICT DO UPDATE`).
5. Test với 1 URL không khớp bất kỳ nhóm nào trong `social_group_urls` — xác nhận không làm lỗi cả batch, chỉ bị đếm vào `unmatchedUrlCount`.
6. Như mọi workflow n8n khác: **KHÔNG tự publish/active** — chỉ QA xong rồi báo User tự bấm Publish trong n8n UI, Claude verify lại qua `get_workflow_details` sau đó.

---

## Tài liệu liên quan
- `docs/architecture/HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md`
- `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` — Trụ cột 9.
- `docs/testing/FIX_SPEC_2026-09-06_campaign-fb-autopost_warming-progress-reporting-parity.md` — pattern progress/lock tham chiếu.
- Project memory: `campaign-fb-autopost-status.md`, `claude-role-boundary.md`.

_Viết bởi: Claude (Architect) — 2026-09-06_
