# Combine screenshots side by side for quick review: python scripts/montage.py out.png a.png b.png ...
import sys
from PIL import Image

out, *names = sys.argv[1:]
ims = [Image.open(n) for n in names]
h = max(i.height for i in ims)
ims = [i.resize((int(i.width * h / i.height), h)) for i in ims]
w = sum(i.width for i in ims) + 20 * (len(ims) - 1)
canvas = Image.new('RGB', (w, h), 'white')
x = 0
for i in ims:
    canvas.paste(i, (x, 0))
    x += i.width + 20
scale = min(1.0, 2400 / w)
canvas.resize((int(w * scale), int(h * scale))).save(out)
