# FILE: scripts/wsq_to_png.py
# Requirement: pip install pillow wsq
# Usage: cat input.wsq | python scripts/wsq_to_png.py > out.png
import sys
from io import BytesIO
from PIL import Image  # type: ignore  # Pillow
import wsq  # noqa: F401  # registers WSQ codec into Pillow

def main():
    data = sys.stdin.buffer.read()
    if not data:
        print("no stdin data", file=sys.stderr)
        sys.exit(2)
    try:
        im = Image.open(BytesIO(data))
        im.load()  # force decode
        buf = BytesIO()
        im.save(buf, format="PNG")
        sys.stdout.buffer.write(buf.getvalue())
    except Exception as e:
        print(f"wsq->png failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
