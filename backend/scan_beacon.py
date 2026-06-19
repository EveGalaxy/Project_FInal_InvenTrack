from flask import Flask, request, jsonify
import asyncio
from bleak import BleakScanner

app = Flask(__name__)

@app.route('/scan')
def scan():
    address = request.args.get('address')
    name = request.args.get('name')

    async def do_scan():
        values = []
        for _ in range(5):  # scan 5 times to increase chance of detection
            devices = await BleakScanner.discover(timeout=2.0)
            for d in devices:
                if d.address == address:
                    values.append(d.rssi)
                    if len(values) >= 2:
                        return values
        return values if values else None

    rssi_values = asyncio.run(do_scan())

    if not rssi_values:
        return jsonify({'error': 'ไม่พบ Beacon'}), 404

    # Pad to 2 values if found only 1
    while len(rssi_values) < 2:
        rssi_values.append(rssi_values[0])

    return jsonify({
        'name': name,
        'address': address,
        'rssi_1': rssi_values[0],
        'rssi_2': None,
        'rssi_3': None,
        'rssi_4': None
    })

if __name__ == '__main__':
    app.run(port=8000)
