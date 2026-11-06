const DEFAULT_ORIGINS = [
  'https://2929916628-hub.github.io',
  'http://localhost:8125',
  'http://127.0.0.1:8125',
  'http://localhost:8130',
  'http://127.0.0.1:8130'
];

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const ownOrigin = new URL(request.url).origin;
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return origin === ownOrigin || DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin(request, env) ? origin : 'https://2929916628-hub.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...cors(request, env)
    }
  });
}

function constantTimeEqual(a, b) {
  const x = String(a || ''), y = String(b || '');
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

function adminAuthorized(request, env) {
  const raw = request.headers.get('Authorization') || '';
  if (!raw.startsWith('Basic ')) return false;
  try {
    const decoded = atob(raw.slice(6));
    const cut = decoded.indexOf(':');
    if (cut < 0) return false;
    const user = decoded.slice(0, cut);
    const pass = decoded.slice(cut + 1);
    const expectedUser = env.ADMIN_USERNAME || 'jrlx-admin';
    const expectedPass = String(env.ADMIN_PASSWORD || '');
    if (!expectedPass) return false;
    return constantTimeEqual(user, expectedUser) && constantTimeEqual(pass, expectedPass);
  } catch (e) {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (!allowedOrigin(request, env) && !['GET', 'HEAD'].includes(request.method)) {
      return json({ error: '这个来源不允许调用' }, 403, request, env);
    }

    if (url.pathname === '/admin.html' || url.pathname === '/admin') {
      if (!adminAuthorized(request, env)) {
        return new Response('需要管理员账号密码', {
          status: 401,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'WWW-Authenticate': 'Basic realm="Jiuri Laixin Admin", charset="UTF-8"'
          }
        });
      }
      const asset = await env.ASSETS.fetch(request);
      return new Response(asset.body, {
        status: asset.status,
        headers: {
          ...Object.fromEntries(asset.headers),
          'Cache-Control': 'no-store',
          'Vary': 'Authorization'
        }
      });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/status' || url.pathname === '/__ai/status')) {
      return json({
        enabled: true,
        vision: true,
        chat: true,
        vision_model: env.VISION_MODEL || 'deepseek-flash',
        chat_model: env.CHAT_MODEL || 'deepseek-flash'
      }, 200, request, env);
    }

    if (request.method === 'POST' && (url.pathname === '/chat' || url.pathname === '/__ai/chat')) {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 8 * 1024 * 1024) return json({ error: '请求内容太大' }, 413, request, env);

      let req;
      try {
        req = await request.json();
      } catch (e) {
        return json({ error: '请求不是有效的 JSON' }, 400, request, env);
      }

      const kind = req.kind === 'vision' ? 'vision' : 'chat';
      const key = String(env.DEEPSEEK_API_KEY || '').trim();
      if (!key) return json({ error: '服务端还没有配置 DeepSeek 密钥' }, 503, request, env);

      const base = String(env.DEEPSEEK_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
      const model = String(kind === 'vision'
        ? (env.VISION_MODEL || 'deepseek-flash')
        : (env.CHAT_MODEL || 'deepseek-flash'));
      const messages = Array.isArray(req.messages) ? req.messages : [];
      if (!messages.length) return json({ error: '缺少 messages' }, 400, request, env);

      const body = {
        model,
        messages,
        temperature: Math.max(0, Math.min(1.5, Number(req.temperature) || 0.7)),
        max_tokens: Math.max(32, Math.min(3200, Number(req.max_tokens) || 800))
      };
      if (req.json && kind === 'chat') body.response_format = { type: 'json_object' };

      let upstream;
      try {
        upstream = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90000)
        });
      } catch (e) {
        return json({ error: '上游大模型连接失败' }, 502, request, env);
      }

      const raw = await upstream.text();
      let data;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
      if (!upstream.ok) {
        return json({ error: data?.error?.message || `上游返回 ${upstream.status}` }, upstream.status, request, env);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') return json({ error: '上游没有返回正文' }, 502, request, env);
      return json({ content, usage: data.usage || null, model }, 200, request, env);
    }

    if (['GET', 'HEAD'].includes(request.method) && env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404, request, env);
  }
};
