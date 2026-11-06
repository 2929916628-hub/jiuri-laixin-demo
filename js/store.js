/* 旧日来信 · 空间存档
   本地预览时写到 _serve.py 的 /__data；部署到 GitHub Pages 等静态托管时，
   自动改用浏览器 IndexedDB。两条路对界面暴露同一组方法，刷新后都能恢复。 */
window.JRLXStore = (() => {
  'use strict';

  const http = location.protocol.startsWith('http');
  const localPreview = http && location.port === '8125';
  const staticMode = http && !localPreview;

  /* ---------------- 本地预览：服务端存档 ---------------- */
  async function req(url, opt) {
    const r = await fetch(url, { cache: 'no-store', ...opt });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));
    return d;
  }

  const server = {
    upload: file => req('/__data/files', {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'file')
      }
    }),
    list: () => req('/__data/spaces'),
    save: space => req('/__data/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(space)
    }),
    update: (id, space) => req(`/__data/spaces/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(space)
    }),
    act: (id, what) => req(`/__data/spaces/${id}/${what}`, { method: 'POST' })
  };

  /* ---------------- 静态托管：IndexedDB 存档 ---------------- */
  const DB_NAME = 'jrlx-static-v1';
  const DB_VERSION = 1;
  const urlCache = new Map();
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('spaces')) d.createObjectStore('spaces', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error('浏览器本地存储打不开'));
      });
    }
    return dbPromise;
  }

  function tx(name, mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
      const t = d.transaction(name, mode);
      const store = t.objectStore(name);
      let result;
      try { result = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
      t.onerror = () => reject(t.error || new Error('本地存档失败'));
      t.onabort = () => reject(t.error || new Error('本地存档已取消'));
    }));
  }

  const request = reqObj => ({ __req: reqObj });
  const all = store => request(store.getAll());
  const get = (store, id) => request(store.get(id));
  const put = (store, value) => request(store.put(value));
  const del = (store, id) => request(store.delete(id));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  async function fileRecord(id) {
    return tx('files', 'readonly', s => get(s, id));
  }

  function cleanMedia(m) {
    if (!m || typeof m !== 'object') return m;
    const { url, ...rest } = m;
    return rest;
  }

  async function hydrateMedia(items) {
    const out = [];
    for (const item of items || []) {
      if (!item || !item.id) { out.push(item); continue; }
      let url = urlCache.get(item.id);
      if (!url) {
        const rec = await fileRecord(item.id);
        if (rec && rec.blob) {
          url = URL.createObjectURL(rec.blob);
          urlCache.set(item.id, url);
        }
      }
      out.push({ ...item, url: url || item.url || '' });
    }
    return out;
  }

  async function hydrateSpace(space) {
    return { ...space, media: await hydrateMedia(space.media) };
  }

  const local = {
    upload: async file => {
      const id = uid();
      await tx('files', 'readwrite', s => put(s, {
        id,
        blob: file,
        type: file.type || 'application/octet-stream',
        name: file.name || 'file',
        size: file.size || 0,
        lastModified: file.lastModified || Date.now()
      }));
      const url = URL.createObjectURL(file);
      urlCache.set(id, url);
      return { id, url, type: file.type || 'application/octet-stream', name: file.name || 'file', size: file.size || 0, lastModified: file.lastModified || Date.now() };
    },

    list: async () => {
      const rows = await tx('spaces', 'readonly', s => all(s));
      const spaces = await Promise.all((rows || []).map(hydrateSpace));
      return { spaces, folder: '此浏览器的本地存储' };
    },

    save: async space => {
      const now = Date.now() / 1000;
      const id = space.id || uid();
      const saved = {
        ...space,
        id,
        createdAt: space.createdAt || now,
        deleted: false,
        deletedAt: null,
        media: (space.media || []).map(cleanMedia)
      };
      await tx('spaces', 'readwrite', s => put(s, saved));
      return { ok: true, id };
    },

    update: async (id, space) => {
      const old = await tx('spaces', 'readonly', s => get(s, id));
      if (!old) throw new Error('这个空间已不存在');
      const saved = {
        ...old,
        ...space,
        id,
        createdAt: old.createdAt,
        deleted: old.deleted || false,
        deletedAt: old.deletedAt || null,
        media: (space.media || []).map(cleanMedia)
      };
      await tx('spaces', 'readwrite', s => put(s, saved));
      return { ok: true, id };
    },

    act: async (id, what) => {
      const old = await tx('spaces', 'readonly', s => get(s, id));
      if (!old) throw new Error('这个空间已不存在');
      if (what === 'trash' || what === 'restore') {
        await tx('spaces', 'readwrite', s => put(s, {
          ...old,
          deleted: what === 'trash',
          deletedAt: what === 'trash' ? Date.now() / 1000 : null
        }));
        return { ok: true };
      }
      if (what !== 'purge') throw new Error('未知操作');
      const ids = (old.media || []).map(m => m.id).filter(Boolean);
      await tx('files', 'readwrite', s => {
        for (const fileId of ids) del(s, fileId);
      });
      await tx('spaces', 'readwrite', s => del(s, id));
      for (const fileId of ids) {
        const u = urlCache.get(fileId);
        if (u) URL.revokeObjectURL(u);
        urlCache.delete(fileId);
      }
      return { ok: true };
    }
  };

  const impl = staticMode ? local : server;
  return { ok: http, static: staticMode, ...impl };
})();
