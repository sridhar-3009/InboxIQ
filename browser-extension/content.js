// Mailair content script — runs on Gmail (and LinkedIn, for the compose helper)
//
// Two jobs:
// 1. Inject an AI-drafted reply into the active Gmail compose box (used by popup.js)
// 2. Show a small floating "priority panel" in Gmail listing today's urgent /
//    needs-response emails, so you don't have to leave Gmail to see what
//    Mailair flagged.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'INJECT_DRAFT') return;
  const composeBody = document.querySelector('[aria-label="Message Body"][contenteditable="true"]');
  if (composeBody) {
    composeBody.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, msg.body);
  }
});

// ─── Priority panel (Gmail only) ───────────────────────────────────────────────

if (location.hostname === 'mail.google.com') {
  initPriorityPanel();
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['mailair_url', 'mailair_token'], (result) => {
      resolve({
        apiUrl: (result.mailair_url || 'https://mailair.company').replace(/\/$/, ''),
        apiToken: result.mailair_token || '',
      });
    });
  });
}

async function fetchPriorityInbox(apiUrl, apiToken) {
  const res = await fetch(`${apiUrl}/api/emails/priority-inbox`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'mailair-priority-panel';
  panel.innerHTML = `
    <div id="mailair-panel-header">
      <span id="mailair-panel-title">Mailair Priority</span>
      <button id="mailair-panel-toggle" aria-label="Collapse">–</button>
    </div>
    <div id="mailair-panel-body">
      <p id="mailair-panel-empty">Connect the extension (click the Mailair icon) to see priority emails here.</p>
      <ul id="mailair-panel-list"></ul>
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelector('#mailair-panel-toggle').addEventListener('click', () => {
    const body = panel.querySelector('#mailair-panel-body');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    panel.querySelector('#mailair-panel-toggle').textContent = collapsed ? '–' : '+';
  });

  return panel;
}

async function initPriorityPanel() {
  // Wait for Gmail's own UI to settle before injecting ours
  await new Promise((r) => setTimeout(r, 1500));

  const panel = buildPanel();
  const { apiUrl, apiToken } = await getConfig();
  if (!apiToken) return; // empty-state message already shown

  try {
    const data = await fetchPriorityInbox(apiUrl, apiToken);
    const emails = [...(data.urgent || []), ...(data.needs_response || [])].slice(0, 6);
    const list = panel.querySelector('#mailair-panel-list');
    const empty = panel.querySelector('#mailair-panel-empty');

    if (emails.length === 0) {
      empty.textContent = 'Nothing urgent right now.';
      return;
    }
    empty.style.display = 'none';

    for (const email of emails) {
      const li = document.createElement('li');
      li.className = 'mailair-panel-item';
      const sender = (email.sender || '').split('<')[0].trim() || email.sender || 'Unknown';
      const category = (email.category || '').replace('_', ' ');
      li.innerHTML = `
        <span class="mailair-item-dot mailair-cat-${email.category || 'other'}"></span>
        <span class="mailair-item-text">
          <span class="mailair-item-sender">${escapeHtml(sender)}</span>
          <span class="mailair-item-subject">${escapeHtml(email.subject || '')}</span>
        </span>
        <span class="mailair-item-cat">${escapeHtml(category)}</span>
      `;
      li.addEventListener('click', () => {
        window.open(`https://mailair.company/email/${email.id}?reply=1`, '_blank');
      });
      list.appendChild(li);
    }
  } catch (e) {
    const empty = panel.querySelector('#mailair-panel-empty');
    empty.textContent = 'Could not load priority inbox.';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
