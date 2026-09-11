import postgres from 'postgres';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

const sql = postgres('process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres'', {ssl: 'require'});

const hoList = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trịnh', 'Đinh'];
const demList = ['Văn', 'Thị', 'Minh', 'Hữu', 'Quang', 'Ngọc', 'Thanh', 'Xuân', 'Đức', 'Hải', 'Tuấn', 'Thế', 'Quốc', 'Kim', 'Thùy', 'Hồng', 'Bích', 'Tuyết', 'Diệu'];
const tenList = ['An', 'Anh', 'Bình', 'Châu', 'Đạt', 'Dũng', 'Dương', 'Hà', 'Hải', 'Hiếu', 'Hòa', 'Huy', 'Hưng', 'Khang', 'Khoa', 'Kiên', 'Lâm', 'Linh', 'Long', 'Ly', 'Nam', 'Nga', 'Ngọc', 'Nhi', 'Phong', 'Phúc', 'Phương', 'Quân', 'Quyên', 'Sơn', 'Tài', 'Tâm', 'Thảo', 'Thắng', 'Thành', 'Tiến', 'Trang', 'Trí', 'Tú', 'Tuấn', 'Uyên', 'Vân', 'Việt', 'Vy', 'Yến'];

function getRandomName() {
  const ho = hoList[Math.floor(Math.random() * hoList.length)];
  const dem = demList[Math.floor(Math.random() * demList.length)];
  const ten = tenList[Math.floor(Math.random() * tenList.length)];
  return `${ho} ${dem} ${ten}`;
}

function getRandomStatus() {
  const statuses = ['In progress', 'Done', 'Cancelled', 'Closed'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function getRandomStage() {
  const stages = ['Sourced', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
  return stages[Math.floor(Math.random() * stages.length)];
}

async function generateMassiveDummy() {
  console.log('=== KHỞI TẠO 1,688 DUMMY CANDIDATES VÀ LIÊN KẾT ===');
  
  try {
    await sql.begin(async (sqlTx) => {
      // 1. Clean existing dummy candidates
      await sqlTx`DELETE FROM sandbox.candidates`;
      console.log('- Đã xóa các candidates tạm thời.');

      // 2. Fetch Jobs to link
      const jobs = await sqlTx`SELECT id FROM sandbox.jobs`;
      if (jobs.length === 0) throw new Error('Không có Jobs trong sandbox');

      const TOTAL_CANDIDATES = 1688;
      const TOTAL_ACTIVITIES = 1600;
      const TOTAL_LOGS = 2218;
      const TOTAL_INTERVIEWS = 24;

      const candidatesToInsert = [];
      const contactsToInsert = [];
      const activitiesToInsert = [];
      const logsToInsert = [];
      const interviewsToInsert = [];

      let displayNum = 10000;

      console.log(`- Đang chuẩn bị dữ liệu cho ${TOTAL_CANDIDATES} ứng viên...`);

      // Generate Candidates & Contacts
      for (let i = 0; i < TOTAL_CANDIDATES; i++) {
        const cId = uuidv4();
        const name = getRandomName();
        const email = `candidate.${displayNum + i}@fake-email.com`;
        const phone = '+8499' + String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
        const linkedin = `https://linkedin.com/in/dummy-${displayNum + i}`;
        
        candidatesToInsert.push({
          id: cId,
          display_number: displayNum + i,
          full_name: name,
          emails: [email],
          phones: [phone],
          socials: [{ type: 'LinkedIn', value: linkedin, url: linkedin }],
          all_contacts_text: `${phone} | ${email} | ${linkedin}`,
          created_time: new Date(),
          last_updated: new Date()
        });

        contactsToInsert.push({ id: uuidv4(), candidate_id: cId, type: 'Email', value: email, created_time: new Date(), last_updated: new Date() });
        contactsToInsert.push({ id: uuidv4(), candidate_id: cId, type: 'Phone', value: phone, created_time: new Date(), last_updated: new Date() });
        contactsToInsert.push({ id: uuidv4(), candidate_id: cId, type: 'LinkedIn', value: linkedin, created_time: new Date(), last_updated: new Date() });
      }

      // Generate Activities (1600 applications distributed among candidates)
      for (let i = 0; i < TOTAL_ACTIVITIES; i++) {
        const actId = uuidv4();
        const cand = candidatesToInsert[Math.floor(Math.random() * TOTAL_CANDIDATES)];
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        activitiesToInsert.push({
          id: actId,
          candidate_id: cand.id,
          job_id: job.id,
          current_stage: getRandomStage(),
          status: getRandomStatus(),
          source_channel: 'LinkedIn',
          summary: 'Generated Dummy Application',
          display_number: 20000 + i,
          created_time: new Date(),
          last_updated: new Date()
        });
      }

      // Generate Activity Logs (2218 logs distributed among activities)
      for (let i = 0; i < TOTAL_LOGS; i++) {
        const act = activitiesToInsert[Math.floor(Math.random() * TOTAL_ACTIVITIES)];
        logsToInsert.push({
          id: uuidv4(),
          application_id: act.id,
          action_type: 'Note',
          note: 'This is a system generated dummy activity log to simulate real interactions.',
          action_date: new Date(),
          created_time: new Date()
        });
      }

      // Generate Interviews (24 interviews)
      for (let i = 0; i < TOTAL_INTERVIEWS; i++) {
        const act = activitiesToInsert[Math.floor(Math.random() * TOTAL_ACTIVITIES)];
        interviewsToInsert.push({
          id: uuidv4(),
          application_id: act.id,
          title: 'Technical Round 1',
          date: new Date(),
          duration_minutes: 60,
          interviewer: ['Dummy Interviewer'],
          interview_location: 'Google Meet'
        });
      }

      console.log('- Đang chèn dữ liệu vào Database (batch inserts)...');

      // Helper for chunking
      const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

      for (const batch of chunk(candidatesToInsert, 500)) await sqlTx`INSERT INTO sandbox.candidates ${sql(batch)}`;
      console.log(`  + Đã chèn ${candidatesToInsert.length} Candidates`);

      for (const batch of chunk(contactsToInsert, 1000)) await sqlTx`INSERT INTO sandbox.contact_points ${sql(batch)}`;
      console.log(`  + Đã chèn ${contactsToInsert.length} Contact Points`);

      for (const batch of chunk(activitiesToInsert, 500)) await sqlTx`INSERT INTO sandbox.activity ${sql(batch)}`;
      console.log(`  + Đã chèn ${activitiesToInsert.length} Applications`);

      for (const batch of chunk(logsToInsert, 1000)) await sqlTx`INSERT INTO sandbox.activity_log ${sql(batch)}`;
      console.log(`  + Đã chèn ${logsToInsert.length} Activity Logs`);

      await sqlTx`INSERT INTO sandbox.interviews ${sql(interviewsToInsert)}`;
      console.log(`  + Đã chèn ${interviewsToInsert.length} Interviews`);
      
    });
    console.log('=== HOÀN TẤT BƠM 100% DỮ LIỆU ===');
  } catch(e) {
    console.error('LỖI:', e);
  }
}
generateMassiveDummy().then(() => process.exit(0));
