/* 线上大模型接口。DeepSeek 密钥只保存在 Cloudflare Worker Secret。 */
window.JRLX_AI_BASE = /\.pages\.dev$/i.test(location.hostname)
  ? location.origin
  : 'https://jrlx-demo.pages.dev';
