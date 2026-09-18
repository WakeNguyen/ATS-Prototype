const url = "http://localhost:3000/api/webhooks/cv-import";
const payload = {
  full_name: "Nguyễn Văn A (Updated via N8N)",
  contactPoints: [
    { type: "Email", value: "candidate.10000@fake-email.com" },
    { type: "Phone", value: "0909999888" },
    { type: "LinkedIn", value: "https://linkedin.com/in/updated-candidate" }
  ],
  cv_url: "https://drive.google.com/file/d/1234567890abcdef/view",
  notes: "Updated CV from N8N"
};

fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(console.log)
.catch(console.error);
