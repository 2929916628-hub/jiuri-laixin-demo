"""旧日来信 · Demo 本地服务（由 启动预览.cmd 调用）
和 python -m http.server 一样，只多几件事：
1. 每个响应都带 Cache-Control: no-store —— 改完文件刷新即生效，浏览器不会拿旧脚本；
2. 显式指定 .js / .mjs / .svg 等类型 —— Windows 上 Python 有时把 .js 认成 text/plain，导致模块脚本被拒。
3. /__lan 返回本机局域网地址，Demo 左侧说明栏用它生成手机扫码的二维码。
4. /__ai/status、/__ai/chat 把数字分身的请求转给大模型（OpenAI 兼容接口）。
   API Key 只放在本机的 ~/.jrlx_ai.json（用 配置AI.cmd 写入），不在网页里、不进开发包。
5. /__data/* 保存用户在 Demo 里建的空间：上传的照片 / 视频 / 录屏、新信封、数字分身人设。
   存在 根目录/_demo_data（在 Demo 文件夹外，不会被打包；也不能直接按网址访问，只能走接口）。
   删除先进回收站，在 admin.html 后台可以恢复或彻底删除。
6. 公网扫码：另开一个只给穿透用的端口（端口+1，只监听 127.0.0.1），自动启动 _tools 里的 cpolar（配过 authtoken 时）
   或 cloudflared 临时链接，手机不用连电脑热点、用流量也能扫。公网访问要带口令（二维码里自带，进来一次后记在 cookie），
   只开放 Demo 文件夹和 Demo 用到的接口，后台 admin.html、回收站/删除接口不对外。设环境变量 JRLX_NO_TUNNEL=1 可关掉。
用法：python _serve.py 端口 根目录
"""
import os
import sys
import json
import socket
import time
import subprocess
import re
import uuid
import threading
import functools
import secrets
import atexit
from http import cookies
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8125
ROOT = sys.argv[2] if len(sys.argv) > 2 else "."
AI_CONFIG = Path(os.environ.get("JRLX_AI_CONFIG") or Path.home() / ".jrlx_ai.json")
# 配置文件里 vision（读录屏）/ chat（总结人设、回话）各一组；配置AI.cmd 优先写 DeepSeek deepseek-flash，备选智谱免费模型
AI_DEFAULT = {
    "vision": {"base_url": "https://api.deepseek.com", "model": "deepseek-flash", "api_key": ""},
    "chat": {"base_url": "https://api.deepseek.com", "model": "deepseek-flash", "api_key": ""},
}


_hotspot = {"t": 0.0, "on": False}
HOTSPOT_PS = ("$p=[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile();"
              "[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($p).TetheringOperationalState")


def hotspot_on():
    """Windows「移动热点」是否开着。热点关了 192.168.137.1 这张虚拟网卡也还挂着地址，不能只看 IP。结果缓存 15 秒。"""
    if time.time() - _hotspot["t"] > 15:
        try:
            out = subprocess.run(["powershell", "-NoProfile", "-Command", HOTSPOT_PS], capture_output=True, text=True, timeout=8,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
            _hotspot["on"] = out.strip() == "On"
        except (OSError, subprocess.SubprocessError):
            _hotspot["on"] = False
        _hotspot["t"] = time.time()
    return _hotspot["on"]


def lan_ips():
    """本机 IPv4 地址：电脑热点（192.168.137.x，只在热点开着时）排最前，去掉回环、自动分配和代理 TUN（198.18/15）的地址。"""
    try:
        ips = {a[4][0] for a in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
    except OSError:
        ips = set()
    ips = [ip for ip in ips if not ip.startswith(("127.", "169.254.", "198.18.", "198.19."))]
    if not hotspot_on():
        ips = [ip for ip in ips if not ip.startswith("192.168.137.")]
    rank = lambda ip: (0 if ip.startswith("192.168.137.") else 1 if ip.startswith("192.168.") else 2, ip)
    return [{"ip": ip, "via": "电脑热点" if ip.startswith("192.168.137.") else "同一 WiFi"} for ip in sorted(ips, key=rank)]


def ai_config():
    """返回 {"vision": {...}, "chat": {...}}，没配 key 的那一项是 None。每次请求都重读，配置完不用重启服务。"""
    try:
        raw = json.loads(AI_CONFIG.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raw = {}
    out = {}
    for kind in ("vision", "chat"):
        c = {**AI_DEFAULT[kind], **(raw.get(kind) if isinstance(raw.get(kind), dict) else {})}
        out[kind] = c if str(c.get("api_key", "")).strip() else None
    return out


def ai_forward(c, req):
    kind = "vision" if req.get("kind") == "vision" else "chat"
    base, key, model = c["base_url"].rstrip("/"), c["api_key"].strip(), c["model"]
    messages = req.get("messages") or []
    if "bigmodel.cn" in base:  # 智谱的图片 base64 不要 data: 前缀
        for m in messages:
            for part in (m.get("content") if isinstance(m.get("content"), list) else []):
                url = (part.get("image_url") or {}).get("url", "")
                if url.startswith("data:") and "," in url:
                    part["image_url"]["url"] = url.split(",", 1)[1]
    body = {"model": model, "messages": messages,
            "temperature": float(req.get("temperature", 0.7)), "max_tokens": int(req.get("max_tokens", 800))}
    if req.get("json") and kind == "chat":
        body["response_format"] = {"type": "json_object"}
    r = urllib.request.Request(base + "/chat/completions", data=json.dumps(body).encode("utf-8"),
                               headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    with urllib.request.urlopen(r, timeout=90) as resp:
        d = json.loads(resp.read().decode("utf-8"))
    return d["choices"][0]["message"].get("content") or ""


# ---------- 公网扫码（内网穿透） ----------
TOOLS = Path(ROOT) / "_tools"
DEMO_PREFIX = "/11_交互Demo_App/"
SHARE_CONFIG = Path.home() / ".jrlx_share.json"
_tunnel = {"state": "off", "url": "", "tool": "", "proc": None}
_ai_hits = []  # 公网来的 AI 请求时间戳，限流用


def share_key():
    """公网口令：第一次运行时随机生成，存在 ~/.jrlx_share.json，之后一直用同一个（删掉文件即换新口令）。"""
    try:
        k = json.loads(SHARE_CONFIG.read_text(encoding="utf-8")).get("key")
        if k:
            return k
    except (OSError, ValueError):
        pass
    k = secrets.token_urlsafe(6)
    SHARE_CONFIG.write_text(json.dumps({"key": k}), encoding="utf-8")
    return k


SHARE_KEY = share_key()


def cpolar_ready():
    for f in (Path.home() / ".cpolar" / "cpolar.yml", Path(os.environ.get("USERPROFILE", "")) / ".cpolar" / "cpolar.yml"):
        try:
            if "authtoken" in f.read_text(encoding="utf-8", errors="ignore"):
                return True
        except OSError:
            pass
    return False


def start_tunnel(port):
    """在后台起穿透，读它的输出拿公网地址。优先 cpolar（国内稳），没配 token 就用 cloudflared 临时链接。"""
    if os.environ.get("JRLX_NO_TUNNEL"):
        return
    force = os.environ.get("JRLX_TUNNEL", "")  # 可设 cpolar / cloudflared 指定用哪个
    if (TOOLS / "cpolar.exe").exists() and cpolar_ready() and force != "cloudflared":
        tool, cmd, pat = "cpolar", [str(TOOLS / "cpolar.exe"), "http", "-log=stdout", "-log-level=info", f"127.0.0.1:{port}"], r"https://[\w.-]+\.cpolar\.(?:top|cn|io)"
    elif (TOOLS / "cloudflared.exe").exists():
        tool, cmd, pat = "cloudflared", [str(TOOLS / "cloudflared.exe"), "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"], r"https://[\w-]+\.trycloudflare\.com"
    else:
        return
    _tunnel.update(state="starting", tool=tool)

    def run():
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", errors="replace")
        except OSError as e:
            print(f"  [公网] {tool} 启动失败：{e}")
            _tunnel["state"] = "failed"
            return
        _tunnel["proc"] = p
        for line in p.stdout:
            m = re.search(pat, line)
            if m and not _tunnel["url"]:
                _tunnel.update(url=m.group(0), state="on")
                print(f"  手机（任何网络，{tool}）：{m.group(0)}{urllib.parse.quote(DEMO_PREFIX)}?k={SHARE_KEY}")
        _tunnel.update(state="failed", url="")
        print(f"  [公网] {tool} 已退出，公网链接失效")

    threading.Thread(target=run, daemon=True).start()


@atexit.register
def _stop_tunnel():
    if _tunnel["proc"] and _tunnel["proc"].poll() is None:
        _tunnel["proc"].terminate()


DATA = Path(os.environ.get("JRLX_DATA") or Path(ROOT) / "_demo_data").resolve()
FILES = DATA / "files"
_data_lock = threading.Lock()
FILE_ID = re.compile(r"^[a-f0-9]{16}$")
MAX_UPLOAD = 300 * 1024 * 1024


def _read_json(name, default):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write_json(name, obj):
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = DATA / (name + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, DATA / name)  # 先写临时文件再替换，写到一半断电也不会坏


def _file_ids(space):
    return {m.get("id") for m in (space.get("media") or []) if isinstance(m, dict)}


class NoCacheHandler(SimpleHTTPRequestHandler):
    public = False  # 穿透端口来的请求为 True
    cache_ok = False
    _set_key = False

    # ---------- 公网访问：口令 + 白名单 ----------
    def public_gate(self):
        """公网请求放行返回 True；否则已经回了错误页，返回 False。"""
        path = urllib.parse.unquote(self.path.split("?")[0])
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        c = cookies.SimpleCookie()
        try:
            c.load(self.headers.get("Cookie") or "")
        except cookies.CookieError:
            pass
        self._set_key = q.get("k", [""])[0] == SHARE_KEY
        if not (self._set_key or (c.get("jrlx_k") and c["jrlx_k"].value == SHARE_KEY)):
            self.send_page(403, "请扫电脑上 Demo 页面里的二维码进入（链接里带着口令）。")
            return False
        if path in ("/", DEMO_PREFIX.rstrip("/")):
            self.send_response(302)
            self.send_header("Location", urllib.parse.quote(DEMO_PREFIX))
            self.end_headers()
            return False
        blocked = (path.lower().startswith(DEMO_PREFIX.lower() + "admin")
                   or re.match(r"^/__data/spaces/.+/(trash|restore|purge)$", path))
        allowed = path.startswith(DEMO_PREFIX) or path.startswith(("/__ai/", "/__data/", "/__lan"))
        if blocked or not allowed:
            self.send_page(404, "这个地址不对外开放。")
            return False
        if path == "/__ai/chat":  # 防止链接外传被刷：公网每小时最多 300 次 AI 请求
            now = time.time()
            _ai_hits[:] = [t for t in _ai_hits if now - t < 3600]
            if len(_ai_hits) >= 300:
                self.send_json({"error": "公网体验的 AI 次数这一小时用完了"}, 429)
                return False
            _ai_hits.append(now)
        return True

    def send_page(self, code, text):
        body = (f'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>旧日来信</title>'
                f'<p style="font:16px sans-serif;padding:40px 24px;color:#3A2A1C">{text}</p>').encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---------- 保存的数据 ----------
    def send_head(self):
        if self.path.split("?")[0].lower().startswith("/_demo_data"):  # 数据文件夹不给直接访问
            self.send_error(404)
            return None
        # 大图有压缩副本（xxx.png.webp，由 jrlx_make_webp.py 生成）且浏览器认 WebP：改发副本，原图和代码里的地址都不动。
        # 副本比原图旧（原图改过还没重新生成）就照旧发原图
        self._webp = False
        if re.search(r"\.(png|jpe?g)$", self.path.split("?")[0], re.I) and "image/webp" in (self.headers.get("Accept") or ""):
            src = self.translate_path(self.path)
            alt = src + ".webp"
            if os.path.isfile(alt) and os.path.getmtime(alt) >= os.path.getmtime(src):
                self._webp = alt
        # 公网带宽小：图片 / 音视频 / 字体让手机缓存一天，脚本和样式照旧不缓存
        self.cache_ok = self.public and bool(re.search(r"\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|m4a|ogg|wav|woff2?|ttf|glb|hdr)$",
                                                       self.path.split("?")[0], re.I))
        return super().send_head()

    def data_get(self, path):
        if path == "/__data/mem":  # 房间电脑里照片的 AI 分析（感官句 / 环境音 / 标签），各设备共用，不用每台都重新看
            with _data_lock:
                return self.send_json(_read_json("mem.json", {}))
        if path == "/__data/spaces":
            with _data_lock:
                return self.send_json({"spaces": _read_json("spaces.json", []), "folder": "" if self.public else str(DATA)})
        m = re.match(r"^/__data/files/([a-f0-9]+)$", path)
        if not m or not FILE_ID.match(m.group(1)):
            return self.send_json({"error": "not found"}, 404)
        meta = _read_json("files.json", {}).get(m.group(1))
        f = FILES / m.group(1)
        if not meta or not f.exists():
            return self.send_json({"error": "文件不在了"}, 404)
        size = f.stat().st_size
        start, end = 0, size - 1
        rng = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range") or "")
        if rng and (rng.group(1) or rng.group(2)):  # 视频拖进度条要用 Range
            start = int(rng.group(1)) if rng.group(1) else size - int(rng.group(2))
            end = min(int(rng.group(2)), size - 1) if rng.group(1) and rng.group(2) else size - 1
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", meta.get("type") or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(f, "rb") as fp:
            fp.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = fp.read(min(256 * 1024, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def data_post(self, path):
        n = int(self.headers.get("Content-Length") or 0)
        if path == "/__data/files":  # 上传一个文件：原样存盘，返回引用
            if n <= 0 or n > MAX_UPLOAD:
                return self.send_json({"error": "文件为空或超过 300MB"}, 413)
            fid = uuid.uuid4().hex[:16]
            FILES.mkdir(parents=True, exist_ok=True)
            with open(FILES / fid, "wb") as fp:
                left = n
                while left > 0:
                    chunk = self.rfile.read(min(256 * 1024, left))
                    if not chunk:
                        break
                    fp.write(chunk)
                    left -= len(chunk)
            meta = {"type": (self.headers.get("Content-Type") or "application/octet-stream")[:80],
                    "name": urllib.parse.unquote(self.headers.get("X-File-Name") or "file")[:120], "size": n, "at": time.time()}
            with _data_lock:
                files = _read_json("files.json", {})
                files[fid] = meta
                _write_json("files.json", files)
            return self.send_json({"id": fid, "url": f"/__data/files/{fid}", "type": meta["type"], "name": meta["name"], "size": n})
        if n > 4 * 1024 * 1024:
            return self.send_json({"error": "数据太大"}, 413)
        body = json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}
        if path == "/__data/mem":  # { key, a }：存一张照片的分析结果
            k, a = str(body.get("key") or "")[:300], body.get("a")
            if not k or not isinstance(a, dict) or len(json.dumps(a)) > 4000:
                return self.send_json({"error": "格式不对"}, 400)
            with _data_lock:
                mem = _read_json("mem.json", {})
                mem[k] = a
                _write_json("mem.json", mem)
            return self.send_json({"ok": True})
        if path == "/__data/spaces":  # 存一个新建的空间
            if not isinstance(body, dict):
                return self.send_json({"error": "格式不对"}, 400)
            body.update({"id": uuid.uuid4().hex[:12], "createdAt": time.time(), "deleted": False})
            with _data_lock:
                spaces = _read_json("spaces.json", [])
                spaces.append(body)
                _write_json("spaces.json", spaces)
            return self.send_json(body)
        m = re.match(r"^/__data/spaces/([a-f0-9]{12})$", path)
        if m:  # 编辑材料：用新内容覆盖，id / 创建时间 / 回收站状态不变
            if not isinstance(body, dict):
                return self.send_json({"error": "格式不对"}, 400)
            with _data_lock:
                spaces = _read_json("spaces.json", [])
                sp = next((s for s in spaces if s.get("id") == m.group(1)), None)
                if not sp:
                    return self.send_json({"error": "没有这个空间"}, 404)
                sp.update({k: v for k, v in body.items() if k not in ("id", "createdAt", "deleted", "deletedAt")})
                sp["updatedAt"] = time.time()
                _write_json("spaces.json", spaces)
            return self.send_json(sp)
        m = re.match(r"^/__data/spaces/([a-f0-9]{12})/(trash|restore|purge)$", path)
        if not m:
            return self.send_json({"error": "not found"}, 404)
        sid, act = m.groups()
        with _data_lock:
            spaces = _read_json("spaces.json", [])
            sp = next((s for s in spaces if s.get("id") == sid), None)
            if not sp:
                return self.send_json({"error": "没有这个空间"}, 404)
            if act == "trash":
                sp.update({"deleted": True, "deletedAt": time.time()})
            elif act == "restore":
                sp.update({"deleted": False, "deletedAt": None})
            else:  # 彻底删除：连同只属于它的文件
                spaces.remove(sp)
                still = set().union(*[_file_ids(s) for s in spaces]) if spaces else set()
                files = _read_json("files.json", {})
                for fid in _file_ids(sp) - still:
                    if fid and FILE_ID.match(fid):
                        (FILES / fid).unlink(missing_ok=True)
                        files.pop(fid, None)
                _write_json("files.json", files)
            _write_json("spaces.json", spaces)
        return self.send_json({"ok": True})

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.public and not self.public_gate():
            return
        path = self.path.split("?")[0]
        if path == "/__lan":
            pub = {"state": _tunnel["state"], "tool": _tunnel["tool"],
                   "url": _tunnel["url"] and f"{_tunnel['url']}{urllib.parse.quote(DEMO_PREFIX)}?k={SHARE_KEY}"}  # 中文路径要转义，否则扫码器按别的编码解读成乱码
            return self.send_json({"port": PORT, "ips": [] if self.public else lan_ips(), "public": pub})
        if path.startswith("/__data/"):
            return self.data_get(path)
        if path == "/__ai/status":
            cfg = ai_config()
            v, c = cfg["vision"], cfg["chat"]
            return self.send_json({"enabled": bool(v or c), "vision": bool(v), "chat": bool(c),
                                   "vision_model": v and v["model"], "chat_model": c and c["model"]})
        super().do_GET()

    def do_HEAD(self):
        if self.public and not self.public_gate():
            return
        super().do_HEAD()

    def do_POST(self):
        if self.public and not self.public_gate():
            return
        if self.path.split("?")[0].startswith("/__data/"):
            try:
                return self.data_post(self.path.split("?")[0])
            except (ValueError, OSError) as e:
                print(f"  [数据] 保存失败：{e}")
                return self.send_json({"error": f"保存失败：{e}"}, 500)
        if self.path.split("?")[0] != "/__ai/chat":
            return self.send_json({"error": "not found"}, 404)
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 12 * 1024 * 1024:
            return self.send_json({"error": "请求太大或为空"}, 413)
        try:
            req = json.loads(self.rfile.read(n).decode("utf-8"))
            c = ai_config()["vision" if req.get("kind") == "vision" else "chat"]
            if not c:
                return self.send_json({"error": "这一项还没配置 AI（双击 配置AI.cmd）"}, 503)
            return self.send_json({"content": ai_forward(c, req)})
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            print(f"  [AI] 服务商返回 {e.code}：{detail}")
            return self.send_json({"error": f"服务商返回 {e.code}：{detail}"}, 502)
        except Exception as e:  # 网络断了、超时、返回格式不对
            print(f"  [AI] 请求失败：{e}")
            return self.send_json({"error": f"请求失败：{e}"}, 502)

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
        ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2",
        ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png",
    }

    def translate_path(self, path):
        return getattr(self, "_webp", False) or super().translate_path(path)

    def guess_type(self, path):
        return "image/webp" if str(path).endswith(".webp") else super().guess_type(path)

    def end_headers(self):
        if getattr(self, "_webp", False) is not False or re.search(r"\.(png|jpe?g)$", self.path.split("?")[0], re.I):
            self.send_header("Vary", "Accept")  # 同一个地址按浏览器发 PNG 或 WebP，缓存要分开
        if self.cache_ok:
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
        if self._set_key:  # 扫码带口令进来，记住一年，之后页面里的请求不用再带
            self.send_header("Set-Cookie", f"jrlx_k={SHARE_KEY}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly")
        super().end_headers()

    def log_message(self, fmt, *args):  # 只打印出错的请求，窗口里清爽一点
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


class PublicHandler(NoCacheHandler):
    public = True


if __name__ == "__main__":
    if os.name == "nt":  # Windows 上 SO_REUSEADDR 会让两个服务抢同一个端口，请求随机落到旧的那个
        ThreadingHTTPServer.allow_reuse_address = False
    ThreadingHTTPServer.request_queue_size = 128  # 默认只排 5 个连接，穿透那边一次并发几十个请求会被拒（手机上图片 502）
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    pub_srv = ThreadingHTTPServer(("127.0.0.1", PORT + 1), functools.partial(PublicHandler, directory=ROOT))
    threading.Thread(target=pub_srv.serve_forever, daemon=True).start()
    start_tunnel(PORT + 1)
    with ThreadingHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"  服务已启动：{ROOT}  端口 {PORT}（不缓存）")
        for a in lan_ips():
            print(f"  手机（{a['via']}）：http://{a['ip']}:{PORT}/11_交互Demo_App/")
        cfg = ai_config()
        v, c = cfg["vision"], cfg["chat"]
        print(f"  数字分身 · 读录屏：{v['model'] if v else '未配置（用示例人设）'}")
        print(f"  数字分身 · 回话：  {c['model'] if c else '未配置（用本地规则）'}    —— 双击 配置AI.cmd 可接入")
        print(f"  保存的空间：{DATA}    后台：http://127.0.0.1:{PORT}/11_交互Demo_App/admin.html")
        if _tunnel["state"] == "starting":
            print(f"  公网链接（{_tunnel['tool']}）启动中，几秒后出现在下面，Demo 页面的二维码也会自动换成它")
        httpd.serve_forever()
