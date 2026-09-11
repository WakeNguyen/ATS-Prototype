import codecs

qa_log_dev = b'''

### Snapshot SNAP-20260831-QA (31/08/2026 00:00) - 3.0-RC75-QA
* **M\xe1\xbb\xa5c ti\xc3\xaau:** \xf0\x9f\x9b\xa1\xef\xb8\x8f **Ki\xe1\xbb\x83m th\xe1\xbb\xad Nghi\xe1\xbb\x87m thu & V\xc3\xa1 L\xe1\xbb\x97i Database (QA Verification & Integrity Fixes)**:
  1. **T\xe1\xba\xa1o API Route Ki\xe1\xbb\x83m Th\xe1\xbb\xad T\xe1\xbb\xb1 \xc4\x90\xe1\xbb\x99ng:** X\xc3\xa2y d\xe1\xbb\xb1ng endpoint \xc4\x91\xe1\xbb\x99c l\xe1\xba\xadp (src/app/api/qa-test/route.js) \xc4\x91\xe1\xbb\x83 b\xe1\xba\xafn 5 k\xe1\xbb\x8bch b\xe1\xba\xa3n \xc3\xa1c li\xe1\xbb\x87t nh\xe1\xba\xa5t.
  2. **V\xc3\xa1 l\xe1\xbb\x97i Connection Pooler (PgBouncer):** B\xe1\xbb\x95 sung prepare: false v\xc3\xa0o Postgres client (db.js) \xc4\x91\xe1\xbb\x83 t\xc6\xb0\xc6\xa1ng th\xc3\xadch ho\xc3\xa0n to\xc3\xa0n v\xe1\xbb\x9bi ch\xe1\xba\xbf \xc4\x91\xe1\xbb\x99 Transaction Mode tr\xc3\xaan Port 6543 c\xe1\xbb\xa7a Supabase.
  3. **Row-level Transaction Lock (Kh\xc3\xb3a giao d\xe1\xbb\x8bch \xc4\x91\xe1\xbb\x93ng th\xe1\xbb\x9di):** Th\xc3\xaam pg_advisory_xact_lock v\xc3\xa0o c\xc3\xa1c Server Actions (ctions.js) \xc4\x91\xe1\xbb\x83 lo\xe1\xba\xa1i b\xe1\xbb\x8f ho\xc3\xa0n to\xc3\xa0n \xc4\x91\xe1\xbb\xa5ng \xc4\x91\xe1\xbb\x99 Race Condition khi sinh display_number.
  4. **Kh\xe1\xba\xafc ph\xe1\xbb\xa5c l\xe1\xbb\x97i Not-Null Constraint:** V\xc3\xa1 l\xe1\xbb\x97i thi\xe1\xba\xbfu tr\xc6\xb0\xe1\xbb\x9dng summary trong qu\xc3\xa1 tr\xc3\xacnh INSERT v\xc3\xa0o b\xe1\xba\xa3ng ctivity.
  5. **V\xc3\xa1 l\xe1\xbb\x97i Zod Schema Validation:** Fix crash khi format l\xe1\xbb\x97i tr\xe1\xba\xa3 v\xe1\xbb\x81 t\xe1\xbb\xab Zod.
* **C\xc3\xa1c file t\xc3\xa1c \xc4\x91\xe1\xbb\x99ng:**
  * src/lib/db.js, src/app/actions.js, src/lib/validation.js, src/app/api/qa-test/route.js.
  * Snapshot l\xc6\xb0u t\xe1\xba\xa1i: .backups/20260831_v3.0_QA_fixes/.
'''

# 1. Process DEVELOPMENT_LOG
dev_src = r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\DEVELOPMENT_LOG_FIXED.md'
dev_dst = r'G:\My Drive\AI project\ATS\DEVELOPMENT_LOG.md'
dev_content = open(dev_src, 'rb').read()
if dev_content.startswith(codecs.BOM_UTF8):
    dev_content = dev_content[len(codecs.BOM_UTF8):]
with open(dev_dst, 'wb') as f:
    f.write(codecs.BOM_UTF8)
    f.write(dev_content)
    f.write(qa_log_dev)

# 2. Process BLUEPRINT (Insert QA Log at the Changelog section)
bp_src = r'G:\My Drive\AI project\ATS\ATS 3.0\roll back\ATS_3.0_UI_Modernization_Blueprint.md'
bp_dst = r'G:\My Drive\AI project\My Porfolio\blue print\ATS_3.0_UI_Modernization_Blueprint.md'
bp_content = open(bp_src, 'rb').read()
if bp_content.startswith(codecs.BOM_UTF8):
    bp_content = bp_content[len(codecs.BOM_UTF8):]

insert_marker = b'## 7. Nh\xe1\xba\xadt K\xc3\xbd C\xe1\xba\xadp Nh\xe1\xba\xadt (Changelog)\n'
idx = bp_content.find(insert_marker)
if idx != -1:
    insert_pos = idx + len(insert_marker)
    # Using double quotes b"..." to avoid conflict with 'map'
    new_bp_content = bp_content[:insert_pos] + b"\n### v3.0-RC75-QA (31/08/2026)\n* \xf0\x9f\x9b\xa1\xef\xb8\x8f **Ki\xe1\xbb\x83m th\xe1\xbb\xad Nghi\xe1\xbb\x87m thu & V\xc3\xa1 L\xe1\xbb\x97i Database (QA Verification & Integrity Fixes)**:\n  * **T\xe1\xba\xa1o API Route Ki\xe1\xbb\x83m Th\xe1\xbb\xad T\xe1\xbb\xb1 \xc4\x90\xe1\xbb\x99ng:** X\xc3\xa2y d\xe1\xbb\xb1ng endpoint \xc4\x91\xe1\xbb\x99c l\xe1\xba\xadp (src/app/api/qa-test/route.js) \xc4\x91\xe1\xbb\x83 b\xe1\xba\xafn 5 k\xe1\xbb\x8bch b\xe1\xba\xa3n \xc3\xa1c li\xe1\xbb\x87t nh\xe1\xba\xa5t.\n  * **V\xc3\xa1 l\xe1\xbb\x97i Connection Pooler (PgBouncer):** B\xe1\xbb\x95 sung prepare: false v\xc3\xa0o Postgres client (db.js) \xc4\x91\xe1\xbb\x83 t\xc6\xb0\xc6\xa1ng th\xc3\xadch ho\xc3\xa0n to\xc3\xa0n v\xe1\xbb\x9bi ch\xe1\xba\xbf \xc4\x91\xe1\xbb\x99 Transaction Mode tr\xc3\xaan Port 6543 c\xe1\xbb\xa7a Supabase.\n  * **Row-level Transaction Lock:** Th\xc3\xaam pg_advisory_xact_lock v\xc3\xa0o c\xc3\xa1c Server Actions (ctions.js) \xc4\x91\xe1\xbb\x83 lo\xe1\xba\xa1i b\xe1\xbb\x8f ho\xc3\xa0n to\xc3\xa0n \xc4\x91\xe1\xbb\xa5ng \xc4\x91\xe1\xbb\x99 Race Condition khi sinh display_number.\n  * **Kh\xe1\xba\xafc ph\xe1\xbb\xa5c l\xe1\xbb\x97i Not-Null Constraint:** V\xc3\xa1 l\xe1\xbb\x97i thi\xe1\xba\xbfu tr\xc6\xb0\xe1\xbb\x9dng summary trong qu\xc3\xa1 tr\xc3\xacnh INSERT v\xc3\xa0o b\xe1\xba\xa3ng ctivity.\n  * **V\xc3\xa1 l\xe1\xbb\x97i Zod Schema Validation:** Fix crash Cannot read properties of undefined (reading 'map') khi format l\xe1\xbb\x97i tr\xe1\xba\xa3 v\xe1\xbb\x81 t\xe1\xbb\xab Zod.\n" + bp_content[insert_pos:]
else:
    new_bp_content = bp_content + b'\n[ERROR: COULD NOT FIND CHANGELOG MARKER]'

with open(bp_dst, 'wb') as f:
    f.write(codecs.BOM_UTF8)
    f.write(new_bp_content)

print("Done writing both files with BOM and QA logs.")
