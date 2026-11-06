"""旧日来信 · 配置数字分身用的大模型（由 配置AI.cmd 调用）
弹一个小窗口：每个 key 一栏，旁边有「粘贴」按钮（命令行里的隐藏输入不认 Ctrl+V，所以改用窗口）。
把 API Key 写进本机 ~/.jrlx_ai.json —— 不放进 Demo 文件夹，所以不会被打包发给别人，也不会被网页读到。
· 推荐 DeepSeek：deepseek-flash（V4.1 Flash，能看图），读录屏、总结人设、回话都用它（https://platform.deepseek.com → API keys）
· 备选智谱免费模型：读录屏 glm-4v-flash、回话 glm-4-flash-250414（https://bigmodel.cn → API Keys）
两个都填时用 DeepSeek。模型名以后变了，直接改配置文件里的 model。"""
import json
from pathlib import Path
import tkinter as tk
from tkinter import ttk

path = Path.home() / ".jrlx_ai.json"
try:
    cfg = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
except ValueError:
    cfg = {}
keys = cfg.get("keys") if isinstance(cfg.get("keys"), dict) else {}

DEEPSEEK = "https://api.deepseek.com"
ZHIPU = "https://open.bigmodel.cn/api/paas/v4"


def save(ds, zp):
    keys["deepseek"], keys["zhipu"] = ds, zp
    if ds:
        vision = {"base_url": DEEPSEEK, "model": "deepseek-flash", "api_key": ds}
        chat = {"base_url": DEEPSEEK, "model": "deepseek-flash", "api_key": ds}
    elif zp:
        vision = {"base_url": ZHIPU, "model": "glm-4v-flash", "api_key": zp}
        chat = {"base_url": ZHIPU, "model": "glm-4-flash-250414", "api_key": zp}
    else:
        vision, chat = {}, {}
    for name, new in (("vision", vision), ("chat", chat)):  # 保留手改过的模型名
        old = cfg.get(name) if isinstance(cfg.get(name), dict) else {}
        if new and old.get("base_url") == new["base_url"] and old.get("model"):
            new["model"] = old["model"]
    path.write_text(json.dumps({"keys": keys, "vision": vision, "chat": chat}, ensure_ascii=False, indent=2), encoding="utf-8")
    return vision.get("model"), chat.get("model")


root = tk.Tk()
root.title("旧日来信 · 配置数字分身 AI")
root.resizable(False, False)
root.attributes("-topmost", True)
f = ttk.Frame(root, padding=18)
f.grid()

ttk.Label(f, text="复制好 key 后点「粘贴」（也可以点进输入框按 Ctrl+V）。留空 = 不用这一家。").grid(row=0, column=0, columnspan=4, sticky="w", pady=(0, 12))
fields = {}


def paste(var):
    try:
        var.set(root.clipboard_get().strip())
    except tk.TclError:  # 剪贴板是空的或者不是文字
        status.config(text="剪贴板里没有文字，先去网页上复制 key", foreground="#c33")


for r, (k, label, hint) in enumerate((("deepseek", "DeepSeek（推荐）", "读录屏、总结人设、回话都用它"),
                                      ("zhipu", "智谱（备选，免费）", "没有 DeepSeek 时才用")), start=1):
    ttk.Label(f, text=label).grid(row=r * 2 - 1, column=0, sticky="w")
    ttk.Label(f, text=hint, foreground="#888").grid(row=r * 2 - 1, column=1, columnspan=3, sticky="w")
    var = tk.StringVar(value=keys.get(k, ""))
    e = ttk.Entry(f, textvariable=var, width=46, show="•")
    e.grid(row=r * 2, column=0, columnspan=2, sticky="we", pady=(2, 10))
    ttk.Button(f, text="粘贴", width=6, command=lambda v=var: paste(v)).grid(row=r * 2, column=2, padx=(6, 0), pady=(2, 10))
    ttk.Button(f, text="清空", width=6, command=lambda v=var: v.set("")).grid(row=r * 2, column=3, padx=(4, 0), pady=(2, 10))
    fields[k] = (var, e)

show = tk.BooleanVar(value=False)
ttk.Checkbutton(f, text="显示 key", variable=show,
                command=lambda: [e.config(show="" if show.get() else "•") for _, e in fields.values()]).grid(row=5, column=0, sticky="w")
status = ttk.Label(f, text=f"保存到：{path}", foreground="#888")
status.grid(row=6, column=0, columnspan=4, sticky="w", pady=(8, 0))


def on_save():
    try:
        v, c = save(fields["deepseek"][0].get().strip(), fields["zhipu"][0].get().strip())
    except OSError as e:
        status.config(text=f"保存失败：{e}", foreground="#c33")
        return
    status.config(text=f"已保存 ✓ 读录屏：{v or '未配置（用示例人设）'} · 回话：{c or '未配置（用本地规则）'}。刷新网页就生效。", foreground="#2a7a2a")
    print(f"  已保存。读录屏：{v or '未配置'}  回话：{c or '未配置'}")


btns = ttk.Frame(f)
btns.grid(row=7, column=0, columnspan=4, sticky="e", pady=(14, 0))
ttk.Button(btns, text="保存", command=on_save).grid(row=0, column=0, padx=4)
ttk.Button(btns, text="关闭", command=root.destroy).grid(row=0, column=1)
fields["deepseek"][1].focus_set()
root.mainloop()
