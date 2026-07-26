#!/usr/bin/env python3
"""
handoff.md の「次の一手」を抽出して出力
SessionStart hook から呼ばれる
"""
import os
import sys

handoff_path = os.path.join(os.path.dirname(__file__), '..', 'memory', 'handoff.md')

if not os.path.exists(handoff_path):
    print("⚠️ handoff.md が見つかりません")
    sys.exit(1)

with open(handoff_path, 'r', encoding='utf-8') as f:
    content = f.read()

if '## 次の一手' not in content:
    print("⚠️ handoff に「次の一手」がありません")
    sys.exit(1)

lines = content.split('\n')
start_idx = None
for i, line in enumerate(lines):
    if '## 次の一手' in line:
        start_idx = i + 1
        break

if start_idx is None:
    sys.exit(1)

next_steps = []
for i in range(start_idx, len(lines)):
    line = lines[i]
    if line.startswith('## '):
        break
    if line.strip():
        next_steps.append(line)

if next_steps:
    print("\n".join(next_steps))
