
with open('C:/krewv1/krew_backend/app.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if '/songs' in line and '@app.route' in line:
            print(f"Found route at line {i+1}: {line.strip()}")
        if 'def get_songs' in line:
            print(f"Found function at line {i+1}: {line.strip()}")
