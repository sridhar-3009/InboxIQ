const $ = id => document.getElementById(id);

// ─── State ────────────────────────────────────────────────────────────────────
let apiUrl = '', apiToken = '', draftText = '';

async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['mailair_url', 'mailair_token'], result => {
      apiUrl = result.mailair_url || '';
      apiToken = result.mailair_token || '';
      resolve({ apiUrl, apiToken });
    });
  });
}

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${apiUrl}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadConfig();
  if (apiUrl && apiToken) {
    showComposer();
  } else {
    showAuth();
  }
}

function showAuth() {
  $('auth-section').classList.remove('hidden');
  $('composer-section').classList.add('hidden');
  $('status-dot').className = 'dot disconnected';
}

function showComposer() {
  $('auth-section').classList.add('hidden');
  $('composer-section').classList.remove('hidden');
  $('status-dot').className = 'dot connected';
  loadPageContext();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
$('save-token').addEventListener('click', () => {
  apiUrl = ($('api-url').value || 'https://inboxiq-sby6.onrender.com').replace(/\/$/, '');
  apiToken = $('api-token').value.trim();
  if (!apiToken) return alert('Token required');
  chrome.storage.local.set({ mailair_url: apiUrl, mailair_token: apiToken }, showComposer);
});

$('disconnect-btn').addEventListener('click', () => {
  chrome.storage.local.remove(['mailair_url', 'mailair_token'], showAuth);
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ─── AI Draft ────────────────────────────────────────────────────────────────
$('ai-draft-btn').addEventListener('click', async () => {
  const to = $('to-email').value.trim();
  const subject = $('subject').value.trim();
  const context = $('context-hint').value.trim();

  if (!to || !subject) return alert('To and Subject required');

  $('draft-spinner').classList.remove('hidden');
  $('ai-draft-btn').disabled = true;

  try {
    const result = await api('/api/emails/ai-draft', 'POST', { to, subject, context });
    draftText = result.draft || result.body || '';
    $('draft-output').value = draftText;
    $('draft-actions').style.display = 'flex';
    $('send-btn').disabled = false;
  } catch (e) {
    alert('Failed to generate draft: ' + e.message);
  } finally {
    $('draft-spinner').classList.add('hidden');
    $('ai-draft-btn').disabled = false;
  }
});

$('regenerate-btn').addEventListener('click', () => $('ai-draft-btn').click());

$('use-draft-btn').addEventListener('click', () => {
  const body = $('draft-output').value;
  $('draft-output').select();
  document.execCommand('copy');
  // Inject into active Gmail compose window if on Gmail
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.url?.includes('mail.google.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_DRAFT', body });
    }
  });
});

$('send-btn').addEventListener('click', async () => {
  const to = $('to-email').value.trim();
  const subject = $('subject').value.trim();
  const body = $('draft-output').value.trim();
  if (!to || !subject || !body) return alert('Fill in all fields');
  $('send-btn').disabled = true;
  $('send-btn').textContent = 'Sending…';
  try {
    await api('/api/emails/compose', 'POST', { to, subject, body });
    $('send-btn').textContent = '✓ Sent!';
    setTimeout(() => {
      $('send-btn').textContent = 'Send via Mailair';
      $('send-btn').disabled = false;
      $('to-email').value = '';
      $('subject').value = '';
      $('context-hint').value = '';
      $('draft-output').value = '';
      draftText = '';
    }, 2000);
  } catch (e) {
    alert('Send failed: ' + e.message);
    $('send-btn').disabled = false;
    $('send-btn').textContent = 'Send via Mailair';
  }
});

// ─── Page Context ─────────────────────────────────────────────────────────────
function loadPageContext() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab) return;
    $('page-context').textContent = `Page: ${tab.title || tab.url}`;
    // Auto-fill To from LinkedIn profile URL
    if (tab.url?.includes('linkedin.com/in/')) {
      const name = tab.title?.replace('| LinkedIn', '').trim();
      if (name) $('context-hint').placeholder = `Email to ${name} about…`;
    }
  });
}

$('search-knowledge-btn').addEventListener('click', async () => {
  const to = $('to-email').value || $('context-hint').value;
  if (!to) return alert('Fill in a contact or context first');
  const query = to.split('@')[0];
  try {
    const result = await api(`/api/knowledge?q=${encodeURIComponent(query)}`);
    const entries = result.entries || [];
    const container = $('knowledge-results');
    container.classList.remove('hidden');
    if (entries.length === 0) {
      container.innerHTML = '<p style="color:#475569;font-size:11px">No knowledge entries found for this contact.</p>';
      return;
    }
    container.innerHTML = entries.slice(0, 4).map(e => `
      <div class="knowledge-item">
        <div class="type">${e.entry_type}</div>
        <div class="title">${e.title}</div>
        <div class="content">${e.content}</div>
      </div>
    `).join('');
  } catch (e) {
    alert('Knowledge search failed: ' + e.message);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
init();
