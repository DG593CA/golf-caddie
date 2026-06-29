import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';

console.log("Starting Chrome in headless mode...");
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/chrome-test-profile',
    'http://localhost:4173/'
  ]
);

chrome.on('error', (err) => {
  console.error("Failed to start Chrome:", err);
  process.exit(1);
});

// Wait for Chrome to bind port
setTimeout(() => {
  http.get('http://localhost:9222/json', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        const pages = JSON.parse(rawData);
        const page = pages.find(p => p.url && p.url.startsWith('http://localhost:4173/'));
        if (!page) {
          console.error("GolfCaddie AI page not found");
          chrome.kill();
          process.exit(1);
        }
        const wsUrl = page.webSocketDebuggerUrl;
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.id === 1) {
            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 10,
                method: 'Runtime.evaluate',
                params: {
                  expression: `(() => {
                    const tabComm = document.getElementById('tab-community');
                    if (tabComm) tabComm.click();
                    
                    const commContent = document.getElementById('community-tab-content');
                    return {
                      html: commContent ? commContent.outerHTML : 'NOT FOUND',
                      visible: commContent ? !commContent.classList.contains('hidden') : false
                    };
                  })()`,
                  returnByValue: true
                }
              }));
            }, 3000);
          }

          if (msg.id === 10) {
            console.log("COMMUNITY FEED DOM RESULT:", msg.result.result.value);
            
            // Now check Contact Us tab
            ws.send(JSON.stringify({
              id: 11,
              method: 'Runtime.evaluate',
              params: {
                expression: `(() => {
                  const tabCont = document.getElementById('tab-contact');
                  if (tabCont) tabCont.click();
                  
                  const contContent = document.getElementById('contact-tab-content');
                  return {
                    html: contContent ? contContent.outerHTML : 'NOT FOUND',
                    visible: contContent ? !contContent.classList.contains('hidden') : false
                  };
                })()`,
                returnByValue: true
              }
            }));
          }

          if (msg.id === 11) {
            console.log("CONTACT FEED DOM RESULT:", msg.result.result.value);
            chrome.kill();
            process.exit(0);
          }
        });

      } catch (e) {
        console.error("Failed to parse JSON:", e);
        chrome.kill();
        process.exit(1);
      }
    });
  });
}, 3000);
