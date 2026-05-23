/**
 * 邻里管理后台 — Node.js 服务端
 * 直连云数据库，无需云函数
 *
 * 使用方式：
 * 1. npm install express @cloudbase/node-sdk
 * 2. 在云开发控制台 -> 设置 -> 密钥 获取 SecretId 和 SecretKey
 * 3. 修改下方 ENV_ID / SECRET_ID / SECRET_KEY
 * 4. node server.js
 * 5. 浏览器打开 http://服务器IP:3000
 */

const express = require('express');
const path = require('path');
const cloudbase = require('@cloudbase/node-sdk');

// ===== 配置 =====
const ENV_ID = 'cloud1-d6ghwnr2odbc94c82';
const SECRET_ID = '请替换为你的SecretId';
const SECRET_KEY = '请替换为你的SecretKey';
const ADMIN_PASSWORD = 'admin888';   // 登录密码
const PORT = 3000;                   // 监听端口

// ===== 云数据库初始化 =====
const appCloud = cloudbase.init({
  env: ENV_ID,
  secretId: SECRET_ID,
  secretKey: SECRET_KEY
});
const db = appCloud.database();
const _ = db.command;

// ===== Express =====
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== 鉴权中间件 =====
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
    const itemStatusCount = {};
    const catCount = {};
    items.forEach(i => {
      itemStatusCount[i.status] = (itemStatusCount[i.status] || 0) + 1;
      catCount[i.category] = (catCount[i.category] || 0) + 1;
    });
    const requestStatusCount = {};
    requests.forEach(r => { requestStatusCount[r.status] = (requestStatusCount[r.status] || 0) + 1; });
    res.json({ code: 0, data: { userCount: users.length, itemCount: items.length, requestCount: requests.length, msgCount, itemStatusCount, catCount, requestStatusCount } });
  } catch (e) {
    res.json({ code: -1, msg: e.message });
  }
});

app.get('/api/users', auth, async (req, res) => {
  try {
    const { data: users } = await db.collection('users').get();
    const { data: items } = await db.collection('items').get();
    const { data: requests } = await db.collection('requests').get();
    const itemCount = {}; const requestCount = {};
    items.forEach(i => { itemCount[i.userId] = (itemCount[i.userId] || 0) + 1; });
    requests.forEach(r => { requestCount[r.userId] = (requestCount[r.userId] || 0) + 1; });
    res.json({ code: 0, data: users.map(u => ({ ...u, itemCount: itemCount[u.userId] || 0, requestCount: requestCount[u.userId] || 0 })) });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.get('/api/items', auth, async (req, res) => {
  try {
    const { data: items } = await db.collection('items').orderBy('createTime', 'desc').get();
    const { data: users } = await db.collection('users').get();
    const { data: requests } = await db.collection('requests').get();
    const userMap = {}; users.forEach(u => { userMap[u.userId] = u; });
    const reqCount = {}; requests.forEach(r => { reqCount[r.itemId] = (reqCount[r.itemId] || 0) + 1; });
    res.json({ code: 0, data: items.map(i => ({ ...i, ownerName: userMap[i.userId] ? userMap[i.userId].name : '未知', requestCount: reqCount[i.itemId] || 0 })) });
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
    const itemMap = {}; items.forEach(i => { itemMap[i.itemId] = i; });
    const userMap = {}; users.forEach(u => { userMap[u.userId] = u; });
    res.json({ code: 0, data: requests.map(r => ({ ...r, itemTitle: itemMap[r.itemId] ? itemMap[r.itemId].title : '物品已删除', userName: userMap[r.userId] ? userMap[r.userId].name : '未知' })) });
  } catch (e) { res.json({ code: -1, msg: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 管理后台已启动: http://localhost:${PORT}`);
  console.log(`⚠️  外网访问请确保防火墙放行 ${PORT} 端口`);
});
