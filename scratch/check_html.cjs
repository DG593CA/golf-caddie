const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function checkTags(htmlString) {
  const stack = [];
  let i = 0;
  const len = htmlString.length;

  function getLine(idx) {
    return htmlString.slice(0, idx).split('\n').length;
  }

  while (i < len) {
    // 1. Skip comments
    if (htmlString.slice(i, i + 4) === '<!--') {
      const end = htmlString.indexOf('-->', i + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }

    // 2. Skip script tags completely
    if (htmlString.slice(i, i + 7).toLowerCase() === '<script') {
      const end = htmlString.toLowerCase().indexOf('</script>', i + 7);
      if (end === -1) break;
      i = end + 9;
      continue;
    }

    // 3. Skip style tags completely
    if (htmlString.slice(i, i + 6).toLowerCase() === '<style') {
      const end = htmlString.toLowerCase().indexOf('</style>', i + 6);
      if (end === -1) break;
      i = end + 8;
      continue;
    }

    // 4. Parse tags
    if (htmlString[i] === '<') {
      const isClose = htmlString[i + 1] === '/';
      let tagStart = isClose ? i + 2 : i + 1;
      let tagEnd = tagStart;
      
      // Read tag name
      while (tagEnd < len && /[a-zA-Z0-9:-]/.test(htmlString[tagEnd])) {
        tagEnd++;
      }
      
      const tagName = htmlString.slice(tagStart, tagEnd).toLowerCase();
      
      // Find closing '>'
      let inDoubleQuote = false;
      let inSingleQuote = false;
      let j = tagEnd;
      while (j < len) {
        const c = htmlString[j];
        if (c === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        else if (c === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (c === '>' && !inDoubleQuote && !inSingleQuote) {
          break;
        }
        j++;
      }
      
      const fullTag = htmlString.slice(i, j + 1);
      const isSelfClosing = fullTag.endsWith('/>') || ['img', 'br', 'input', 'meta', 'link', 'hr', 'source'].includes(tagName);
      const line = getLine(i);
      
      i = j + 1;
      
      if (!tagName) continue;
      if (isSelfClosing) continue;
      
      if (!isClose) {
        stack.push({ name: tagName, line, tag: fullTag });
      } else {
        if (stack.length === 0) {
          console.error(`Error: Unexpected closing tag </${tagName}> at line ${line}`);
          return false;
        }
        const last = stack.pop();
        if (last.name !== tagName) {
          console.error(`Error: Mismatched tag. Expected </${last.name}> (opened at line ${last.line}), but got </${tagName}> at line ${line}`);
          console.log("Current open tags stack (top 15):");
          stack.slice(-15).reverse().forEach(t => {
            console.log(`  - <${t.name}> opened at line ${t.line}: ${t.tag}`);
          });
          return false;
        }
      }
      continue;
    }
    
    i++;
  }

  if (stack.length > 0) {
    console.error(`Error: Unclosed tags remaining:`);
    stack.forEach(t => {
      console.error(`  - <${t.name}> opened at line ${t.line}: ${t.tag}`);
    });
    return false;
  }

  console.log("Success: All HTML tags are properly balanced and closed!");
  return true;
}

checkTags(html);
