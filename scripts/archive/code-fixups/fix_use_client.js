const fs = require('fs');
const files = [
  'src/app/candidates/page.js',
  'src/app/jobs/page.js',
  'src/app/search/page.js',
  'src/components/AttachCandidateModal.js',
  'src/components/NewCandidateModal.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // Find "use client" or 'use client'
  const match = content.match(/^.*['"]use client['"];?\s*/m);
  if (match) {
    // Remove it from its current position
    content = content.replace(match[0], '');
    // Prepend it to the very top
    content = '"use client";\n\n' + content.trimStart();
    fs.writeFileSync(f, content);
    console.log('Fixed use client in ' + f);
  }
});
