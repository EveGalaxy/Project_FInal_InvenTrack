from flask import Flask, jsonify, request
from flask_cors import CORS
from bleak import BleakScanner
import asyncio

app = Flask(__name__)
CORS(app)

# ฟังก์ชันสแกนหา Beacon
def scan_beacons():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    return loop.run_until_complete(scan_beacons_async())

async def scan_beacons_async():
    devices = await BleakScanner.discover()
    beacons = []

    for device in devices:
        manufacturer_data = device.metadata.get("manufacturer_data", {})
        if 76 in manufacturer_data:
            raw_data = manufacturer_data[76]
            if len(raw_data) >= 23:
                major = int.from_bytes(raw_data[18:20], byteorder="big")  # อาจต้องแก้ให้ตรงกับอุปกรณ์จริง
                minor = int.from_bytes(raw_data[20:22], byteorder="big")

                beacons.append({
                    "name": device.name or "Unknown",
                    "address": device.address,
                    "major": major,
                    "minor": minor
                })

    return beacons

# API ให้ Vue ขอข้อมูล Major/Minor ของ Beacon ที่เลือก
@app.route("/api/get-beacon", methods=["POST"])
def get_beacon_details():
    data = request.get_json()
    beacon_address = data.get("address")

    if not beacon_address:
        return jsonify({"error": "No address provided"}), 400

    # ค้นหา Beacon
    beacons = scan_beacons()
    for beacon in beacons:
        if beacon["address"] == beacon_address:
            return jsonify(beacon)

    return jsonify({"error": "Beacon not found"}), 404

if __name__ == "__main__":
    app.run(port=3000, debug=True)
