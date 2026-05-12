const icons = require('./icons');

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  const min = 60000, hour = 3600000, day = 86400000;

  if (diff < min) return '刚刚';
  if (diff < hour) return Math.floor(diff / min) + '分钟前';
  if (diff < day) return Math.floor(diff / hour) + '小时前';
  if (diff < 7 * day) return Math.floor(diff / day) + '天前';

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const nowY = new Date(now).getFullYear();
  return (y === nowY ? '' : y + '/') + m + '/' + dd;
}

function getCategoryColor(category) {
  return icons.CATEGORY_COLORS[category] || icons.CATEGORY_COLORS['其他'];
}

module.exports = { formatTime, getCategoryColor };
