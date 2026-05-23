// 数据库操作层 — 通过 db 云函数统一读写云端
// 所有函数均为 async, 直接 throw 错误, 由调用方处理

const CATEGORIES = ['家具家居', '电子产品', '书籍文具', '服饰鞋包', '母婴儿童', '运动户外', '厨房用具', '日用百货', '植物花卉', '其他'];
const CONDITIONS = ['全新', '几乎全新', '九成新', '八成新', '七成新', '有瑕疵'];

async function call(action, params = {}) {
  const res = await wx.cloud.callFunction({ name: 'db', data: { action, params } });
  if (res.result.code !== 0) throw new Error(res.result.msg);
  return res.result.data;
}

// ===== 用户 =====
async function getCurrentUser(userId) {
  return call('getCurrentUser', { userId });
}

async function setCurrentUser(userId) {
  // 在当前会话缓存 userId
  return userId;
}

async function getOrCreateUser(userId, name, community, avatarUrl) {
  return call('getOrCreateUser', { userId, name, community, avatarUrl });
}

async function getUserById(id) {
  return call('getUserById', { id });
}

async function updateUserName(userId, newName) {
  return call('updateUserName', { userId, newName });
}

async function getAllUsers() {
  return call('getAllUsers');
}

// ===== 物品 =====
async function getAllItems() {
  return call('getAllItems');
}

async function getAvailableItems(category, community) {
  return call('getAvailableItems', { category: category || 'all', community: community || '' });
}

async function getItemById(id) {
  return call('getItemById', { id });
}

async function getItemsByUser(userId) {
  return call('getItemsByUser', { userId });
}

async function addItem(item) {
  return call('addItem', { item });
}

async function updateItem(itemId, updates) {
  return call('updateItem', { itemId, updates });
}

async function updateItemStatus(itemId, status) {
  return call('updateItemStatus', { itemId, status });
}

async function deleteItem(itemId) {
  return call('deleteItem', { itemId });
}

async function getItemStats(userId) {
  return call('getItemStats', { userId });
}

// ===== 消息 =====
async function sendMessage(fromId, toId, itemId, content, type, extra) {
  return call('sendMessage', { fromId, toId, itemId, content, type: type || 'text', extra: extra || {} });
}

async function getConversations(userId) {
  return call('getConversations', { userId });
}

async function getMessages(userId1, userId2) {
  return call('getMessages', { userId1, userId2 });
}

async function markRead(currentUserId, otherUserId) {
  return call('markRead', { currentUserId, otherUserId });
}

async function countUnread(userId) {
  return call('countUnread', { userId });
}

// ===== 申请 =====
async function addRequest(itemId, userId) {
  return call('addRequest', { itemId, userId });
}

async function getPendingRequestsForItem(itemId) {
  return call('getPendingRequestsForItem', { itemId });
}

async function getRequestsForItem(itemId) {
  return call('getRequestsForItem', { itemId });
}

async function updateRequestStatus(requestId, newStatus) {
  return call('updateRequestStatus', { requestId, newStatus });
}

async function getUserRequests(userId) {
  return call('getUserRequests', { userId });
}

// ===== 管理员 =====
async function getAdminStats() {
  return call('getAdminStats');
}

async function adminGetAllUsers() {
  return call('adminGetAllUsers');
}

async function adminGetAllItems() {
  return call('adminGetAllItems');
}

async function adminGetAllRequests() {
  return call('adminGetAllRequests');
}

async function adminDeleteItem(itemId) {
  return call('adminDeleteItem', { itemId });
}

module.exports = {
  CATEGORIES, CONDITIONS,
  getCurrentUser, setCurrentUser, getOrCreateUser,
  getAllItems, getAvailableItems, getItemById,
  getUserById, updateUserName, getAllUsers, getItemsByUser, addItem, updateItem, updateItemStatus, deleteItem, getItemStats,
  sendMessage, getConversations, getMessages, markRead, countUnread,
  addRequest, getPendingRequestsForItem, updateRequestStatus, getRequestsForItem, getUserRequests,
  getAdminStats, adminGetAllUsers, adminGetAllItems, adminGetAllRequests, adminDeleteItem,

  // 兼容旧版同步调用: 已变更为 async
};
