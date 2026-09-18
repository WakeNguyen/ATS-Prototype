**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Lưu cookie xoay vòng trong `post-to-group.js` + tăng thời gian chờ reset IP

## Bối cảnh

Đã thẩm định độc lập báo cáo RCA của AG về sự cố văng session/Checkpoint liên tục trên `acc_01`/`acc_02` — xem đầy đủ tại `docs/testing/QA_2026-09-15_review-of-AG-fb-checkpoint-session-invalidation-report.md`. 2 nguyên nhân sau đã được XÁC NHẬN qua đọc trực tiếp code + đối chiếu dữ liệu thật (không phải suy đoán):

1. `scripts/post-to-group.js` không hề gọi `context.storageState(...)` để lưu lại cookie mới sau khi dùng — trong khi `scripts/sync-group-memberships.js` (dòng 181) và `scripts/warm-and-join.js` (dòng 557) đều có làm việc này.
2. `scripts/run-batch.js` chỉ chờ **10 giây** (dòng 54) sau khi trigger reset IP 4G trước khi tiếp tục — có thể chưa đủ để modem ổn định IP mới hoàn toàn.

PO đã quyết định: **chưa mua thêm proxy riêng** (thử tăng thời gian chờ trước), **giữ nguyên `max_posts_per_run=15`**, **giữ bật `allow_post_without_join`** (PO tự chạy Warming/Auto-Join thủ công cho nhóm chưa join, không cần sửa code cho phần này).

## Phạm vi (2 file)

1. `scripts/post-to-group.js`
2. `scripts/run-batch.js`

## Việc cần làm

### 1. `scripts/post-to-group.js` — Lưu cookie mới trước khi đóng browser (mọi kết quả, không chỉ thành công)

**Quan trọng — khác với pattern ở `sync-group-memberships.js`/`warm-and-join.js`:** 2 file đó chỉ lưu cookie ở nhánh THÀNH CÔNG (trước `return { success: true, ... }`). Với `post-to-group.js`, KHÔNG áp dụng y hệt pattern đó — vì đúng sự cố thật xảy ra hôm nay (run `#9437`) có 9/15 lần FAILED liên tiếp (không phải Checkpoint, chỉ là lỗi UI như "Could not find text editor"), và các lần Failed đó VẪN đã tương tác với Facebook (mở Home, cuộn feed, vào nhóm) nên VẪN nhận token mới bị bỏ lỡ không lưu — nếu chỉ lưu khi success, đúng kịch bản nhiều lần Failed liên tiếp như hôm nay vẫn sẽ tái diễn cookie cũ bị gửi lặp lại. Vì vậy cần lưu **trong khối `finally`, áp dụng cho MỌI nhánh return** (trừ trường hợp `context` chưa từng được tạo).

Đổi khối `finally` hiện tại (dòng 679-683):
```js
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
```
thành:
```js
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
```

**Không đổi gì khác trong file này** — không đụng logic phát hiện checkpoint, không đụng luồng đăng bài.

### 2. `scripts/run-batch.js` — Tăng thời gian chờ reset IP từ 10s lên 15s

Đổi dòng 52-54:
```js
        // Wait 10s for 4G modem to re-establish cellular data connection
        console.error('[4G Mobile Proxy] Waiting 10s for modem to acquire new cellular IP...');
        setTimeout(() => resolve(true), 10000);
```
thành:
```js
        // Wait 15s for 4G modem to re-establish cellular data connection (tăng từ 10s
        // sau RCA 2026-09-15: acc_01/acc_02 dùng chung 1 cổng 4G, cần thêm thời gian để
        // modem ổn định hoàn toàn IP mới trước khi 2 account dùng chung fingerprint mạng
        // liên tiếp bị Facebook nghi ngờ).
        console.error('[4G Mobile Proxy] Waiting 15s for modem to acquire new cellular IP...');
        setTimeout(() => resolve(true), 15000);
```

**Không đổi gì khác trong file này** — không đụng logic switch-account, không đụng batch size.

## Việc KHÔNG được làm

- KHÔNG đụng `scripts/sync-group-memberships.js`, `scripts/warm-and-join.js`, `scripts/bridge-server.js` — không nằm trong phạm vi 2 fix này.
- KHÔNG đổi `max_posts_per_run` của bất kỳ campaign nào (PO quyết định giữ nguyên 15).
- KHÔNG đổi `allow_post_without_join` hay logic composer-detection liên quan tới nhóm chưa join (PO quyết định giữ nguyên, tự xử lý qua Warming/Auto-Join thủ công).
- KHÔNG tạo file `save-session.js` mới — chưa xác minh được đây có phải file thật trên VPS hay không, ngoài phạm vi 2 fix này.

## Verify bắt buộc

1. `node --check scripts/post-to-group.js scripts/run-batch.js` → PASS.
2. `git diff --stat` → đúng 2 file (+ doc).
3. Đọc lại kỹ đảm bảo không có lỗi cú pháp quanh khối `finally` mới (đặc biệt `context` có thể là `null` nếu lỗi xảy ra trước dòng tạo context — đã có null-check `if (context)`).
4. **Giới hạn của việc verify tự động:** 2 file này chạy Playwright thật tương tác với Facebook qua VPS/n8n — KHÔNG thể test đầy đủ hành vi (có thực sự giảm Checkpoint hay không) trong vòng QA thông thường, cần PO tự quan sát qua vài lượt chạy thật trong những ngày tới. AG chỉ cần đảm bảo cú pháp đúng và logic không phá vỡ luồng hiện có (ví dụ dry-run gọi `postToGroup` với session giả nếu có sẵn cơ chế test cục bộ, nêu rõ đã test được tới đâu).
5. `/api/biz-test` + `/api/qa-test` → PASS 100% (không liên quan trực tiếp 2 file này nhưng đảm bảo không phá vỡ gì khác — chạy theo thói quen).
6. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md — nêu rõ đây là fix dựa trên RCA đã được Claude thẩm định độc lập (không phải chấp nhận nguyên văn báo cáo AG).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
