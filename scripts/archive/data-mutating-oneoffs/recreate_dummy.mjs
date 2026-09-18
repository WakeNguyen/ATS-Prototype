import postgres from 'postgres';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

const sql = postgres('postgresql://postgres:ATS3_Supabase_SecurePass2026!@db.mock-supabase-project.supabase.co:5432/postgres?options=-c%20search_path%3Dsandbox,public', {ssl: 'require'});

const fakeNames = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm Quỳnh D', 'Hoàng Minh E', 'Đỗ Xuân F', 'Vũ Hải G', 'Bùi Ngọc H', 'Đặng Tuấn I', 'Thái An J', 'Lý Quốc K', 'Trịnh Thanh L', 'Phan Văn M', 'Đinh Hữu N', 'Đào Quang O', 'Mai Thế P', 'Phùng Trọng Q', 'Vương Quyết R', 'Lâm Tùng S', 'Hồ Chí T'];

async function recreateDummy() {
  console.log('=== KHÔI PHỤC DỮ LIỆU DUMMY VÀO SANDBOX ===');
  
  try {
    await sql.begin(async (sqlTx) => {
      // 2. Get some sandbox jobs to link activity
      const jobs = await sqlTx`SELECT id, job_title FROM sandbox.jobs LIMIT 20`;
      if (jobs.length === 0) throw new Error('Không tìm thấy Job trong Sandbox');

      let insertedCands = 0;
      let insertedContacts = 0;
      let insertedApps = 0;
      let displayNum = 900000;

      for (let i = 0; i < 50; i++) {
        const newId = uuidv4();
        const fakeName = fakeNames[i % fakeNames.length] + ' (Dummy ' + i + ')';
        const fakeEmail = 'dummy' + i + '@example.com';
        const fakePhone = '+84999' + String(i).padStart(6, '0');
        const fakeUrl = 'https://linkedin.com/in/dummy-' + i;
        
        const fakeText = fakePhone + ' | ' + fakeEmail + ' | ' + fakeUrl;

        // Bơm Candidate
        await sqlTx`
          INSERT INTO sandbox.candidates 
          (id, display_number, full_name, emails, phones, socials, all_contacts_text, created_time, last_updated)
          VALUES 
          (${newId}, ${displayNum + i}, ${fakeName}, ${[fakeEmail]}, ${[fakePhone]}, 
           ${[{ type: 'LinkedIn', value: fakeUrl, url: fakeUrl }]}, ${fakeText}, NOW(), NOW())
        `;
        insertedCands++;

        // Bơm Contact Points
        await sqlTx`INSERT INTO sandbox.contact_points (id, candidate_id, type, value, created_time, last_updated) VALUES (${uuidv4()}, ${newId}, 'Email', ${fakeEmail}, NOW(), NOW())`;
        await sqlTx`INSERT INTO sandbox.contact_points (id, candidate_id, type, value, created_time, last_updated) VALUES (${uuidv4()}, ${newId}, 'Phone', ${fakePhone}, NOW(), NOW())`;
        await sqlTx`INSERT INTO sandbox.contact_points (id, candidate_id, type, value, created_time, last_updated) VALUES (${uuidv4()}, ${newId}, 'LinkedIn', ${fakeUrl}, NOW(), NOW())`;
        insertedContacts += 3;

        // Bơm Activity (Application) vào Job ngẫu nhiên
        const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
        const appId = uuidv4();
        await sqlTx`
          INSERT INTO sandbox.activity
          (id, candidate_id, job_id, current_stage, status, source_channel, summary, display_number, created_time, last_updated)
          VALUES
          (${appId}, ${newId}, ${randomJob.id}, 'Sourced', 'In progress', 'LinkedIn', 'Dummy Application', ${displayNum + i}, NOW(), NOW())
        `;
        insertedApps++;
      }

      console.log(`- Đã khôi phục thành công ${insertedCands} Candidates giả lập (được làm ẩn danh hoàn toàn).`);
      console.log(`- Đã khôi phục thành công ${insertedContacts} Contact Points giả lập.`);
      console.log(`- Đã khôi phục thành công ${insertedApps} Applications giả lập.`);
    });
    console.log('=== HOÀN TẤT ===');
  } catch(e) {
    console.error('LỖI:', e);
  }
}
recreateDummy().then(() => process.exit(0));
