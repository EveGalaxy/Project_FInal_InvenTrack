# scanner_pull_config.py
import asyncio, time, statistics, requests
from collections import defaultdict
from typing import Dict, List, Optional
from bleak import BleakScanner

# ====== CONFIG ======
LAPTOP_INDEX = 1  # 1..3 ตามเครื่อง
BACKEND_BASE = "http://localhost:5000"  # ของ Node/Express
MAP_ENDPOINT = f"{BACKEND_BASE}/api/product-beacon-map"
UPDATE_ENDPOINT = f"{BACKEND_BASE}/update-rssi-current"

SCAN_DURATION_SEC = 3.0
SCAN_INTERVAL_SEC = 5.0
MIN_RSSI = -100
TRIM_RATIO = 0.20
REFRESH_MAP_EVERY_SEC = 30
SEND_ZERO_IF_MISSED = True
PRINT_DEBUG = True

# ====== STATE ======
# mac (uppercase) -> list of (productId, beaconId)
MAC_TO_ASSIGNMENTS: Dict[str, List[tuple]] = {}
LAST_MAP_FETCH = 0.0

def trimmed_mean(values: List[int], trim: float = TRIM_RATIO) -> Optional[float]:
    if not values:
        return None
    vs = sorted(values)
    n = len(vs)
    k = max(1, int(n * trim))
    used = vs[k:-k] if n > 2 * k else vs
    try:
        return round(statistics.mean(used), 2)
    except statistics.StatisticsError:
        return round(statistics.mean(vs), 2)

def fetch_mapping():
    global MAC_TO_ASSIGNMENTS, LAST_MAP_FETCH
    try:
        r = requests.get(MAP_ENDPOINT, timeout=5)
        r.raise_for_status()
        rows = r.json() or []
        mapping: Dict[str, List[tuple]] = defaultdict(list)
        for row in rows:
            mac = (row.get("address") or "").upper()
            pid = row.get("productId")
            bid = row.get("beaconId")
            if mac and pid and bid:
                mapping[mac].append((int(pid), int(bid)))
        MAC_TO_ASSIGNMENTS = dict(mapping)
        LAST_MAP_FETCH = time.time()
        if PRINT_DEBUG:
            print(f"🔄 fetched mapping: {sum(len(v) for v in mapping.values())} pairs "
                  f"({len(mapping)} macs)")
    except Exception as e:
        print(f"⚠️ fetch_mapping failed: {e}")

def maybe_refresh_mapping():
    if time.time() - LAST_MAP_FETCH > REFRESH_MAP_EVERY_SEC or not MAC_TO_ASSIGNMENTS:
        fetch_mapping()

def send_live(product_id: int, beacon_id: int, rssi: Optional[float]):
    payload = {
        "productId": product_id,
        "beaconId": beacon_id,
        "laptopIndex": LAPTOP_INDEX
    }
    if rssi is None:
        if SEND_ZERO_IF_MISSED:
            payload["rssi"] = 0
        else:
            if PRINT_DEBUG:
                print(f"⏭️  skip send (no value) for product {product_id} / beacon {beacon_id}")
            return
    else:
        payload["rssi"] = float(rssi)

    try:
        res = requests.post(UPDATE_ENDPOINT, json=payload, timeout=5)
        if res.ok:
            if PRINT_DEBUG: print(f"✅ {payload} -> {res.status_code}")
        else:
            print(f"❌ send fail {res.status_code} {res.text}")
    except Exception as e:
        print(f"❌ send exception: {e}")

async def scan_round() -> Dict[str, Optional[float]]:
    """สแกนต่อเนื่อง แล้วคืน {MAC -> trimmed_mean_rssi}"""
    values_by_mac: Dict[str, List[int]] = defaultdict(list)

    def cb(dev, adv):
        try:
            mac = (dev.address or "").upper()
            rssi = None
            if adv and hasattr(adv, "rssi"):
                rssi = adv.rssi
            if rssi is None and hasattr(dev, "rssi"):
                rssi = dev.rssi
            if isinstance(rssi, (int, float)) and rssi >= MIN_RSSI and mac:
                values_by_mac[mac].append(int(rssi))
        except Exception:
            pass

    scanner = BleakScanner(cb)
    await scanner.start()
    await asyncio.sleep(SCAN_DURATION_SEC)
    await scanner.stop()

    avg_by_mac: Dict[str, Optional[float]] = {}
    for mac, vals in values_by_mac.items():
        avg_by_mac[mac] = trimmed_mean(vals, TRIM_RATIO)
    return avg_by_mac

async def loop_run():
    print(f"🔁 live scanner started | laptop={LAPTOP_INDEX}")
    fetch_mapping()
    while True:
        maybe_refresh_mapping()
        t0 = time.time()

        try:
            avg_by_mac = await scan_round()
            # ส่งให้ทุก assignment ที่ประกาศไว้
            for mac, pairs in MAC_TO_ASSIGNMENTS.items():
                avg = avg_by_mac.get(mac)  # None = รอบนี้ไม่เจอ
                for (product_id, beacon_id) in pairs:
                    send_live(product_id, beacon_id, avg)
        except Exception as e:
            print(f"❌ loop error: {e}")

        # รอรอบถัดไป
        elapsed = time.time() - t0
        await asyncio.sleep(max(0.0, SCAN_INTERVAL_SEC - elapsed))

if __name__ == "__main__":
    asyncio.run(loop_run())
