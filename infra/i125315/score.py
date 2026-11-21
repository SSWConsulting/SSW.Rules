import json
import subprocess


def _sh(args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=120)
        out = (p.stdout or "") + (p.stderr or "")
        return out.strip()
    except Exception as e:  # noqa: BLE001
        return "ERR " + repr(e)


LINES = []
LINES.append("C211-I125315 IN-CONTAINER DEVICE PROBE")
LINES.append("nvidia-smi -L :: " + _sh(["nvidia-smi", "-L"]))
LINES.append("nvidia-smi --query-gpu :: " + _sh(
    ["nvidia-smi", "--query-gpu=name,uuid,memory.total,driver_version",
     "--format=csv,noheader"]))
LINES.append("lspci :: " + _sh(
    ["bash", "-lc", "lspci -nn 2>/dev/null | grep -i -E 'nvidia|3d contr' || true"]))
LINES.append("devnodes :: " + _sh(
    ["bash", "-lc", "ls -1 /dev/nvidia* 2>/dev/null || true"]))
TEXT = "\n".join(LINES)
print("C211-I125315-CONTAINER-OUTPUT-BEGIN", flush=True)
print(TEXT, flush=True)
print("C211-I125315-CONTAINER-OUTPUT-END", flush=True)


def init():
    print("C211-I125315 init", flush=True)
    print(TEXT, flush=True)


def run(raw_data):
    return json.dumps({"c211": "i125315", "device_text": TEXT})
