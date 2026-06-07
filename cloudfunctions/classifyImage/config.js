// AI 识别密钥配置
// 从 https://console.cloud.tencent.com/cam/capi 获取
// 将下面两个值替换为你的 SecretId 和 SecretKey
module.exports = {
  TENCENT_SECRET_ID: process.env.TENCENT_SECRET_ID || 'YOUR_SECRET_ID',
  TENCENT_SECRET_KEY: process.env.TENCENT_SECRET_KEY || 'YOUR_SECRET_KEY'
};
