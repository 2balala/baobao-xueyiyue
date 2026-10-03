#!/usr/bin/env python3
"""把整个应用打包成单个 HTML 文件（语音转 base64 内联），可通过微信发送"""
import base64, json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "宝宝学一学.html")

html = open(os.path.join(BASE, "index.html"), encoding="utf-8").read()
css = open(os.path.join(BASE, "css", "style.css"), encoding="utf-8").read()
data_js = open(os.path.join(BASE, "js", "data.js"), encoding="utf-8").read()
manifest_js = open(os.path.join(BASE, "js", "audio-manifest.js"), encoding="utf-8").read()
app_js = open(os.path.join(BASE, "js", "app.js"), encoding="utf-8").read()

# 语音文件 → base64 数据URI
m = re.search(r"const AUDIO_FILES = (\{.*?\});", manifest_js, re.S)
files = json.loads(m.group(1))
audio = {}
for key, rel in files.items():
    raw = open(os.path.join(BASE, rel), "rb").read()
    audio[key] = "data:audio/mpeg;base64," + base64.b64encode(raw).decode()
audio_js = "// 全部语音内联\nconst AUDIO_FILES = " + json.dumps(audio) + ";"

# 去掉 PWA 相关标签（单文件不需要）
html = re.sub(r"\s*<link rel=\"(?:manifest|apple-touch-icon|icon)\"[^>]*>", "", html)
html = html.replace('<meta name="apple-mobile-web-app-capable" content="yes">', "")
# 内联 CSS
html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
# 内联 JS
inline = f"<script>\n{data_js}\n</script>\n  <script>\n{audio_js}\n</script>\n  <script>\n{app_js}\n</script>"
html = re.sub(
    r'<script src="js/data\.js"></script>\s*<script src="js/audio-manifest\.js"></script>\s*<script src="js/app\.js"></script>',
    inline, html)

# 确认没有残留的外部引用
leftover = re.findall(r'(?:src|href)="(?!data:)([^"]+)"', html)
leftover = [u for u in leftover if not u.startswith("http")]
if leftover:
    raise SystemExit("还有未内联的引用: %s" % leftover)

open(OUT, "w", encoding="utf-8").write(html)
print(f"打包完成: {OUT}  ({os.path.getsize(OUT)/1024/1024:.1f} MB)")
