#!/usr/bin/env python3
"""宝宝学一学 - 用 edge-tts 预生成全部语音 MP3，并输出 js/audio-manifest.js"""
import asyncio, json, os, re, sys
import edge_tts

BASE = os.path.dirname(os.path.abspath(__file__))
ZH_VOICE = "zh-CN-XiaoxiaoNeural"
EN_VOICE = "en-US-JennyNeural"
RATE_ZH = "-10%"
RATE_EN = "-10%"
SEM = asyncio.Semaphore(6)

data = json.load(open("/tmp/bbx-data.json", encoding="utf-8"))
zh_dir = os.path.join(BASE, "audio", "zh")
en_dir = os.path.join(BASE, "audio", "en")
os.makedirs(zh_dir, exist_ok=True)
os.makedirs(en_dir, exist_ok=True)

manifest = {}   # key -> 相对路径
tasks = []      # (相对路径, text, voice, rate)

def zh_num_name(n):
    lows = ["零","一","二","三","四","五","六","七","八","九","十"]
    if n <= 10: return lows[n]
    if n < 20: return "十" + lows[n - 10]
    return "二十"

# 汉字：学习 + 找一找
for i, c in enumerate(data["chars"]):
    g, w = c["g"], c["w"]
    tasks.append((f"audio/zh/c{i}.mp3", f"{g}。{w}的{g}。", ZH_VOICE, RATE_ZH))
    tasks.append((f"audio/zh/qc{i}.mp3", f"找一找，{w}的{g}，在哪里？", ZH_VOICE, RATE_ZH))

# 数字：学习（带数数） + 找一找
for n in data["numbers"]:
    v = n["n"]; name = n["zh"]
    seq = "、".join(zh_num_name(k) for k in range(1, v + 1))
    tasks.append((f"audio/zh/n{v}.mp3", f"这是{name}。我们一起数：{seq}！", ZH_VOICE, RATE_ZH))
    tasks.append((f"audio/zh/qn{v}.mp3", f"找一找，数字{name}，在哪里？", ZH_VOICE, RATE_ZH))

# 字母（英文）
for i, l in enumerate(data["letters"]):
    tasks.append((f"audio/en/L{i}.mp3", f"{l['g']}. {l['g']} is for {l['w']}.", EN_VOICE, RATE_EN))
    tasks.append((f"audio/zh/ql{i}.mp3", f"找一找，字母 {l['g']}，在哪里？", ZH_VOICE, RATE_ZH))

# 固定语句
misc = [
    ("audio/zh/praise0.mp3", "真棒！", ZH_VOICE, RATE_ZH),
    ("audio/zh/praise1.mp3", "答对啦！", ZH_VOICE, RATE_ZH),
    ("audio/zh/praise2.mp3", "好厉害！", ZH_VOICE, RATE_ZH),
    ("audio/zh/praise3.mp3", "太棒了！", ZH_VOICE, RATE_ZH),
    ("audio/zh/wrong.mp3",  "再想一想哦。", ZH_VOICE, RATE_ZH),
    ("audio/zh/m-letters.mp3", "字母，想学一学，还是玩一玩？", ZH_VOICE, RATE_ZH),
    ("audio/zh/m-numbers.mp3", "数字，想学一学，还是玩一玩？", ZH_VOICE, RATE_ZH),
    ("audio/zh/m-chars.mp3",   "汉字，想学一学，还是玩一玩？", ZH_VOICE, RATE_ZH),
]
tasks.extend(misc)

# 点苹果逐个数：一、二、三……二十
for k in range(1, 21):
    tasks.append((f"audio/zh/cnt{k}.mp3", zh_num_name(k), ZH_VOICE, RATE_ZH))

# 字母名单独发音（点单词里的字母块用）
for i, l in enumerate(data["letters"]):
    tasks.append((f"audio/en/ls{i}.mp3", l["g"], EN_VOICE, RATE_EN))

# 字母单词的中文注解发音（点中文注解用）
for i, l in enumerate(data["letters"]):
    tasks.append((f"audio/zh/zw{i}.mp3", l["zh"], ZH_VOICE, RATE_ZH))

# 单词整词发音（拼合完成后的单词发音）
for i, l in enumerate(data["letters"]):
    tasks.append((f"audio/en/wd{i}.mp3", l["w"], EN_VOICE, RATE_EN))
for rel, *_ in misc:
    manifest[os.path.splitext(os.path.basename(rel))[0]] = rel

async def gen(rel, text, voice, rate):
    out = os.path.join(BASE, rel)
    if os.path.exists(out) and os.path.getsize(out) > 500:
        return  # 已生成，跳过
    for attempt in range(3):
        try:
            async with SEM:
                c = edge_tts.Communicate(text, voice, rate=rate)
                await c.save(out)
            sz = os.path.getsize(out)
            if sz > 500:
                manifest[os.path.splitext(os.path.basename(rel))[0]] = rel
                return
            raise RuntimeError(f"too small: {sz}")
        except Exception as e:
            if attempt == 2:
                print(f"FAIL {rel}: {e}", file=sys.stderr)

async def main():
    # aiohttp 在 Python3.9 大并发下有跨循环冲突，改为小批量、每批独立事件循环
    CHUNK = 4
    for i in range(0, len(tasks), CHUNK):
        chunk = tasks[i:i + CHUNK]
        await asyncio.gather(*(gen(*t) for t in chunk))
        if (i // CHUNK) % 20 == 0:
            print(f"... {i + len(chunk)}/{len(tasks)}", flush=True)

asyncio.run(main())

# 重新以文件名生成 manifest（键 = 文件名去扩展名）
manifest = {}
for rel, *_ in tasks:
    name = os.path.splitext(os.path.basename(rel))[0]
    if os.path.exists(os.path.join(BASE, rel)) and os.path.getsize(os.path.join(BASE, rel)) > 500:
        manifest[name] = rel

with open(os.path.join(BASE, "js", "audio-manifest.js"), "w", encoding="utf-8") as f:
    f.write("// 预生成语音清单（由 tts_generate.py 生成）\nconst AUDIO_FILES = ")
    f.write(json.dumps(manifest, ensure_ascii=False, indent=1))
    f.write(";\n")

total = sum(os.path.getsize(os.path.join(BASE, r)) for r in manifest.values())
print(f"generated {len(manifest)}/{len(tasks)} files, total {total/1024/1024:.1f} MB")
