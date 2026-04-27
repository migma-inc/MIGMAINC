
import json
import sys

log_file = r'C:\Users\victurib\.gemini\antigravity\brain\39062aa6-9087-421a-b13e-71412b8d93c3\.system_generated\steps\277\output.txt'

with open(log_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

logs = data.get('result', {}).get('result', [])

# Sort by timestamp
logs.sort(key=lambda x: x.get('timestamp', 0))

for log in logs:
    ts = log.get('timestamp', 0)
    if 1777305000000000 <= ts <= 1777305100000000:
        print(json.dumps(log))
