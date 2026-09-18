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
  
  if (content.includes('lucide-react')) {
    let importStart = content.indexOf('import {');
    while (importStart !== -1) {
      let importEnd = content.indexOf('}', importStart);
      if (importEnd !== -1) {
        let block = content.substring(importStart, importEnd);
        let statementEnd = content.indexOf(';', importEnd);
        if (statementEnd === -1) statementEnd = importEnd + 30;
        
        let fullStatement = content.substring(importStart, statementEnd);
        
        if (fullStatement.includes('lucide-react')) {
          block = block.replace(/\bLinkedin\b\s*,?/g, '')
                       .replace(/\bFacebook\b\s*,?/g, '')
                       .replace(/\bGithub\b\s*,?/g, '');
          content = content.substring(0, importStart) + block + content.substring(importEnd);
        }
      }
      importStart = content.indexOf('import {', importStart + 1);
    }
    
    const brands = [];
    if (content.includes('<Linkedin')) brands.push('Linkedin');
    if (content.includes('<Facebook')) brands.push('Facebook');
    if (content.includes('<Github')) brands.push('Github');
    
    if (brands.length > 0 && !content.includes('BrandIcons')) {
       content = `import { ${brands.join(', ')} } from 'src/components/BrandIcons';\n` + content;
    }
    
    fs.writeFileSync(f, content);
    console.log('Fixed ' + f);
  }
});
