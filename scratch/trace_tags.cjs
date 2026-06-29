const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const cleanedHtml = html.replace(/"[^"]*?"/g, '""').replace(/'[^']*?'/g, "''");

function traceEvents(htmlString) {
  const tagRegex = /<\/?([a-zA-Z0-9:-]+)(?:\s+[^>]*?)?>/g;
  const stack = [];
  let match;

  function getLineNumber(index) {
    let count = 1;
    for (let i = 0; i < index; i++) {
      if (htmlString[i] === '\n') count++;
    }
    return count;
  }

  console.log("Tracing starts...");
  while ((match = tagRegex.exec(htmlString)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['img', 'br', 'input', 'meta', 'link', 'hr', 'source'].includes(tagName);

    if (isSelfClosing) continue;

    const line = getLineNumber(match.index);

    if (line < 139) continue;
    if (line > 612) break;

    if (!isClosing) {
      stack.push({ name: tagName, line, tag: fullTag });
      console.log(`[OPEN]  <${tagName}> at line ${line} (stack depth: ${stack.length})`);
    } else {
      if (stack.length === 0) {
        console.log(`[CLOSE] EXTRA </${tagName}> at line ${line}`);
      } else {
        const last = stack.pop();
        if (last.name !== tagName) {
          console.log(`[MISMATCH] Expected </${last.name}> (opened line ${last.line}) but got </${tagName}> at line ${line}`);
          // Put it back to keep tracking
          stack.push(last);
        } else {
          console.log(`[CLOSE] </${tagName}> at line ${line} (stack depth: ${stack.length})`);
        }
      }
    }
  }

  console.log(`Remaining open tags inside active-round-tab-content:`);
  stack.forEach(t => {
    console.log(`  - <${t.name}> opened at line ${t.line}: ${t.tag}`);
  });
}

traceEvents(cleanedHtml);
