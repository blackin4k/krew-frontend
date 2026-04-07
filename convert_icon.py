from PIL import Image
import os

try:
    img = Image.open('public/yeah.ico')
    img.save('assets/logo.png', 'PNG')
    print("Successfully converted yeah.ico to assets/logo.png")
except Exception as e:
    print(f"Failed to convert: {e}")
