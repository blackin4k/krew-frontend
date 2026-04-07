
with open('C:/krewv1/krew_backend/app.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'def next_song' in line or 'player/next' in line:
            print(f"Found at line {i+1}: {line.strip()}")
