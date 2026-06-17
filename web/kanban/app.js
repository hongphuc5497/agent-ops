const state = {
  snapshot: null,
  selectedId: '',
  loading: true,
};

const columns = [
  ['backlog', 'Backlog'],
  ['active', 'Active'],
  ['parked', 'Parked'],
  ['done', 'Done'],
  ['killed', 'Killed'],
];

const els = {
  repoPath: document.querySelector('#repo-path'),
  refresh: document.querySelector('#refresh-button'),
  newTask: document.querySelector('#new-task-button'),
  check: document.querySelector('#check-button'),
  showKilled: document.querySelector('#show-killed'),
  activeOnly: document.querySelector('#active-only'),
  loading: document.querySelector('#loading-region'),
  board: document.querySelector('#board'),
  error: document.querySelector('#error-region'),
  health: document.querySelector('#health-panel'),
  claims: document.querySelector('#claims-panel'),
  form: document.querySelector('#task-form'),
  formError: document.querySelector('#form-error'),
  drawerTitle: document.querySelector('#drawer-title'),
  commandNote: document.querySelector('#command-note'),
  clearSelection: document.querySelector('#clear-selection'),
  claim: document.querySelector('#claim-button'),
  finish: document.querySelector('#finish-button'),
  park: document.querySelector('#park-button'),
  id: document.querySelector('#task-id'),
  title: document.querySelector('#task-title'),
  owner: document.querySelector('#task-owner'),
  workflow: document.querySelector('#task-workflow'),
  verification: document.querySelector('#task-verification'),
  files: document.querySelector('#task-files'),
  outOfScope: document.querySelector('#task-out-of-scope'),
  active: document.querySelector('#task-active'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lines(value) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function showError(target, payload) {
  const message = payload?.error || payload?.message || 'Command failed.';
  const command = payload?.command ? `<div><strong>Command:</strong> <code>${escapeHtml(payload.command)}</code></div>` : '';
  const stderr = payload?.stderr ? `<div><strong>stderr:</strong> <code>${escapeHtml(payload.stderr).slice(0, 600)}</code></div>` : '';
  target.innerHTML = `<strong>${escapeHtml(message)}</strong>${command}${stderr}`;
  target.hidden = false;
}

function clearError(target) {
  target.hidden = true;
  target.textContent = '';
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw payload;
  }
  return payload;
}

function allTasks() {
  if (!state.snapshot) {
    return [];
  }
  return Object.values(state.snapshot.columns).flat();
}

function selectedTask() {
  return allTasks().find((task) => task.id === state.selectedId) || null;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.loading.hidden = !isLoading;
  els.board.hidden = isLoading;
}

async function loadSnapshot() {
  setLoading(true);
  clearError(els.error);
  try {
    state.snapshot = await requestJson('/api/snapshot');
    els.repoPath.textContent = state.snapshot.repo || 'Unknown repo';
    render();
  } catch (error) {
    showError(els.error, error);
  } finally {
    setLoading(false);
  }
}

function render() {
  renderBoard();
  renderHealth();
  renderClaims();
  renderForm(selectedTask());
}

function renderBoard() {
  const visibleColumns = columns.filter(([key]) => {
    if (key === 'killed' && !els.showKilled.checked) {
      return false;
    }
    if (els.activeOnly.checked && !['backlog', 'active'].includes(key)) {
      return false;
    }
    return true;
  });

  els.board.innerHTML = visibleColumns
    .map(([key, label]) => {
      const tasks = state.snapshot.columns[key] || [];
      const cards = tasks.length
        ? tasks.map((task) => taskCard(task)).join('')
        : `<div class="empty-column">${emptyCopy(key)}</div>`;
      return `
        <section class="column" data-column="${key}">
          <div class="column-head">
            <h2>${label}</h2>
            <span class="count">${tasks.length}</span>
          </div>
          <div class="cards">${cards}</div>
        </section>
      `;
    })
    .join('');

  els.board.querySelectorAll('.task-card').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedId = button.dataset.id;
      render();
    });
  });
}

function taskCard(task) {
  const selected = task.id === state.selectedId ? ' selected' : '';
  const verification = task.verification_result || task.verification || 'No verification recorded.';
  const owner = task.owner || 'unowned';
  return `
    <button class="task-card${selected}" type="button" data-id="${escapeHtml(task.id)}">
      <p class="task-title">${escapeHtml(task.title || task.id)}</p>
      <p class="task-meta">${escapeHtml(owner)} / ${escapeHtml(task.status)}</p>
      <p class="task-note mono">${escapeHtml(verification)}</p>
      <span class="task-id">${escapeHtml(task.id)}</span>
    </button>
  `;
}

function emptyCopy(key) {
  if (key === 'backlog') {
    return 'No backlog tasks. Use New task to create one without changing active ownership.';
  }
  if (key === 'active') {
    return 'No active task. Create one as active when implementation starts.';
  }
  if (key === 'parked') {
    return 'No parked decisions.';
  }
  if (key === 'done') {
    return 'No finished task archives yet.';
  }
  return 'Killed tasks are hidden unless this column is enabled.';
}

function renderHealth() {
  const health = state.snapshot.health;
  els.health.classList.toggle('ok', Boolean(health?.ok));
  els.health.classList.toggle('warn', Boolean(health && !health.ok));
  if (!health) {
    els.health.textContent = 'No health payload.';
    return;
  }
  const missing = health.missing?.length || 0;
  const invalid = (health.invalid_json?.length || 0) + (health.invalid_jsonl?.length || 0);
  els.health.textContent = health.ok
    ? 'Protocol check is clean.'
    : `Check needs attention: ${missing} missing, ${invalid} invalid, stale=${Boolean(health.stale)}.`;
}

function renderClaims() {
  const claims = state.snapshot.claims || [];
  if (!claims.length) {
    els.claims.className = 'chip-list empty';
    els.claims.textContent = 'No claims.';
    return;
  }
  els.claims.className = 'chip-list';
  els.claims.innerHTML = claims
    .flatMap((claim) => (claim.paths || []).map((item) => `<span class="chip">${escapeHtml(item)}</span>`))
    .join('');
}

function renderForm(task) {
  clearError(els.formError);
  const isEditing = Boolean(task);
  els.drawerTitle.textContent = isEditing ? 'Edit task' : 'New task';
  els.id.value = task?.id || '';
  els.title.value = task?.title || '';
  els.owner.value = task?.owner || '';
  els.workflow.value = task?.workflow || '';
  els.verification.value = task?.verification || '';
  els.files.value = (task?.files_in_scope || []).join('\n');
  els.outOfScope.value = (task?.out_of_scope || []).join('\n');
  els.active.checked = task?.status === 'active';
  els.active.disabled = isEditing;
  els.commandNote.textContent = isEditing
    ? `Command: update-task ${task.id}`
    : 'Command: create-task';
  const activeSelected = task?.status === 'active';
  els.claim.disabled = !activeSelected;
  els.finish.disabled = !activeSelected;
  els.park.disabled = !activeSelected;
}

function formPayload() {
  return {
    title: els.title.value.trim(),
    owner: els.owner.value.trim(),
    workflow: els.workflow.value.trim(),
    verification: els.verification.value.trim(),
    files: lines(els.files.value),
    outOfScope: lines(els.outOfScope.value),
    active: els.active.checked,
  };
}

async function saveTask(event) {
  event.preventDefault();
  clearError(els.formError);
  const payload = formPayload();
  if (!payload.title) {
    showError(els.formError, { error: 'title is required' });
    return;
  }
  try {
    if (els.id.value) {
      await requestJson(`/api/tasks/${encodeURIComponent(els.id.value)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      const created = await requestJson('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.selectedId = created.task?.id || '';
    }
    await loadSnapshot();
  } catch (error) {
    showError(els.formError, error);
  }
}

async function claimFiles() {
  const task = selectedTask();
  if (!task || task.status !== 'active') {
    showError(els.formError, { error: 'select the active task before claiming files' });
    return;
  }
  const paths = lines(els.files.value);
  if (!paths.length) {
    showError(els.formError, { error: 'add one file path before claiming' });
    return;
  }
  try {
    await requestJson(`/api/tasks/${encodeURIComponent(task.id)}/claim`, {
      method: 'POST',
      body: JSON.stringify({ paths, owner: els.owner.value.trim() || task.owner, reason: task.title }),
    });
    await loadSnapshot();
  } catch (error) {
    showError(els.formError, error);
  }
}

async function finishTask(result) {
  const task = selectedTask();
  if (!task || task.status !== 'active') {
    showError(els.formError, { error: 'select the active task before changing final state' });
    return;
  }
  try {
    await requestJson(`/api/tasks/${encodeURIComponent(task.id)}/finish`, {
      method: 'POST',
      body: JSON.stringify({ result, verification: els.verification.value.trim() }),
    });
    state.selectedId = '';
    await loadSnapshot();
  } catch (error) {
    showError(els.formError, error);
  }
}

els.refresh.addEventListener('click', loadSnapshot);
els.newTask.addEventListener('click', () => {
  state.selectedId = '';
  renderForm(null);
  els.title.focus();
});
els.clearSelection.addEventListener('click', () => {
  state.selectedId = '';
  render();
});
els.showKilled.addEventListener('change', renderBoard);
els.activeOnly.addEventListener('change', renderBoard);
els.form.addEventListener('submit', saveTask);
els.claim.addEventListener('click', claimFiles);
els.finish.addEventListener('click', () => finishTask('done'));
els.park.addEventListener('click', () => finishTask('parked'));
els.check.addEventListener('click', async () => {
  try {
    await requestJson('/api/check', { method: 'POST', body: '{}' });
    await loadSnapshot();
  } catch (error) {
    showError(els.error, error);
  }
});

loadSnapshot();
