import re

def numbers(text): return re.findall(r"(?<![A-Za-z])(?:\d+(?:\.\d+)?)", text)
def verify(text,evidence):
    hay=str(evidence)
    for n in numbers(text):
        try:
            v=float(n); found=False
            for e in re.findall(r"\d+(?:\.\d+)?",hay):
                if abs(float(e)-v)<=1: found=True; break
            if not found: return False
        except ValueError: pass
    return True
