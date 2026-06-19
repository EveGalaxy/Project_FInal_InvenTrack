from flask import Flask, jsonify, request
import asyncio, statistics, time, requests, threading, json, os
from bleak import BleakScanner

app = Flask(__name__)
from flask_cors import CORS
CORS(app, origins=["http://localhost:8080"])

CONFIG_PATH = "config.json"
lock = threading.Lock()
is_running = False
collect_counter = 1

# ---------- โหลด/บันทึก config ----------
def load_config_from_disk():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError("config.json not found")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_config_to_disk(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config_from_disk()

# ค่ามาตรฐาน หาก key บางตัวไม่มีในไฟล์
config.setdefault("laptop_index", 1)
config.setdefault("beacon_address", "")
config.setdefault("beacon_name", "Unknown")
config.setdefault("slot", 1)
config.setdefault("backend_url", "http://localhost:5000/position")
config.setdefault("interval_sec", 5)
config.setdefault("scan_times", 10)

# ---------- ฟังก์ชันสแกนค่าเฉลี่ยนิ่ง ----------
import statistics

async def scan_beacon_by_mac(address: str, duration: float = 3.0, min_rssi: int = -100):
    """
    เก็บ RSSI ต่อเนื่องด้วย callback นาน duration วินาที
    กรองเฉพาะ MAC ที่ระบุ (case-insensitive) และค่า rssi >= min_rssi
    คืนค่า avg/used/raw แบบ trimmed mean 20%
    """
    if not address:
        return None
    target = address.lower()
    values = []

    def cb(dev, adv):
        try:
            if dev and dev.address and dev.address.lower() == target:
                rssi = getattr(adv, "rssi", None) if adv else None
                if rssi is None:
                    rssi = getattr(dev, "rssi", None)
                if isinstance(rssi, (int, float)) and rssi >= min_rssi:
                    values.append(int(rssi))
        except Exception:
            pass

    scanner = BleakScanner(cb)
    await scanner.start()
    await asyncio.sleep(duration)        # เก็บต่อเนื่อง N วินาที
    await scanner.stop()

    if not values:
        return None

    values.sort()
    trim_n = max(1, int(len(values) * 0.2))
    trimmed = values[trim_n:-trim_n] if len(values) > 2 * trim_n else values
    avg = round(statistics.mean(trimmed), 2)
    return {"avg": avg, "raw": values, "used": trimmed}


import requests

def send_to_backend(avg_value, slot, collect, laptop_index, backend_url, save_zero_on_not_found=True):
    """
    ส่งเฉพาะฟิลด์ของ laptop ที่ใช้งานอยู่:
      - L1 -> ส่ง {RSSI_1: value}
      - L2 -> ส่ง {RSSI_2: value}
      - L3 -> ส่ง {RSSI_3: value}

    avg_value = None  -> กรณีไม่พบสัญญาณในรอบนั้น
      - ถ้า save_zero_on_not_found=True  จะส่ง 0 เฉพาะช่องของเครื่องนี้
      - ถ้า False  จะ 'ไม่ส่ง' ค่า RSSI_* (ข้ามการอัปเดต)
    """
    payload = {
        "slot": slot,
        "collect": collect,
    }

    key = f"RSSI_{int(laptop_index)}"

    if avg_value is None:
        # ไม่พบสัญญาณ
        if save_zero_on_not_found:
            payload[key] = 0     # บันทึกเป็น 0 เฉพาะช่องของเครื่องนี้
        # else: ไม่ใส่ key -> backend จะไม่แตะต้องค่านั้น
    else:
        payload[key] = float(avg_value)

    try:
        res = requests.post(backend_url, json=payload, timeout=5)
        print(f"✅ Sent: {payload} | {res.status_code}")
    except Exception as e:
        print(f"❌ Send failed: {e}")

def auto_collect_loop():
    global collect_counter, is_running, config
    print("🔁 auto_collect_loop started")
    while True:
        with lock:
            running = is_running
            cfg = dict(config)  # snapshot ค่า config ล่าสุด

        if not running:
            time.sleep(0.3)
            continue

        # ---- เริ่มหนึ่งรอบ ----
        addr = cfg.get("beacon_address")
        scan_times = cfg.get("scan_times", 10)
        interval = cfg.get("interval_sec", 5)

        print(f"\n📡 Round {collect_counter} | Beacon={addr} | slot={cfg.get('slot')} | L{cfg.get('laptop_index')}")
        result = asyncio.run(scan_beacon_by_mac(addr, duration=3.0, min_rssi=-95))
        avg = result["avg"] if result else None

        # ส่งเฉพาะช่องของ laptop นี้ (ถ้าไม่เจอ avg=None -> เลือกจะส่ง 0 หรือข้ามในฟังก์ชันส่ง)
        send_to_backend(
            avg_value=avg,
            slot=cfg.get("slot", 1),
            collect=collect_counter,
            laptop_index=cfg.get("laptop_index", 1),
            backend_url=cfg.get("backend_url"),
            save_zero_on_not_found=True  # หรือ False ถ้าต้องการข้ามจริง ๆ
        )

        collect_counter += 1

        # หยุดอัตโนมัติครบ 10 รอบ แต่ **อย่า break**
        if collect_counter >= 11:
            print("🟡 Auto stop after 10 rounds.")
            with lock:
                is_running = False
                collect_counter = 0
            continue

        time.sleep(interval)

# ---------- API ควบคุม ----------
@app.route("/status")
def status():
    with lock:
        cfg = dict(config)
        running = is_running
        cr = collect_counter
    return jsonify({
        "running": running,
        "collect_round": cr,
        "laptop_index": cfg.get("laptop_index"),
        "slot": cfg.get("slot"),
        "interval": cfg.get("interval_sec"),
        "scan_times": cfg.get("scan_times"),
        "beacon_name": cfg.get("beacon_name"),
        "beacon_address": cfg.get("beacon_address")
    })

@app.route("/start", methods=["POST"])
def start():
    global is_running
    with lock:
        is_running = True
    return jsonify({"status": "started"})

@app.route("/stop", methods=["POST"])
def stop():
    global is_running, collect_counter
    with lock:
        is_running = False
        collect_counter = 0  # reset counter
    return jsonify({"message": "Scanner stopped and counter reset"})

# ---------- API อัปเดตค่าแบบไดนามิกจากหน้าเว็บ ----------
@app.route("/config", methods=["GET"])
def get_config():
    with lock:
        return jsonify(config)

@app.route("/config", methods=["POST"])
def update_config():
    """อัปเดตค่าในหน่วยความจำ (hot) เช่น beacon, slot, interval, scan_times
       body: { beacon_address?, beacon_name?, laptop_index?, slot?, interval_sec?, scan_times?, backend_url? }"""
    data = request.get_json(force=True, silent=True) or {}
    allowed = {"beacon_address","beacon_name", "laptop_index","slot","interval_sec","scan_times","backend_url"}
    with lock:
        for k,v in data.items():
            if k in allowed:
                config[k] = v
    return jsonify({"ok": True, "config": config})

@app.route("/save-config", methods=["POST"])
def persist_config():
    """บันทึก config ปัจจุบันลงไฟล์ (optional)"""
    with lock:
        save_config_to_disk(config)
    return jsonify({"ok": True})


@app.route("/scan-nearby")
def scan_nearby():
    import asyncio
    async def _run():
        devices = await BleakScanner.discover(timeout=3.0)
        out = []
        for d in devices:
            out.append({"address": d.address, "name": d.name, "rssi": d.rssi})
        return out
    return jsonify(asyncio.run(_run()))

# ---------- Single Scan เพื่อทดสอบแบบระบุ address ชั่วคราว ----------
@app.route("/scan")
def scan_once():
    addr = request.args.get("address") or config.get("beacon_address")
    name = request.args.get("name") or config.get("beacon_name", "Unknown")
    result = asyncio.run(scan_beacon_by_mac(addr, duration=3.0, min_rssi=-95))
    if not result:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "name": name,
        "address": addr,
        "rssi_avg": result["avg"],
        "rssi_values": result["raw"],
        "used_for_avg": result["used"],
        "count": len(result["raw"])
    })


if __name__ == "__main__":
    t = threading.Thread(target=auto_collect_loop, daemon=True)
    t.start()
    app.run(port=8000, debug=True)
