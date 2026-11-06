# 旧日来信 AI 后端

Cloudflare Worker 代理 DeepSeek，密钥只放在 Worker Secret，不进入 GitHub。

部署后会得到类似 `https://jrlx-ai.<account>.workers.dev` 的地址：

- `GET /status`：检查视觉与对话是否可用
- `POST /chat`：照片理解、数字人回复、聊天记录分析

前端只保存 Worker 地址，不保存 DeepSeek key。
