# Fix Spec — 2026-09-01 (Phase 2/N, backend nền tảng): Result/Reason theo từng dòng log + tự động đồng bộ Application-level

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

## Bối cảnh — đổi hướng thiết kế so với kế hoạch ban đầu

Sau khi xem UI thật, PO (Thức) quyết định: Result/Reason (if Failed) **không nên là field riêng của cả Application** (cách đã xây ở 2 vòng trước — `activity.result`/`reason_failed`/`note_failure_reason`, hiện ở cột bảng Action Menu + Quick Edit Jobs + badge Candidates), mà nên **gắn vào từng dòng Stage/Action Type trong Activity Log Timeline**. Lý do nghiệp vụ PO nêu rõ: để 1 ứng viên tới được Onboard thì phải pass tất cả các vòng; chỉ cần fail ở 1 stage là dừng cả process ngay tại đó — nên "Result" thực chất là thuộc tính của **từng lần thử 1 stage**, không phải 1 giá trị tổng cho cả hồ sơ.

Quyết định kỹ thuật (PO đã chọn "Phương án 1" cho cả 2 câu hỏi):
1. Thêm cột `reason_failed` mới vào bảng `activity_log` (cột `result` đã có sẵn từ trước, mặc định `'Pass'`, chưa từng dùng ở UI).
2. `activity.result`/`reason_failed`/`note_failure_reason` (Application-level, đã xây) sẽ **tự động đồng bộ từ dòng log mới nhất** — giống hệt cách `activity.current_stage` đang tự động đồng bộ theo `action_type` của log mới nhất mỗi khi thêm/sửa/xoá log. Không cần user nhập tay 2 lần, giữ nguyên toàn bộ UI/filter đã xây ở Action Menu/Jobs/Candidates không cần sửa gì.

**An toàn về race condition (đã kiểm tra, không cần lo):** `addActivityLog` đã có sẵn guard chặn thêm log khi `activity.status === 'Closed'`. Result cấp Application chỉ hiện/sửa được khi `status === 'Closed'` (theo spec gốc). Nghĩa là 2 tầng dữ liệu không bao giờ được ghi đè chéo nhau: log tự do thêm lúc "In Progress" (Result cấp App lúc này chưa ai xem/sửa), tới khi đã `Closed` thì không thêm log được nữa — đúng lúc Result cấp App (đồng bộ từ log cuối) mới có ý nghĩa và ổn định.

**Phase này CHỈ làm phần backend/DB — KHÔNG đổi bất kỳ UI nào.** Vì chưa có UI nào gửi `result`/`reason_failed` khi thêm log, hành vi hiện tại của cả 3 trang giữ nguyên 100% sau phase này (chỉ có tác dụng phụ vô hại: mỗi lần thêm log mới trong lúc "In Progress", `activity.result` sẽ tự set thành `'Passed'` ở hậu trường — không hiển thị ở đâu cả vì UI chỉ show Result khi `status === 'Closed'`, và guard Closed chặn không cho thêm log nữa nên giá trị này ổn định ngay khi cần dùng tới). UI cho Result/Reason theo từng dòng log (đúng như PO mô tả: 3 cột Stage - Result - Reason) sẽ làm ở Phase 3 (spec riêng, sau khi phase này được QA xác nhận).

---

## Việc 1 — Migration: thêm cột `reason_failed` vào `activity_log`

Tạo file migration mới (theo đúng convention Supabase migration của repo — kiểm tra thư mục `supabase/migrations/` nếu có, hoặc theo cách repo đang quản lý migration; nếu repo chưa có cơ chế migration file chính thức, tạo script tương tự các script trong `scripts/archive/data-mutating-oneoffs/` với dry-run kiểm tra cột chưa tồn tại trước khi `--apply`):

```sql
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS reason_failed TEXT;
```

Cột nullable, không có default, không ảnh hưởng dữ liệu cũ (tất cả record hiện tại sẽ có `reason_failed = NULL`, đúng vì trước giờ tính năng này chưa tồn tại).

**Bắt buộc chạy migration này lên đúng Supabase project production đang dùng** (project `mock-supabase-project`, schema `public` — chú ý bài học từ round 1 của spec Stage/Result/Reason: phải qualify đúng schema `public.activity_log`, không được để search_path mặc định trỏ nhầm `sandbox`).

## Việc 2 — `src/app/actions.js`: mở rộng `addActivityLog` nhận & lưu `result`/`reason_failed`, tự động đồng bộ Application-level

Hiện tại:
```js
export async function addActivityLog(logDataOrAppId, maybeStage, maybeNote, maybeResult) {
  let application_id, action_type, note, result, action_date;

  if (typeof logDataOrAppId === 'object' && logDataOrAppId !== null) {
    application_id = logDataOrAppId.application_id || logDataOrAppId.applicationId;
    action_type = logDataOrAppId.action_type || logDataOrAppId.actionType;
    note = logDataOrAppId.note;
    result = logDataOrAppId.result;
    action_date = logDataOrAppId.action_date || logDataOrAppId.actionDate;
  } else {
    application_id = logDataOrAppId;
    action_type = maybeStage;
    note = maybeNote;
    result = maybeResult;
  }

  if (!application_id) return { success: false, error: "Missing Application ID" };

  try {
    const parsedActionDate = action_date ? new Date(action_date) : new Date();

    if (application_id) {
        const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${application_id}`;
        if (appCheck && appCheck.status === 'Closed') {
            return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
        }
    }

    const inserted = await sql.begin(async (tx) => {
      const [insertedLog] = await tx`
        INSERT INTO activity_log (
          id, application_id, action_type, note, result, action_date, created_time
        ) VALUES (
          gen_random_uuid(), ${application_id}, ${action_type || 'Contact'}, ${note || ''}, ${result || 'Pass'}, ${parsedActionDate}, NOW()
        )
        RETURNING *
      `;

      if (action_type) {
        await tx`
          UPDATE activity
          SET current_stage = ${action_type}, last_updated = NOW()
          WHERE id = ${application_id}
        `;
      }
      return insertedLog;
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true, data: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error adding activity log:", error);
    return { success: false, error: error.message };
  }
}
```

Thay bằng (thêm `reason_failed` vào destructure, thêm vào câu INSERT, và mở rộng khối `UPDATE activity` để đồng bộ luôn `result`/`reason_failed`/`note_failure_reason` — **giữ nguyên 100% phần còn lại**, kể cả comment và cấu trúc transaction):

```js
export async function addActivityLog(logDataOrAppId, maybeStage, maybeNote, maybeResult) {
  let application_id, action_type, note, result, reason_failed, action_date;

  if (typeof logDataOrAppId === 'object' && logDataOrAppId !== null) {
    application_id = logDataOrAppId.application_id || logDataOrAppId.applicationId;
    action_type = logDataOrAppId.action_type || logDataOrAppId.actionType;
    note = logDataOrAppId.note;
    result = logDataOrAppId.result;
    reason_failed = logDataOrAppId.reason_failed;
    action_date = logDataOrAppId.action_date || logDataOrAppId.actionDate;
  } else {
    application_id = logDataOrAppId;
    action_type = maybeStage;
    note = maybeNote;
    result = maybeResult;
  }

  if (!application_id) return { success: false, error: "Missing Application ID" };

  try {
    const parsedActionDate = action_date ? new Date(action_date) : new Date();
    const finalResult = result || 'Pass';
    const finalReasonFailed = finalResult === 'Fail' ? (reason_failed || null) : null;

    if (application_id) {
        const [appCheck] = await sql`SELECT status FROM activity WHERE id = ${application_id}`;
        if (appCheck && appCheck.status === 'Closed') {
            return { success: false, error: "Không thể chỉnh sửa hồ sơ đang bị khóa (Closed)" };
        }
    }

    const inserted = await sql.begin(async (tx) => {
      const [insertedLog] = await tx`
        INSERT INTO activity_log (
          id, application_id, action_type, note, result, reason_failed, action_date, created_time
        ) VALUES (
          gen_random_uuid(), ${application_id}, ${action_type || 'Contact'}, ${note || ''}, ${finalResult}, ${finalReasonFailed}, ${parsedActionDate}, NOW()
        )
        RETURNING *
      `;

      if (action_type) {
        // Đồng bộ current_stage (như cũ) + Result/Reason cấp Application từ chính log vừa thêm
        // (log mới nhất luôn là log vừa insert vì action_date mặc định = NOW() trừ khi user chọn ngày quá khứ —
        //  giữ đúng hành vi hiện tại của current_stage, không thêm logic "tìm lại log mới nhất" ở đây)
        await tx`
          UPDATE activity
          SET
            current_stage = ${action_type},
            result = ${finalResult === 'Fail' ? 'Failed' : 'Passed'},
            reason_failed = ${finalReasonFailed},
            note_failure_reason = ${finalResult === 'Fail' ? (note || null) : null},
            last_updated = NOW()
          WHERE id = ${application_id}
        `;
      }
      return insertedLog;
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true, data: JSON.parse(JSON.stringify(inserted)) };
  } catch (error) {
    console.error("Error adding activity log:", error);
    return { success: false, error: error.message };
  }
}
```

**Lưu ý quan trọng:** giữ đúng comment giải thích trong code — lý do dùng trực tiếp log vừa insert thay vì `SELECT ... ORDER BY action_date DESC LIMIT 1` (khác với cách `updateActivityLog`/`deleteActivityLog` đang làm) là vì log vừa thêm chắc chắn là log mới nhất trong đa số trường hợp thực tế (giống hệt cách đoạn code `current_stage` gốc đã làm từ trước — không đổi hành vi đó).

## Việc 3 — `updateActivityLog`: nhận `result`/`reason_failed` khi sửa, đồng bộ lại từ log mới nhất

Hiện tại:
```js
export async function updateActivityLog(logId, applicationId, logData) {
  if (!logId) return { success: false, error: "Missing Log ID" };
  try {
    const { action_type, note, action_date } = logData;
    const parsedActionDate = action_date ? new Date(action_date) : undefined;
    
    await sql.begin(async (tx) => {
      await tx`
        UPDATE activity_log
        SET
          action_type = ${action_type !== undefined ? action_type : sql`action_type`},
          note = ${note !== undefined ? note : sql`note`},
          action_date = ${parsedActionDate !== undefined ? parsedActionDate : sql`action_date`}
        WHERE id = ${logId}
      `;

      if (applicationId) {
        const latest = await tx`
          SELECT action_type FROM activity_log 
          WHERE application_id = ${applicationId}
          ORDER BY action_date DESC, created_time DESC
          LIMIT 1
        `;
        if (latest.length > 0) {
          await tx`
            UPDATE activity 
            SET current_stage = ${latest[0].action_type}, last_updated = NOW()
            WHERE id = ${applicationId}
          `;
        }
      }
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error updating activity log:", error);
    return { success: false, error: error.message };
  }
}
```

Thay bằng (thêm `result`/`reason_failed` vào destructure + UPDATE `activity_log`, và mở rộng câu `SELECT ... latest` + `UPDATE activity` để lấy/đồng bộ đủ cả `result`/`reason_failed`/`note`, không chỉ `action_type`):

```js
export async function updateActivityLog(logId, applicationId, logData) {
  if (!logId) return { success: false, error: "Missing Log ID" };
  try {
    const { action_type, note, action_date, result, reason_failed } = logData;
    const parsedActionDate = action_date ? new Date(action_date) : undefined;
    const finalReasonFailed = result === 'Fail' ? (reason_failed !== undefined ? reason_failed : sql`reason_failed`) : (result === 'Pass' ? null : (reason_failed !== undefined ? reason_failed : sql`reason_failed`));

    await sql.begin(async (tx) => {
      await tx`
        UPDATE activity_log
        SET
          action_type = ${action_type !== undefined ? action_type : sql`action_type`},
          note = ${note !== undefined ? note : sql`note`},
          action_date = ${parsedActionDate !== undefined ? parsedActionDate : sql`action_date`},
          result = ${result !== undefined ? result : sql`result`},
          reason_failed = ${finalReasonFailed}
        WHERE id = ${logId}
      `;

      if (applicationId) {
        const latest = await tx`
          SELECT action_type, note, result, reason_failed FROM activity_log 
          WHERE application_id = ${applicationId}
          ORDER BY action_date DESC, created_time DESC
          LIMIT 1
        `;
        if (latest.length > 0) {
          const l = latest[0];
          await tx`
            UPDATE activity 
            SET
              current_stage = ${l.action_type},
              result = ${l.result === 'Fail' ? 'Failed' : 'Passed'},
              reason_failed = ${l.result === 'Fail' ? l.reason_failed : null},
              note_failure_reason = ${l.result === 'Fail' ? l.note : null},
              last_updated = NOW()
            WHERE id = ${applicationId}
          `;
        }
      }
    });

    revalidatePath('/');
    revalidatePath('/candidates');
    revalidatePath('/jobs');
    return { success: true };
  } catch (error) {
    console.error("Error updating activity log:", error);
    return { success: false, error: error.message };
  }
}
```

(Nếu thấy dòng tính `finalReasonFailed` rối, có thể đơn giản hoá miễn giữ đúng ý nghĩa: chỉ ghi `reason_failed` mới khi `result` được gửi lên là `'Fail'`; nếu `result` gửi lên là `'Pass'` thì luôn set `reason_failed = NULL`; nếu không gửi `result` (giữ nguyên như cũ) thì cũng không đổi `reason_failed`.)

## Việc 4 — `deleteActivityLog`: đồng bộ lại Application-level từ log mới nhất còn lại (kể cả trường hợp xoá hết log)

Tìm khối code đồng bộ `current_stage` sau khi xoá (đã có sẵn logic tương tự — AG tự đọc phần còn lại của hàm `deleteActivityLog` để lấy đúng context trước khi sửa). Mở rộng để: khi còn log → lấy `result`/`reason_failed`/`note` từ log mới nhất còn lại để đồng bộ (giống Việc 3); khi xoá hết log (không còn log nào) → reset `activity.result = NULL, reason_failed = NULL, note_failure_reason = NULL` (không suy đoán, để trống vì không còn cơ sở dữ liệu để tính).

## KHÔNG được làm trong spec này

- Không sửa bất kỳ file UI nào (`page.js`, `jobs/page.js`, `candidates/page.js`, `ActivityLogPanel.js`) — 0 thay đổi giao diện.
- Không backfill `reason_failed` cho log cũ (giữ NULL, đúng vì tính năng này chưa từng tồn tại trước đây — khác với round 1-2 vốn có cột `activity.reason_failed` đã tồn tại sẵn từ Notion migration).
- Không đổi enum/constants — dùng lại `APPLICATION_RESULTS_LIST`/`FAILURE_REASONS_LIST` đã có.

## Yêu cầu báo cáo

1. `git diff` đầy đủ cho migration file/script và `src/app/actions.js`.
2. Xác nhận migration đã chạy thật trên Supabase production: paste kết quả `\d activity_log` (hoặc query `information_schema.columns`) xác nhận cột `reason_failed` tồn tại.
3. Test tay bằng cách gọi trực tiếp qua UI hiện tại (không có Result selector nên sẽ mặc định 'Pass'): thêm 1 log mới ở 1 application đang "In Progress" → query trực tiếp Supabase xác nhận `activity_log.result = 'Pass'`, `activity.result = 'Passed'` được set đúng, không có lỗi nào phát sinh, giao diện các trang vẫn hoạt động y hệt trước (vì UI chưa hiển thị field mới này).
4. `/api/qa-test`, `/api/db-test`, `/api/biz-test` — dán JSON thô, không được có regression.
5. Cập nhật `DEVELOPMENT_LOG.md` — ghi rõ đây là phase nền tảng backend cho hướng thiết kế mới (Result/Reason theo từng dòng log, thay vì cấp Application), nêu rõ lý do đổi hướng (feedback PO sau khi xem UI thật).
