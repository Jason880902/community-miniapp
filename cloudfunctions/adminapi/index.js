// 管理后台 HTTP API + HTML 页面
// 启用 HTTP 触发后可直接浏览器访问
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ===== 配置 =====
const ADMIN_KEY = 'admin888';   // 登录密码，可改
const ADMIN_OPENIDS = ['o6zAJsxCA3gg2smy-0OOO5GyTsGU'];   // 小程序管理员 OpenID（保留兼容）

// ===== HTML 页面 =====
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>邻里管理后台</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f5;color:#333}
.header{background:linear-gradient(135deg,#1a6eff,#22d3ee);color:#fff;padding:16px 20px;font-size:20px;font-weight:700}
.container{max-width:1000px;margin:0 auto;padding:16px}
.tabs{display:flex;gap:0;margin-bottom:16px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.tab{flex:1;text-align:center;padding:12px 8px;font-size:14px;cursor:pointer;color:#666;transition:.2s;border-bottom:2px solid transparent}
.tab:hover{background:#f0f4ff}
.tab.active{color:#1a6eff;font-weight:600;border-bottom-color:#1a6eff}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.card-num{font-size:28px;font-weight:700;margin-bottom:4px}
.card-label{font-size:13px;color:#999}
.card.blue .card-num{color:#1a6eff}
.card.green .card-num{color:#10b981}
.card.purple .card-num{color:#8b5cf6}
.card.orange .card-num{color:#f59e0b}
.search-bar{margin-bottom:12px}
.search-bar input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px}
table{width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04);border-collapse:collapse}
th{background:#f9fafb;padding:12px 14px;font-size:13px;color:#666;text-align:left;font-weight:600;border-bottom:1px solid #eee}
td{padding:10px 14px;font-size:14px;border-bottom:1px solid #f3f4f6}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500}
.badge.green{background:#ecfdf5;color:#10b981}
.badge.gray{background:#f3f4f6;color:#6b7280}
.badge.red{background:#fef2f2;color:#ef4444}
.badge.yellow{background:#fffbeb;color:#f59e0b}
.btn{display:inline-block;padding:6px 14px;border:none;border-radius:6px;font-size:13px;cursor:pointer;color:#fff;background:#ef4444}
.btn:hover{opacity:.85}
.loading{text-align:center;padding:40px;color:#999}
.error{text-align:center;padding:20px;color:#ef4444}
.empty{text-align:center;padding:40px;color:#999}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:100}
.login-box{background:#fff;border-radius:16px;padding:32px;width:340px;max-width:90%;box-shadow:0 8px 32px rgba(0,0,0,.15)}
.login-box h2{text-align:center;margin-bottom:20px;font-size:18px;color:#333}
.login-box input{width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:14px;box-sizing:border-box}
.login-box button{width:100%;padding:12px;border:none;border-radius:8px;font-size:15px;color:#fff;background:#1a6eff;cursor:pointer}
.login-box button:hover{opacity:.9}
.login-error{color:#ef4444;font-size:13px;text-align:center;margin-bottom:10px}
.dist-bar-wrap{height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;flex:1}
.dist-bar{height:100%;border-radius:4px;transition:width .3s}
</style>
</head>
<body>
<div class="header">📊 邻里管理后台</div>
<div class="container" id="app"></div>
<div class="login-overlay" id="loginOverlay">
<div class="login-box">
<h2>🔐 管理员登录</h2>
<p class="login-error" id="loginError"></p>
<input type="password" id="keyInput" placeholder="请输入管理员密码" onkeydown="if(event.key==='Enter')login()">
<button onclick="login()">登录</button>
</div>
</div>
<script>
const BASE = window.location.origin + window.location.pathname;
let state = { tab: 0, key: '', stats: {}, users: [], items: [], requests: [] };

function $(id) { return document.getElementById(id); }

async function api(action, extra) {
  const params = new URLSearchParams({ action, key: state.key, ...extra });
  const res = await fetch(BASE + '?' + params);
  return res.json();
}

function login() {
  const key = $('keyInput').value.trim();
  if (!key) { $('loginError').textContent = '请输入密码'; return; }
  state.key = key;
  $('loginError').textContent = '';
  $('loginOverlay').style.display = 'none';
  loadTab(0);
}

// ===== Tab 切换 =====
function switchTab(i) { state.tab = i; loadTab(i); }

function loadTab(i) {
  if (i === 0) loadStats();
  else if (i === 1) loadUsers();
  else if (i === 2) loadItems();
  else if (i === 3) loadRequests();
}

// ===== 仪表盘 =====
async function loadStats() {
  const app = $('app');
  app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="loading">加载中...</div>';
  try {
    const { code, data, msg } = await api('getAdminStats');
    if (code !== 0) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">' + msg + '</div>'; return; }
    const s = data;
    const cats = Object.entries(s.catCount || {}).sort((a,b) => b[1]-a[1]);
    app.innerHTML = '<div class="tabs">' + tabHtml() + '</div>' +
      '<div class="card-grid">' +
        '<div class="card blue"><div class="card-num">' + (s.userCount||0) + '</div><div class="card-label">用户总数</div></div>' +
        '<div class="card green"><div class="card-num">' + (s.itemCount||0) + '</div><div class="card-label">物品总数</div></div>' +
        '<div class="card purple"><div class="card-num">' + (s.requestCount||0) + '</div><div class="card-label">申请总数</div></div>' +
        '<div class="card orange"><div class="card-num">' + (s.msgCount||0) + '</div><div class="card-label">消息总数</div></div>' +
      '</div>' +
      '<h3 style="margin-bottom:10px;font-size:15px">物品状态</h3>' +
      '<div style="background:#fff;border-radius:10px;padding:12px 16px;margin-bottom:20px">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:6px 0"><span style="width:60px;font-size:13px;color:#666">可领取</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:' + ((s.itemStatusCount&&s.itemStatusCount.available||0)/Math.max(s.itemCount,1)*100) + '%;background:#1a6eff"></div></div><span style="width:30px;text-align:right;font-size:13px;font-weight:600">' + (s.itemStatusCount?s.itemStatusCount.available||0:0) + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:6px 0"><span style="width:60px;font-size:13px;color:#666">已被领</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:' + ((s.itemStatusCount&&s.itemStatusCount.claimed||0)/Math.max(s.itemCount,1)*100) + '%;background:#10b981"></div></div><span style="width:30px;text-align:right;font-size:13px;font-weight:600">' + (s.itemStatusCount?s.itemStatusCount.claimed||0:0) + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:6px 0"><span style="width:60px;font-size:13px;color:#666">已下架</span><div class="dist-bar-wrap"><div class="dist-bar" style="width:' + ((s.itemStatusCount&&s.itemStatusCount.inactive||0)/Math.max(s.itemCount,1)*100) + '%;background:#9ca3af"></div></div><span style="width:30px;text-align:right;font-size:13px;font-weight:600">' + (s.itemStatusCount?s.itemStatusCount.inactive||0:0) + '</span></div>' +
      '</div>' +
      '<h3 style="margin-bottom:10px;font-size:15px">分类分布</h3>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">' +
        cats.map(c => '<span style="background:#fff;padding:10px 14px;border-radius:8px;border:1px solid #eee;display:inline-flex;justify-content:space-between;gap:12px;font-size:14px"><span>' + c[0] + '</span><span style="color:#1a6eff;font-weight:600">' + c[1] + '件</span></span>').join('') +
      '</div>';
  } catch(e) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">请求失败: ' + e.message + '</div>'; }
}

// ===== 用户管理 =====
let searchUser = '';
async function loadUsers() {
  const app = $('app');
  app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="search-bar"><input placeholder="搜索昵称…" oninput="searchUser=this.value;renderUsers()"></div><div class="loading">加载中...</div>';
  try {
    const { code, data, msg } = await api('adminGetAllUsers');
    if (code !== 0) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">' + msg + '</div>'; return; }
    state.users = data || [];
    renderUsers();
  } catch(e) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">请求失败: ' + e.message + '</div>'; }
}
function renderUsers() {
  const list = state.users.filter(u => !searchUser || (u.name||'').includes(searchUser));
  const app = $('app');
  const header = '<div class="tabs">' + tabHtml() + '</div><div class="search-bar"><input placeholder="搜索昵称…" oninput="searchUser=this.value;renderUsers()" value="' + searchUser + '"></div>';
  if (list.length === 0) { app.innerHTML = header + '<div class="empty">暂无数据</div>'; return; }
  app.innerHTML = header +
    '<table><tr><th>昵称</th><th>小区</th><th>发布数</th><th>申请数</th></tr>' +
    list.map(u => '<tr><td>' + (u.name||'') + '</td><td>' + (u.community||'-') + '</td><td>' + (u.itemCount||0) + '</td><td>' + (u.requestCount||0) + '</td></tr>').join('') +
    '</table>';
}

// ===== 物品管理 =====
let searchItem = '';
async function loadItems() {
  const app = $('app');
  app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="search-bar"><input placeholder="搜索标题…" oninput="searchItem=this.value;renderItems()"></div><div class="loading">加载中...</div>';
  try {
    const { code, data, msg } = await api('adminGetAllItems');
    if (code !== 0) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">' + msg + '</div>'; return; }
    state.items = data || [];
    renderItems();
  } catch(e) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">请求失败: ' + e.message + '</div>'; }
}
function renderItems() {
  const list = state.items.filter(i => !searchItem || (i.title||'').includes(searchItem));
  const app = $('app');
  const header = '<div class="tabs">' + tabHtml() + '</div><div class="search-bar"><input placeholder="搜索标题…" oninput="searchItem=this.value;renderItems()" value="' + searchItem + '"></div>';
  if (list.length === 0) { app.innerHTML = header + '<div class="empty">暂无数据</div>'; return; }
  app.innerHTML = header +
    '<table><tr><th>标题</th><th>分类</th><th>发布人</th><th>状态</th><th>操作</th></tr>' +
    list.map(i => {
      const statusMap = { available: '<span class="badge green">可领取</span>', claimed: '<span class="badge gray">已被领</span>', inactive: '<span class="badge red">已下架</span>' };
      return '<tr><td>' + (i.title||'') + '</td><td>' + (i.category||'') + '</td><td>' + (i.ownerName||'') + '</td><td>' + (statusMap[i.status]||i.status) + '</td><td><button class="btn" onclick="deleteItem(\'' + i.itemId + '\')">删除</button></td></tr>';
    }).join('') +
    '</table>';
}
async function deleteItem(itemId) {
  if (!confirm('确定删除此物品？不可恢复。')) return;
  try {
    const { code } = await api('adminDeleteItem', { itemId });
    if (code !== 0) { alert('删除失败'); return; }
    await loadItems();
  } catch(e) { alert('删除失败: ' + e.message); }
}

// ===== 申请管理 =====
async function loadRequests() {
  const app = $('app');
  app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="loading">加载中...</div>';
  try {
    const { code, data, msg } = await api('adminGetAllRequests');
    if (code !== 0) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">' + msg + '</div>'; return; }
    const list = data || [];
    const statusMap = { pending: '<span class="badge yellow">待处理</span>', approved: '<span class="badge green">已通过</span>', rejected: '<span class="badge red">已拒绝</span>' };
    app.innerHTML = '<div class="tabs">' + tabHtml() + '</div>' +
      (list.length === 0 ? '<div class="empty">暂无数据</div>' :
      '<table><tr><th>物品</th><th>申请人</th><th>状态</th></tr>' +
      list.map(r => '<tr><td>' + (r.itemTitle||'') + '</td><td>' + (r.userName||'') + '</td><td>' + (statusMap[r.status]||r.status) + '</td></tr>').join('') +
      '</table>');
  } catch(e) { app.innerHTML = '<div class="tabs">' + tabHtml() + '</div><div class="error">请求失败: ' + e.message + '</div>'; }
}

function tabHtml() {
  const names = ['📊 仪表盘','👥 用户','📦 物品','📋 申请'];
  return names.map((n,i) => '<div class="tab ' + (state.tab===i?'active':'') + '" onclick="switchTab('+i+')">' + n + '</div>').join('');
}
</script>
</body>
</html>`;

// ===== 主入口 =====
exports.main = async (event) => {
  const params = event.queryStringParameters || {};
  const action = params.action;

  // 无 action → 返回 HTML 页面
  if (!action) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: HTML
    };
  }

  // 有 action → API 调用，校验 key
  if (params.key !== ADMIN_KEY) {
    return JSON.stringify({ code: -1, msg: '密码错误' });
  }

  try {
    const handler = HANDLERS[action];
    if (!handler) return JSON.stringify({ code: -1, msg: '未知操作: ' + action });
    const result = await handler(params);
    return JSON.stringify({ code: 0, data: result });
  } catch (err) {
    return JSON.stringify({ code: -1, msg: err.message });
  }
};

// ===== 处理函数 =====
const HANDLERS = {
  async getAdminStats() {
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const { total: msgCount } = await db.collection('messages').count();
    const itemStatusCount = {};
    const catCount = {};
    items.forEach(i => {
      itemStatusCount[i.status] = (itemStatusCount[i.status] || 0) + 1;
      catCount[i.category] = (catCount[i.category] || 0) + 1;
    });
    const requestStatusCount = {};
    requests.forEach(r => { requestStatusCount[r.status] = (requestStatusCount[r.status] || 0) + 1; });
    return { userCount: users.length, itemCount: items.length, requestCount: requests.length, msgCount, itemStatusCount, catCount, requestStatusCount };
  },

  async adminGetAllUsers() {
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const itemCount = {}; const requestCount = {};
    items.forEach(i => { itemCount[i.userId] = (itemCount[i.userId] || 0) + 1; });
    requests.forEach(r => { requestCount[r.userId] = (requestCount[r.userId] || 0) + 1; });
    return users.map(u => ({ ...u, itemCount: itemCount[u.userId] || 0, requestCount: requestCount[u.userId] || 0 }));
  },

  async adminGetAllItems() {
    const { data: items } = await db.collection('items').orderBy('createTime', 'desc').get();
    const { data: users } = await db.collection('users').get();
    const { data: requests } = await db.collection('requests').get();
    const userMap = {}; users.forEach(u => { userMap[u.userId] = u; });
    const reqCount = {}; requests.forEach(r => { reqCount[r.itemId] = (reqCount[r.itemId] || 0) + 1; });
    return items.map(i => ({ ...i, ownerName: userMap[i.userId] ? userMap[i.userId].name : '未知', requestCount: reqCount[i.itemId] || 0 }));
  },

  async adminGetAllRequests() {
    const { data: requests } = await db.collection('requests').orderBy('createTime', 'desc').get();
    const { data: items } = await db.collection('items').get();
    const { data: users } = await db.collection('users').get();
    const itemMap = {}; items.forEach(i => { itemMap[i.itemId] = i; });
    const userMap = {}; users.forEach(u => { userMap[u.userId] = u; });
    return requests.map(r => ({ ...r, itemTitle: itemMap[r.itemId] ? itemMap[r.itemId].title : '物品已删除', userName: userMap[r.userId] ? userMap[r.userId].name : '未知' }));
  },

  async adminDeleteItem({ itemId }) {
    const { data } = await db.collection('items').where({ itemId }).limit(1).get();
    if (data.length === 0) return { success: false };
    await db.collection('items').doc(data[0]._id).remove();
    return { success: true };
  }
};
