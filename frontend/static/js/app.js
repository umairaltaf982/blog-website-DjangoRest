'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const API = {
  blogs:     '/api/blogs/',
  reactions: '/api/reactions/',
  login:     '/api/auth/login/',
  logout:    '/api/auth/logout/',
};

/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */
const state = {
  user:        null,   // { id, username, isAdmin }
  currentBlog: null,   // full blog object currently open
  blogs:       [],     // all blogs from last fetch
  reactions:   [],     // all reactions from last fetch
  deleteBlogId: null,  // id pending delete confirmation
};

/* ═══════════════════════════════════════════════════════════════
   CSRF HELPER
═══════════════════════════════════════════════════════════════ */
function getCsrfToken() {
  const name = 'csrftoken';
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, val] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(val);
  }
  return '';
}

/* ═══════════════════════════════════════════════════════════════
   FETCH WRAPPER
═══════════════════════════════════════════════════════════════ */
async function apiFetch(url, options = {}) {
  const defaults = {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken':  getCsrfToken(),
    },
    credentials: 'same-origin',
  };
  const merged = {
    ...defaults,
    ...options,
    headers: { ...defaults.headers, ...(options.headers || {}) },
  };

  const res = await fetch(url, merged);

  // 204 No Content – no body to parse
  if (res.status === 204) return { ok: true };

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden', 'fade-out');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.classList.add('hidden'), 320);
  }, 2800);
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER / PAGE NAVIGATION
═══════════════════════════════════════════════════════════════ */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${pageId}`);
    p.classList.toggle('hidden', p.id !== `page-${pageId}`);
  });
}

function navigate(page, data = null) {
  // Guard: non-admin can't manually reach admin page
  if (page === 'admin' && (!state.user || !state.user.isAdmin)) {
    showToast('Admin access only.', 'error');
    return;
  }
  // Guard: already logged-in users don't need login page
  if (page === 'login' && state.user) {
    navigate('home');
    return;
  }

  showPage(page);

  if (page === 'home')   loadBlogs();
  if (page === 'admin')  loadAdminBlogs();
  if (page === 'detail' && data) openDetail(data);
}

/* ═══════════════════════════════════════════════════════════════
   AUTH STATE  (check current session on page load)
═══════════════════════════════════════════════════════════════ */
async function checkAuth() {
  // Hit a lightweight endpoint that returns 401 if not logged in.
  // We abuse /api/blogs/ (always accessible) and read a user header
  // via the DRF session — instead we rely on a cookie check trick:
  // A simpler way: try to POST a reaction with no body; 401 = guest.
  // Best DRF way: call /api/auth/  endpoint but DRF doesn't expose /me/.
  // We store the user in sessionStorage after login/logout.
  const stored = sessionStorage.getItem('blogUser');
  if (stored) {
    try { state.user = JSON.parse(stored); } catch (_) {}
  }
  updateNavAuth();
}

function updateNavAuth() {
  const loginBtn    = document.getElementById('nav-login-btn');
  const logoutBtn   = document.getElementById('nav-logout-btn');
  const adminLink   = document.getElementById('nav-admin-link');
  const navAuth     = document.getElementById('nav-auth');

  if (state.user) {
    navAuth.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    logoutBtn.textContent = `Logout (${state.user.username})`;
    adminLink.classList.toggle('hidden', !state.user.isAdmin);
  } else {
    navAuth.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    adminLink.classList.add('hidden');
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════ */
async function login(username, password) {
  const btn = document.getElementById('login-submit-btn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  // DRF session login posts form-encoded data
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  formData.append('csrfmiddlewaretoken', getCsrfToken());

  const res = await fetch(API.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken':  getCsrfToken(),
    },
    credentials: 'same-origin',
    body: formData.toString(),
    redirect: 'manual',   // DRF login redirects on success
  });

  btn.textContent = 'Sign in';
  btn.disabled = false;

  // DRF login returns a redirect (302 → opaqueredirect) or 200 with form
  // A successful session login sets the sessionid cookie.
  // We verify by hitting an endpoint that requires auth.
  if (res.status === 200 || res.type === 'opaqueredirect' || res.ok) {
    // Try to determine is_staff by hitting the reactions endpoint
    // with a POST – if we get 403, we're admin; if 400, we're a user.
    // Better: probe by requesting /api/reactions/ and checking allowed methods.
    await resolveCurrentUser(username);
    return true;
  }

  return false;
}

async function resolveCurrentUser(username) {
  // Use the reactions endpoint to figure out staff status.
  // POST with empty body: non-admin → 400 (validation error, auth passed)
  //                       admin    → 403 (forbidden by IsNonAdminAuthenticatedOrReadOnly)
  //                       guest    → 403 with different message or 401
  const probe = await apiFetch(API.reactions, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  let isAdmin = false;
  if (probe.status === 403) {
    // Could be admin blocked, or genuinely not logged in.
    // Try admin-only blog POST to distinguish.
    const adminProbe = await apiFetch(API.blogs, {
      method: 'POST',
      body: JSON.stringify({ title: '__probe__', content: '__probe__' }),
    });
    // Admin gets 400 (bad data hits model) or 201; non-admin gets 403
    isAdmin = adminProbe.status !== 403;

    // Roll back if we accidentally created something
    if (adminProbe.ok && adminProbe.data && adminProbe.data.id) {
      await apiFetch(`${API.blogs}${adminProbe.data.id}/`, { method: 'DELETE' });
    }
  }

  state.user = { username, isAdmin };
  sessionStorage.setItem('blogUser', JSON.stringify(state.user));
  updateNavAuth();
}

async function logout() {
  await apiFetch(API.logout, { method: 'POST' });
  state.user = null;
  sessionStorage.removeItem('blogUser');
  updateNavAuth();
  navigate('home');
  showToast('Logged out successfully.', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   BLOGS — PUBLIC
═══════════════════════════════════════════════════════════════ */
async function loadBlogs() {
  const grid    = document.getElementById('blogs-grid');
  const loading = document.getElementById('home-loading');
  const empty   = document.getElementById('home-empty');

  grid.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  const res = await apiFetch(API.blogs);
  loading.classList.add('hidden');

  if (!res.ok) { showToast('Failed to load posts.', 'error'); return; }

  state.blogs = res.data;

  if (!state.blogs.length) {
    empty.classList.remove('hidden');
    return;
  }

  state.blogs.forEach(blog => {
    grid.appendChild(buildBlogCard(blog));
  });
}

function buildBlogCard(blog) {
  const card = document.createElement('article');
  card.className = 'blog-card';
  card.innerHTML = `
    <h2 class="blog-card__title">${escHtml(blog.title)}</h2>
    <p class="blog-card__excerpt">${escHtml(blog.content)}</p>
    <div class="blog-card__footer">
      <span>✍️ ${escHtml(blog.author.username)}</span>
      <div class="blog-card__reactions">
        <span>👍 ${blog.likes_count}</span>
        <span>👎 ${blog.dislikes_count}</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => navigate('detail', blog));
  return card;
}

/* ═══════════════════════════════════════════════════════════════
   BLOG DETAIL
═══════════════════════════════════════════════════════════════ */
async function openDetail(blog) {
  state.currentBlog = blog;

  document.getElementById('detail-title').textContent   = blog.title;
  document.getElementById('detail-author').textContent  = blog.author.username;
  document.getElementById('detail-date').textContent    = formatDate(blog.created_at);
  document.getElementById('detail-content').textContent = blog.content;
  document.getElementById('likes-count').textContent    = blog.likes_count;
  document.getElementById('dislikes-count').textContent = blog.dislikes_count;

  // Reaction button state
  await refreshReactionState(blog.id);
  updateReactionHint();
}

async function refreshReactionState(blogId) {
  const res = await apiFetch(API.reactions);
  if (!res.ok) return;
  state.reactions = res.data;

  const btnLike    = document.getElementById('btn-like');
  const btnDislike = document.getElementById('btn-dislike');

  btnLike.classList.remove('active-like');
  btnDislike.classList.remove('active-dislike');

  if (state.user && !state.user.isAdmin) {
    const myReaction = state.reactions.find(
      r => r.blog === blogId && r.user === state.user.username
    );
    if (myReaction?.reaction === 'L') btnLike.classList.add('active-like');
    if (myReaction?.reaction === 'D') btnDislike.classList.add('active-dislike');
  }
}

function updateReactionHint() {
  const hint = document.getElementById('reaction-hint');
  if (!state.user) {
    hint.textContent = 'Login to react';
  } else if (state.user.isAdmin) {
    hint.textContent = 'Admins cannot react';
  } else {
    hint.textContent = '';
  }
}

async function react(reactionType) {
  if (!state.user) {
    showToast('Please login to react.', 'warning');
    return;
  }
  if (state.user.isAdmin) {
    showToast('Admins cannot react to posts.', 'warning');
    return;
  }

  const res = await apiFetch(API.reactions, {
    method: 'POST',
    body: JSON.stringify({
      blog:     state.currentBlog.id,
      reaction: reactionType,
    }),
  });

  if (!res.ok) {
    showToast('Could not submit reaction.', 'error');
    return;
  }

  // Re-fetch blog to get updated counts
  const blogRes = await apiFetch(`${API.blogs}${state.currentBlog.id}/`);
  if (blogRes.ok) {
    state.currentBlog = blogRes.data;
    document.getElementById('likes-count').textContent    = blogRes.data.likes_count;
    document.getElementById('dislikes-count').textContent = blogRes.data.dislikes_count;
  }

  await refreshReactionState(state.currentBlog.id);
  showToast(reactionType === 'L' ? '👍 Liked!' : '👎 Disliked!', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN — BLOG MANAGEMENT
═══════════════════════════════════════════════════════════════ */
async function loadAdminBlogs() {
  const list    = document.getElementById('admin-blogs-list');
  const loading = document.getElementById('admin-loading');
  const empty   = document.getElementById('admin-empty');

  list.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  const res = await apiFetch(API.blogs);
  loading.classList.add('hidden');

  if (!res.ok) { showToast('Failed to load posts.', 'error'); return; }

  state.blogs = res.data;

  if (!state.blogs.length) {
    empty.classList.remove('hidden');
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Title</th>
        <th class="col-author">Author</th>
        <th class="col-date">Date</th>
        <th>Reactions</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="admin-tbody"></tbody>
  `;

  const tbody = table.querySelector('#admin-tbody');
  state.blogs.forEach(blog => tbody.appendChild(buildAdminRow(blog)));
  list.appendChild(table);
}

function buildAdminRow(blog) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="col-title">${escHtml(blog.title)}</td>
    <td class="col-author">${escHtml(blog.author.username)}</td>
    <td class="col-date">${formatDate(blog.created_at)}</td>
    <td>👍 ${blog.likes_count} · 👎 ${blog.dislikes_count}</td>
    <td>
      <div class="col-actions">
        <button class="btn btn-ghost btn-icon" data-action="edit"   data-id="${blog.id}">✏️ Edit</button>
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${blog.id}">🗑 Delete</button>
      </div>
    </td>
  `;
  tr.querySelector('[data-action="edit"]').addEventListener('click',   () => openEditModal(blog));
  tr.querySelector('[data-action="delete"]').addEventListener('click', () => openDeleteModal(blog));
  return tr;
}

/* ═══════════════════════════════════════════════════════════════
   MODAL: CREATE / EDIT
═══════════════════════════════════════════════════════════════ */
function openCreateModal() {
  document.getElementById('modal-title').textContent      = 'New Post';
  document.getElementById('post-submit-btn').textContent  = 'Publish';
  document.getElementById('post-id').value                = '';
  document.getElementById('post-title').value             = '';
  document.getElementById('post-content').value           = '';
  document.getElementById('title-char-count').textContent = '0 / 50';
  clearFormError('post-form-error');
  document.getElementById('post-modal').classList.remove('hidden');
}

function openEditModal(blog) {
  document.getElementById('modal-title').textContent      = 'Edit Post';
  document.getElementById('post-submit-btn').textContent  = 'Save Changes';
  document.getElementById('post-id').value                = blog.id;
  document.getElementById('post-title').value             = blog.title;
  document.getElementById('post-content').value           = blog.content;
  document.getElementById('title-char-count').textContent = `${blog.title.length} / 50`;
  clearFormError('post-form-error');
  document.getElementById('post-modal').classList.remove('hidden');
}

function closePostModal() {
  document.getElementById('post-modal').classList.add('hidden');
}

async function submitPost(e) {
  e.preventDefault();
  clearFormError('post-form-error');

  const id      = document.getElementById('post-id').value;
  const title   = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();

  if (!title)   return showFieldError('post-title', 'post-form-error', 'Title is required.');
  if (!content) return showFieldError('post-content', 'post-form-error', 'Content is required.');

  const btn = document.getElementById('post-submit-btn');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const isEdit = Boolean(id);
  const url    = isEdit ? `${API.blogs}${id}/` : API.blogs;
  const method = isEdit ? 'PATCH' : 'POST';

  const res = await apiFetch(url, { method, body: JSON.stringify({ title, content }) });

  btn.textContent = isEdit ? 'Save Changes' : 'Publish';
  btn.disabled = false;

  if (!res.ok) {
    const msg = extractError(res.data);
    showFormError('post-form-error', msg);
    return;
  }

  closePostModal();
  showToast(isEdit ? 'Post updated.' : 'Post published!', 'success');
  loadAdminBlogs();
}

/* ═══════════════════════════════════════════════════════════════
   MODAL: DELETE
═══════════════════════════════════════════════════════════════ */
function openDeleteModal(blog) {
  state.deleteBlogId = blog.id;
  document.getElementById('delete-blog-title').textContent = blog.title;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  state.deleteBlogId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDelete() {
  if (!state.deleteBlogId) return;

  const btn = document.getElementById('delete-confirm');
  btn.textContent = 'Deleting…';
  btn.disabled = true;

  const res = await apiFetch(`${API.blogs}${state.deleteBlogId}/`, { method: 'DELETE' });

  btn.textContent = 'Delete';
  btn.disabled = false;

  if (!res.ok) { showToast('Could not delete post.', 'error'); return; }

  closeDeleteModal();
  showToast('Post deleted.', 'success');
  loadAdminBlogs();
}

/* ═══════════════════════════════════════════════════════════════
   FORM HELPERS
═══════════════════════════════════════════════════════════════ */
function showFormError(errorId, msg) {
  const el = document.getElementById(errorId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showFieldError(inputId, errorId, msg) {
  document.getElementById(inputId).classList.add('invalid');
  showFormError(errorId, msg);
}

function clearFormError(errorId) {
  const el = document.getElementById(errorId);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

function extractError(data) {
  if (!data) return 'Something went wrong.';
  if (typeof data === 'string') return data;
  const vals = Object.values(data);
  if (vals.length) return Array.isArray(vals[0]) ? vals[0][0] : vals[0];
  return 'Something went wrong.';
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */
function escHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/* ═══════════════════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════════════════ */
function init() {
  // ── Page nav (data-page links) ──────────────────────────────
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-page]');
    if (link) { e.preventDefault(); navigate(link.dataset.page); }
  });

  // ── Logout ──────────────────────────────────────────────────
  document.getElementById('nav-logout-btn').addEventListener('click', logout);

  // ── Login form ──────────────────────────────────────────────
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearFormError('login-error');

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showFormError('login-error', 'Please enter both username and password.');
      return;
    }

    const ok = await login(username, password);
    if (ok) {
      showToast(`Welcome back, ${username}!`, 'success');
      navigate(state.user?.isAdmin ? 'admin' : 'home');
    } else {
      showFormError('login-error', 'Invalid username or password.');
    }
  });

  // ── Toggle password visibility ──────────────────────────────
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // ── Admin: open create modal ────────────────────────────────
  document.getElementById('open-create-modal').addEventListener('click', openCreateModal);

  // ── Post form submit ────────────────────────────────────────
  document.getElementById('post-form').addEventListener('submit', submitPost);

  // ── Title char counter ──────────────────────────────────────
  document.getElementById('post-title').addEventListener('input', function () {
    document.getElementById('title-char-count').textContent = `${this.value.length} / 50`;
  });

  // ── Close post modal ────────────────────────────────────────
  document.getElementById('modal-close').addEventListener('click',  closePostModal);
  document.getElementById('modal-cancel').addEventListener('click', closePostModal);
  document.getElementById('post-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePostModal();
  });

  // ── Delete modal ────────────────────────────────────────────
  document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-cancel').addEventListener('click',      closeDeleteModal);
  document.getElementById('delete-confirm').addEventListener('click',     confirmDelete);
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });

  // ── Reaction buttons ────────────────────────────────────────
  document.getElementById('btn-like').addEventListener('click',    () => react('L'));
  document.getElementById('btn-dislike').addEventListener('click', () => react('D'));

  // ── Keyboard: Escape closes modals ──────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePostModal(); closeDeleteModal(); }
  });

  // ── Boot ────────────────────────────────────────────────────
  checkAuth().then(() => navigate('home'));
}

document.addEventListener('DOMContentLoaded', init);
