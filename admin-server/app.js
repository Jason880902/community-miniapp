#!/usr/bin/env node
/**
 * 邻里管理后台 — 单文件版
 * 直连云数据库，无需云函数
 *
 * 使用:
 *   export TCB_SECRET_ID=xxx
 *   export TCB_SECRET_KEY=xxx
 *   npm install express @cloudbase/node-sdk
 *   node app.js
 *
 * 或完整命令:
 *   TCB_SECRET_ID=xxx TCB_SECRET_KEY=xxx ADMIN_PASSWORD=admin888 PORT=3000 node app.js
 */

// ===== 配置（环境变量） =====
const ENV_ID = process.env.TCB_ENV_ID || 'cloud1-d6ghwnr2odbc94c82';
const SECRET_ID = process.env.TCB_SECRET_ID;
const SECRET_KEY = process.env.TCB_SECRET_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin888';
const PORT = parseInt(process.env.PORT || '3000');

if (!SECRET_ID || !SECRET_KEY) {
  console.error('❌ 请设置环境变量 TCB_SECRET_ID 和 TCB_SECRET_KEY');
  console.error('   从腾讯云控制台 → 访问管理 → API密钥管理 获取');
  process.exit(1);
}

const express = require('express');
const cloudbase = require('@cloudbase/node-sdk');

// ===== 云数据库 =====
const tcb = cloudbase.init({ env: ENV_ID, secretId: SECRET_ID, secretKey: SECRET_KEY });
const db = tcb.database();
const _ = db.command;

// ===== Express =====
const app = express();
app.use(express.json());

// ===== 鉴权 =====
function auth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) return next();
  res.json({ code: -1, msg: '未登录或密码错误' });
}

// ===== API =====
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ code: 0, data: { token: ADMIN_PASSWORD } });
  } else {
    res.json({ code: -1, msg: '密码错误' });
  }
});

app.get('/api/stats', auth, async (req, res) => {
  try {
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const { total: msgCount } = await db.collection('messages').count();
    const itemStatus = {}; const catCount = {}; const reqStatus = {};
    items.forEach(i => { itemStatus[i.status] = (itemStatus[i.status] || 0) + 1; catCount[i.category] = (catCount[i.category] || 0) + 1; });
    requests.forEach(r => { reqStatus[r.status] = (reqStatus[r.status] || 0) + 1; });
    res.json({ code: 0, data: { userCount: users.length, itemCount: items.length, requestCount: requests.length, msgCount, itemStatusCount: itemStatus, catCount, requestStatusCount: reqStatus } });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.get('/api/users', auth, async (req, res) => {
  try {
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const itemC = {}; const reqC = {};
    items.forEach(i => { itemC[i.userId] = (itemC[i.userId] || 0) + 1; });
    requests.forEach(r => { reqC[r.userId] = (reqC[r.userId] || 0) + 1; });
    res.json({ code: 0, data: users.map(u => ({ ...u, itemCount: itemC[u.userId] || 0, requestCount: reqC[u.userId] || 0 })) });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.get('/api/items', auth, async (req, res) => {
  try {
    const { data: items } = await db.collection('items').orderBy('createTime', 'desc').get();
    const { data: users } = await db.collection('users').get();
    const { data: requests } = await db.collection('requests').get();
    const uMap = {}; users.forEach(u => { uMap[u.userId] = u; });
    const rCount = {}; requests.forEach(r => { rCount[r.itemId] = (rCount[r.itemId] || 0) + 1; });
    res.json({ code: 0, data: items.map(i => ({ ...i, ownerName: uMap[i.userId] ? uMap[i.userId].name : '未知', requestCount: rCount[i.itemId] || 0 })) });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.delete('/api/items/:itemId', auth, async (req, res) => {
  try {
    const { data } = await db.collection('items').where({ itemId: req.params.itemId }).limit(1).get();
    if (data.length === 0) return res.json({ code: -1, msg: '物品不存在' });
    await db.collection('items').doc(data[0]._id).remove();
    res.json({ code: 0, data: { success: true } });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.get('/api/requests', auth, async (req, res) => {
  try {
    const { data: requests } = await db.collection('requests').orderBy('createTime', 'desc').get();
    const { data: items } = await db.collection('items').get();
    const { data: users } = await db.collection('users').get();
    const iMap = {}; items.forEach(i => { iMap[i.itemId] = i; });
    const uMap = {}; users.forEach(u => { uMap[u.userId] = u; });
    res.json({ code: 0, data: requests.map(r => ({ ...r, itemTitle: iMap[r.itemId] ? iMap[r.itemId].title : '物品已删除', userName: uMap[r.userId] ? uMap[r.userId].name : '未知' })) });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

// ===== HTML 管理页面 =====
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>邻里管理后台</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2f5;color:#1f2937}
.header{background:linear-gradient(135deg,#1a6eff,#22d3ee);color:#fff;padding:18px 24px;font-size:20px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
.header .logout{font-size:13px;color:rgba(255,255,255,.8);cursor:pointer;padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.3)}
.header .logout:hover{background:rgba(255,255,255,.1)}
.container{max-width:1100px;margin:0 auto;padding:20px}
.tabs{display:flex;gap:0;margin-bottom:20px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.tab{flex:1;text-align:center;padding:14px 8px;font-size:14px;cursor:pointer;color:#6b7280;transition:all .2s;border-bottom:2px solid transparent;user-select:none}
.tab:hover{background:#f0f4ff;color:#1a6eff}
.tab.active{color:#1a6eff;font-weight:600;border-bottom-color:#1a6eff}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.card-num{font-size:32px;font-weight:700;margin-bottom:4px}
.card-label{font-size:13px;color:#9ca3af}
.card.blue .card-num{color:#1a6eff}
.card.green .card-num{color:#10b981}
.card.purple .card-num{color:#8b5cf6}
.card.orange .card-num{color:#f59e0b}
.section-title{font-size:15px;font-weight:600;margin-bottom:12px;color:#1f2937}
.dist-list{background:#fff;border-radius:12px;padding:12px 16px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.dist-item{display:flex;align-items:center;gap:10px;padding:8px 0}
.dist-label{width:60px;font-size:13px;color:#6b7280;flex-shrink:0}
.dist-bar-wrap{flex:1;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden}
.dist-bar{height:100%;border-radius:4px;transition:width .4s ease}
.dist-num{width:30px;text-align:right;font-size:13px;font-weight:600;color:#1f2937}
.dist-bar.blue{background:#1a6eff}.dist-bar.green{background:#10b981}.dist-bar.gray{background:#9ca3af}
.cat-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.cat-chip{background:#fff;padding:10px 16px;border-radius:10px;border:1px solid #f3f4f6;display:flex;justify-content:space-between;gap:16px;font-size:14px;min-width:calc(50% - 4px)}
.cat-chip-name{color:#1f2937}.cat-chip-num{color:#1a6eff;font-weight:600}
.search-bar{margin-bottom:14px}
.search-bar input{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;background:#fff}
.search-bar input:focus{border-color:#1a6eff;outline:none}
table{width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);border-collapse:collapse}
th{background:#f9fafb;padding:12px 14px;font-size:13px;color:#6b7280;text-align:left;font-weight:600;border-bottom:1px solid #f3f4f6}
td{padding:10px 14px;font-size:14px;border-bottom:1px solid #f9fafb}
tr:hover td{background:#fafbff}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500}
.badge.green{background:#ecfdf5;color:#059669}
.badge.gray{background:#f3f4f6;color:#6b7280}
.badge.red{background:#fef2f2;color:#dc2626}
.badge.yellow{background:#fffbeb;color:#d97706}
.btn{padding:6px 14px;border:none;border-radius:6px;font-size:13px;cursor:pointer;color:#fff;background:#ef4444;transition:opacity .2s}
.btn:hover{opacity:.85}
.loading{text-align:center;padding:60px 20px;color:#9ca3af;font-size:14px}
.empty{text-align:center;padding:60px 20px;color:#9ca3af;font-size:14px}
.login-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
.login-box{background:#fff;border-radius:16px;padding:36px;width:360px;max-width:90vw;box-shadow:0 16px 48px rgba(0,0,0,.15)}
.login-box h2{text-align:center;margin-bottom:8px;font-size:20px}
.login-box .sub{text-align:center;color:#9ca3af;font-size:13px;margin-bottom:24px}
.login-box input{width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;margin-bottom:16px;box-sizing:border-box}
.login-box input:focus{border-color:#1a6eff;outline:none}
.login-box button{width:100%;padding:12px;border:none;border-radius:8px;font-size:15px;font-weight:500;color:#fff;background:#1a6eff;cursor:pointer;transition:opacity .2s}
.login-box button:hover{opacity:.9}
.login-error{color:#dc2626;font-size:13px;text-align:center;margin-bottom:12px;min-height:20px}
</style>
</head>
<body>
<div class="header"><span>📊 邻里管理后台</span><span class="logout" id="logoutBtn" style="display:none" onclick="logout()">退出登录</span></div>
<div class="container" id="app"><div class="loading">加载中...</div></div>
<div class="login-overlay" id="loginOverlay"><div class="login-box"><h2>🔐 管理员登录</h2><p class="sub">邻里社区旧物分享管理后台</p><p class="login-error" id="loginError"></p><input type="password" id="keyInput" placeholder="请输入管理密码" autofocus onkeydown="if(event.key==='Enter')login()"><button onclick="login()">登录</button></div></div>
<script>
const API = ''; let state={tab:0,token:'',users:[],items:[],requests:[]};
function $(id){return document.getElementById(id)}
async function req(method,path,body){const opts={method,headers:{'Content-Type':'application/json'}};if(state.token)opts.headers['x-admin-token']=state.token;if(body)opts.body=JSON.stringify(body);const res=await fetch(API+path,opts);return res.json()}
function login(){const key=$('keyInput').value.trim();if(!key){$('loginError').textContent='请输入密码';return}$('loginError').textContent='';req('POST','/api/login',{password:key}).then(r=>{if(r.code!==0){$('loginError').textContent=r.msg;return}state.token=key;localStorage.setItem('admin_token',key);$('loginOverlay').style.display='none';$('logoutBtn').style.display='block';switchTab(state.tab)}).catch(e=>{$('loginError').textContent='请求失败: '+e.message})}
function logout(){state.token='';localStorage.removeItem('admin_token');$('loginOverlay').style.display='flex';$('logoutBtn').style.display='none';$('keyInput').value='';$('keyInput').focus()}
function switchTab(i){state.tab=i;document.querySelectorAll('.tab').forEach((el,idx)=>el.className='tab'+(idx===i?' active':''));if(i===0)loadStats();else if(i===1)loadUsers();else if(i===2)loadItems();else if(i===3)loadRequests()}
function tabs(){return['📊 仪表盘','👥 用户管理','📦 物品管理','📋 申请管理'].map((n,i)=>'<div class="tab'+(state.tab===i?' active':'')+'" onclick="switchTab('+i+')">'+n+'</div>').join('')}
async function loadStats(){const app=$('app');app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="loading">加载中...</div>';try{const{code,data,msg}=await req('GET','/api/stats');if(code!==0){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">'+msg+'</div>';return}const s=data;const cats=Object.entries(s.catCount||{}).sort((a,b)=>b[1]-a[1]);app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="card-grid"><div class="card blue"><div class="card-num">'+(s.userCount||0)+'</div><div class="card-label">👤 用户总数</div></div><div class="card green"><div class="card-num">'+(s.itemCount||0)+'</div><div class="card-label">📦 物品总数</div></div><div class="card purple"><div class="card-num">'+(s.requestCount||0)+'</div><div class="card-label">📋 申请总数</div></div><div class="card orange"><div class="card-num">'+(s.msgCount||0)+'</div><div class="card-label">💬 消息总数</div></div></div><div class="section-title">物品状态分布</div><div class="dist-list">'+['available|可领取|blue','claimed|已被领|green','inactive|已下架|gray'].map(k=>{const[st,lb,cl]=k.split('|');const n=(s.itemStatusCount||{})[st]||0;return'<div class="dist-item"><span class="dist-label">'+lb+'</span><div class="dist-bar-wrap"><div class="dist-bar '+cl+'" style="width:'+(n/Math.max(s.itemCount,1)*100)+'%"></div></div><span class="dist-num">'+n+'</span></div>'}).join('')+'</div><div class="section-title">分类分布</div><div class="cat-grid">'+cats.map(c=>'<div class="cat-chip"><span class="cat-chip-name">'+c[0]+'</span><span class="cat-chip-num">'+c[1]+'件</span></div>').join('')+'</div>'}catch(e){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">请求失败: '+e.message+'</div>'}}
let searchUser='';async function loadUsers(){const app=$('app');app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="search-bar"><input placeholder="搜索昵称…" oninput="searchUser=this.value;renderUsers()"></div><div class="loading">加载中...</div>';try{const{code,data,msg}=await req('GET','/api/users');if(code!==0){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">'+msg+'</div>';return}state.users=data||[];renderUsers()}catch(e){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">请求失败: '+e.message+'</div>'}}
function renderUsers(){const list=state.users.filter(u=>!searchUser||(u.name||'').toLowerCase().includes(searchUser.toLowerCase()));const app=$('app');const h='<div class="tabs">'+tabs()+'</div><div class="search-bar"><input placeholder="搜索昵称…" oninput="searchUser=this.value;renderUsers()" value="'+searchUser+'"></div>';if(list.length===0){app.innerHTML=h+'<div class="empty">暂无数据</div>';return}app.innerHTML=h+'<table><tr><th>昵称</th><th>小区</th><th>发布物品</th><th>申请次数</th></tr>'+list.map(u=>'<tr><td><strong>'+(u.name||'')+'</strong></td><td>'+(u.community||'-')+'</td><td>'+(u.itemCount||0)+'</td><td>'+(u.requestCount||0)+'</td></tr>').join('')+'</table>'}
let searchItem='';async function loadItems(){const app=$('app');app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="search-bar"><input placeholder="搜索标题…" oninput="searchItem=this.value;renderItems()"></div><div class="loading">加载中...</div>';try{const{code,data,msg}=await req('GET','/api/items');if(code!==0){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">'+msg+'</div>';return}state.items=data||[];renderItems()}catch(e){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">请求失败: '+e.message+'</div>'}}
const SMAP={available:'<span class="badge green">可领取</span>',claimed:'<span class="badge gray">已被领</span>',inactive:'<span class="badge red">已下架</span>'};function renderItems(){const list=state.items.filter(i=>!searchItem||(i.title||'').toLowerCase().includes(searchItem.toLowerCase()));const app=$('app');const h='<div class="tabs">'+tabs()+'</div><div class="search-bar"><input placeholder="搜索标题…" oninput="searchItem=this.value;renderItems()" value="'+searchItem+'"></div>';if(list.length===0){app.innerHTML=h+'<div class="empty">暂无数据</div>';return}app.innerHTML=h+'<table><tr><th>标题</th><th>分类</th><th>发布人</th><th>状态</th><th>申请数</th><th>操作</th></tr>'+list.map(i=>'<tr><td><strong>'+(i.title||'')+'</strong></td><td>'+(i.category||'')+'</td><td>'+(i.ownerName||'')+'</td><td>'+(SMAP[i.status]||i.status)+'</td><td>'+(i.requestCount||0)+'</td><td><button class="btn" onclick="delItem(\\''+i.itemId+'\\')">删除</button></td></tr>').join('')+'</table>'}
async function delItem(id){if(!confirm('确定删除？不可恢复。'))return;const{code,msg}=await req('DELETE','/api/items/'+id);if(code!==0){alert(msg);return}loadItems()}
async function loadRequests(){const app=$('app');app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="loading">加载中...</div>';try{const{code,data,msg}=await req('GET','/api/requests');if(code!==0){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">'+msg+'</div>';return}const list=data||[];const RMAP={pending:'<span class="badge yellow">待处理</span>',approved:'<span class="badge green">已通过</span>',rejected:'<span class="badge red">已拒绝</span>'};app.innerHTML='<div class="tabs">'+tabs()+'</div>'+(list.length===0?'<div class="empty">暂无数据</div>':'<table><tr><th>物品名称</th><th>申请人</th><th>状态</th></tr>'+list.map(r=>'<tr><td>'+(r.itemTitle||'')+'</td><td>'+(r.userName||'')+'</td><td>'+(RMAP[r.status]||r.status)+'</td></tr>').join('')+'</table>')}catch(e){app.innerHTML='<div class="tabs">'+tabs()+'</div><div class="error">请求失败: '+e.message+'</div>'}}
const savedToken=localStorage.getItem('admin_token');if(savedToken){state.token=savedToken;$('loginOverlay').style.display='none';$('logoutBtn').style.display='block';switchTab(0)}else{$('app').innerHTML=''}
</script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ 邻里管理后台已启动`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   密码: ${ADMIN_PASSWORD}\n`);
});
