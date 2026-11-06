import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.JRLX_AI_PORT || 18770);
const CONFIG = process.env.JRLX_AI_CONFIG || path.join(os.homedir(), '.jrlx_ai.json');
const DEFAULT_ORIGINS = [
  'https://2929916628-hub.github.io',
  'http://localhost:8125',
  'http://127.0.0.1:8125',
  'http://localhost:8130',
  'http://127.0.0.1:8130'
];

function config() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    return {
      vision: raw.vision || {},
      chat: raw.chat || {}
    };
  } catch {
    return { vision: {}, chat: {} };
  }
}

function allowedOrigin(origin) {
  return DEFAULT_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function cors(req) {
  const origin = req.headers.origin || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin) ? origin : DEFAULT_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function send(req, res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...cors(req)
  });
  res.end(body);
}

async function readJSON(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 8 * 1024 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req));
    res.end();
    return;
  }

  if (req.method === 'GET' && ['/', '/status', '/__ai/status'].includes(url.pathname)) {
    const c = config();
    send(req, res, 200, {
      enabled: Boolean(c.vision.api_key || c.chat.api_key),
      vision: Boolean(c.vision.api_key),
      chat: Boolean(c.chat.api_key),
      vision_model: c.vision.model || null,
      chat_model: c.chat.model || null
    });
    return;
  }

  if (req.method === 'POST' && ['/chat', '/__ai/chat'].includes(url.pathname)) {
    let body;
    try {
      body = await readJSON(req);
    } catch (e) {
      send(req, res, e.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
        error: e.message === 'REQUEST_TOO_LARGE' ? '请求内容太大' : '请求不是有效的 JSON'
      });
      return;
    }

    const kind = body.kind === 'vision' ? 'vision' : 'chat';
    const c = config()[kind];
    if (!c.api_key) {
      send(req, res, 503, { error: '服务端还没有配置 DeepSeek 密钥' });
      return;
    }

    const maxTokens = Math.max(32, Math.min(3200, Number(body.max_tokens) || 800));
    const upstreamBody = {
      model: c.model || 'deepseek-flash',
      messages: Array.isArray(body.messages) ? body.messages : [],
      temperature: Math.max(0, Math.min(1.5, Number(body.temperature) || 0.7)),
      max_tokens: maxTokens
    };
    if (body.json && kind === 'chat') upstreamBody.response_format = { type: 'json_object' };

    try {
      const upstream = await fetch(String(c.base_url || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${c.api_key}`
        },
        body: JSON.stringify(upstreamBody),
        signal: AbortSignal.timeout(90000)
      });
      const raw = await upstream.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (!upstream.ok) {
        send(req, res, upstream.status, {
          error: data?.error?.message || `上游返回 ${upstream.status}`
        });
        return;
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        send(req, res, 502, { error: '上游没有返回正文' });
        return;
      }
      send(req, res, 200, { content, usage: data.usage || null, model: upstreamBody.model });
    } catch (e) {
      send(req, res, 502, { error: '上游大模型连接失败' });
    }
    return;
  }

  send(req, res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`JRLX AI backend listening on http://127.0.0.1:${PORT}`);
});
