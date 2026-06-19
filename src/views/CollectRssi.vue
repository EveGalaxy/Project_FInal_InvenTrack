<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8 animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-indigo-600">Collect RSSI • Control Panel</h1>
          <p class="text-sm text-gray-500">เก็บค่า RSSI แบบนิ่ง (trimmed mean) + ควบคุมตัวสแกนอัตโนมัติบนแต่ละ Laptop</p>
        </div>
      </div>

      <!-- Config Card -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2 bg-white rounded-2xl shadow p-4 space-y-4">
          <h2 class="font-semibold text-teal-400">ตั้งค่า (Config)</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="label">Scanner URL (Flask)</label>
              <input v-model.trim="form.scannerUrl" class="input" placeholder="http://laptop-1.local:8000" />
            </div>
            <div>
              <label class="label">Backend URL (/position-record)</label>
              <input v-model.trim="form.backendUrl" class="input" placeholder="http://localhost:5000/position-record" />
            </div>
            <div>
              <label class="label">Laptop Index</label>
              <select v-model.number="form.laptopIndex" class="input">
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="3">3</option>
              </select>
            </div>
            <div>
              <label class="label">Slot</label>
              <select v-model.number="form.slot" class="input">
                <option :value="1">1 — A1</option>
                <option :value="2">2 — B1</option>
                <option :value="3">3 — C2</option>
                <option :value="4">4 — D2</option>
              </select>
            </div>
            <div>
              <label class="label">Beacon Name</label>
              <div class="flex gap-2">
                <select v-if="!form.beaconNameCustom" v-model="form.beaconName" class="input" @change="onSelectBeaconByName">
                  <option v-for="b in beaconOptions" :key="b.address" :value="b.name">{{ b.name }} ({{ b.address }})</option>
                  <option value="__custom__">กำหนดเอง…</option>
                </select>
                <input v-else v-model.trim="form.beaconName" class="input" placeholder="IBKS 105 No 1" />
                <button class="btn-secondary" type="button" @click="toggleBeaconNameMode">{{ form.beaconNameCustom ? 'ใช้รายการ' : 'กำหนดเอง' }}</button>
              </div>
            </div>
            <div>
              <label class="label">Beacon Address (MAC)</label>
              <div class="flex gap-2">
                <select v-if="!form.beaconAddressCustom" v-model="form.beaconAddress" class="input" @change="onSelectBeaconByAddress">
                  <option v-for="b in beaconOptions" :key="b.address + '-addr'" :value="b.address">{{ b.address }} ({{ b.name }})</option>
                  <option value="__custom__">กำหนดเอง…</option>
                </select>
                <input v-else v-model.trim="form.beaconAddress" class="input" placeholder="D8:6F:B8:83:E6:55" />
                <button class="btn-secondary" type="button" @click="toggleBeaconAddressMode">{{ form.beaconAddressCustom ? 'ใช้รายการ' : 'กำหนดเอง' }}</button>
              </div>
              <div class="text-xs text-gray-500 mt-1">เลือกจากรายการ หรือกด "กำหนดเอง" เพื่อพิมพ์เอง</div>
            </div>
            <div>
              <label class="label">Interval (sec)</label>
              <input type="number" min="2" v-model.number="form.intervalSec" class="input" />
            </div>
            <div>
              <label class="label">Scan Times / round</label>
              <input type="number" min="3" v-model.number="form.scanTimes" class="input" />
            </div>
          </div>

          <div class="flex flex-wrap gap-2 pt-2">
            <button class="btn" @click="saveConfig">บันทึกการตั้งค่า (Local)</button>
            <button class="btn-secondary" @click="resetConfig">คืนค่าเริ่มต้น</button>
            <button class="btn" @click="applyToScanner">Apply to Scanner</button>
            <button class="btn-secondary" @click="saveScannerConfig">Save Config on Scanner</button>
            <button class="btn-secondary" :disabled="actionsBusy" @click="scanNearby">Scan Nearby</button>
          </div>
        </div>

        <!-- Nearby results -->
        <div v-if="nearby.length" class="mt-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-medium text-sm text-teal-600">พบอุปกรณ์ใกล้เคียง {{ nearby.length }} ตัว</h3>
            <button class="btn-secondary" :disabled="actionsBusy" @click="nearby=[]">ล้างรายการ</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500">
                <th class="py-1 pr-2">Address</th>
                <th class="py-1 pr-2">Name</th>
                <th class="py-1 pr-2">RSSI</th>
                <th class="py-1 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in nearby" :key="d.address + d.rssi" class="border-t text-red-600">
                  <td class="py-1 pr-2 font-mono">{{ d.address }}</td>
                  <td class="py-1 pr-2">{{ d.name || '-' }}</td>
                  <td class="py-1 pr-2">{{ d.rssi }}</td>
                  <td class="py-1 pr-2">
                    <button class="btn" @click="useBeacon(d)">ใช้ค่านี้</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Status Card -->
        <div class="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 class="font-semibold text-teal-400">สถานะ Scanner</h2>
          <div class="text-sm space-y-1">
            <div class="flex items-center gap-2">
              <span class="badge" :class="scanner.running ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'">
                {{ scanner.running ? 'RUNNING' : 'STOPPED' }}
              </span>
              <span class="text-gray-500">รอบสะสม: {{ scanner.collectRound }}</span>
            </div>
            <div class="text-gray-600">Laptop: {{ scanner.laptopIndex ?? form.laptopIndex }} | Slot: {{ scanner.slot ?? form.slot }}</div>
            <div class="text-gray-600">Interval: {{ scanner.interval ?? form.intervalSec }}s | ScanTimes: {{ scanner.scanTimes ?? form.scanTimes }}</div>
            <div class="text-gray-400 text-xs">อัปเดตล่าสุด: {{ lastStatusAt ? new Date(lastStatusAt).toLocaleString() : '-' }}</div>
          </div>
          <div class="flex gap-2 pt-2">
            <button class="btn w-40" :disabled="actionsBusy" @click="startScanner">Start</button>
            <button class="btn-danger w-full" :disabled="actionsBusy" @click="stopScanner">Stop</button>
          </div>
        </div>
      </div>

          <!-- Recent Records -->
      <div class="bg-white rounded-2xl shadow p-4">
        <h2 class="font-semibold mb-2 text-teal-400">รายการที่บันทึกล่าสุด</h2>
        <div class="overflow-auto max-h-64">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-blue-500">
                <th class="py-1 pr-2">Slot</th>
                <th class="py-1 pr-2">Collect</th>
                <th class="py-1 pr-2">RSSI_1</th>
                <th class="py-1 pr-2">RSSI_2</th>
                <th class="py-1 pr-2">RSSI_3</th>
                <th class="py-1 pr-2">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in recent" :key="r.RecordedAt" class="border-t hover:bg-red-50 text-green-400">
                <td>{{ r.Slot }}</td>
                <td>{{ r.Collect }}</td>
                <td>{{ r.RSSI_1 }}</td>
                <td>{{ r.RSSI_2 }}</td>
                <td>{{ r.RSSI_3 }}</td>
                <td>{{ new Date(r.RecordedAt).toLocaleTimeString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


      <!-- Live Result Card -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-teal-400">ผลการสแกนล่าสุด</h2>
          <div class="flex gap-2">
            <button class="btn-secondary" :disabled="actionsBusy" @click="singleScan">Single Scan</button>
            <button class="btn-secondary" :disabled="!latest.avg || actionsBusy" @click="saveToBackend">ส่งค่าไปบันทึก (positionrecord)</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div class="col-span-1 space-y-2">
            <div class="stat">
              <div class="stat-title">Avg RSSI (trimmed mean)</div>
              <div class="stat-value text-blue-600">{{ latest.avg ?? '—' }}</div>
              <div class="stat-desc">จาก {{ latest.count ?? 0 }} ค่า</div>
            </div>
            <div class="text-xs text-gray-500">หมายเหตุ: ตัด outlier 20% บน–ล่าง ก่อนเฉลี่ย</div>
          </div>

          <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 class="font-medium text-sm text-indigo-600 mb-1">Raw RSSI</h3>
              <div class="codebox">{{ latest.raw?.join(', ') || '—' }}</div>
            </div>
            <div>
              <h3 class="font-medium text-sm text-indigo-600 mb-1">Used for Avg (trimmed)</h3>
              <div class="codebox">{{ latest.used?.join(', ') || '—' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Helper Card -->
      <div class="bg-white rounded-2xl shadow p-4">
        <h2 class="font-semibold text-teal-400 mb-2">Mapping & Helper</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div class="help-card text-amber-600">Slot 1 → A1 (ชั้น 1)</div>
          <div class="help-card text-amber-600">Slot 2 → B1 (ชั้น 1)</div>
          <div class="help-card text-amber-600">Slot 3 → C2 (ชั้น 2)</div>
          <div class="help-card text-amber-600">Slot 4 → D2 (ชั้น 2)</div>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'

// ===== UI helpers =====
const defaultForm = () => ({
  scannerUrl: 'http://localhost:8000',
  backendUrl: 'http://localhost:5000/position',
  laptopIndex: 1,
  slot: 1,
  beaconName: 'IBKS 105 No 1',
  beaconAddress: 'D8:6F:B8:83:E6:55',
  intervalSec: 5,
  scanTimes: 10,
})

const form = reactive({ ...defaultForm(),
  beaconNameCustom: false,
  beaconAddressCustom: false,
})
const scanner = reactive({ running: false, collectRound: 0, laptopIndex: null, slot: null, interval: null, scanTimes: null })
const latest = reactive({ avg: null, raw: [], used: [], count: 0 })
const actionsBusy = ref(false)
const nearby = ref([])
const recent = ref([])
const scanningNearby = ref(false)
const lastStatusAt = ref(null)
let statusTimer = null

// ===== LocalStorage Persist =====
const LS_KEY = 'collect-rssi-config-v2'
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (saved) Object.assign(form, saved)
  } catch {}
}
function saveConfig() {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...form }))
  notify('บันทึกการตั้งค่าแล้ว')
}
function resetConfig() {
  Object.assign(form, defaultForm())
  saveConfig()
}

// ===== Push config to scanner =====
async function applyToScanner() {
  actionsBusy.value = true
  try {
    // Compose payload for scanner /config
    const payload = {
      beacon_address: form.beaconAddress,
      beacon_name: form.beaconName,
      laptop_index: form.laptopIndex,
      slot: form.slot,
      interval_sec: form.intervalSec,
      scan_times: form.scanTimes,
      backend_url: form.backendUrl,
    }
    await fetchJSON(`${form.scannerUrl}/config`, { method: 'POST', body: JSON.stringify(payload) })
    notify('ส่งค่าไปยัง Scanner แล้ว (ยังไม่บันทึกลงไฟล์)')
    await refreshStatus()
  } catch (e) {
    notify('ส่งค่าไปยัง Scanner ไม่สำเร็จ: ' + e.message)
  } finally { actionsBusy.value = false }
}

async function saveScannerConfig() {
  actionsBusy.value = true
  try {
    await fetchJSON(`${form.scannerUrl}/save-config`, { method: 'POST' })
    notify('บันทึก config ลงไฟล์ที่ Scanner เรียบร้อย')
  } catch (e) {
    notify('บันทึก config ลง Scanner ไม่สำเร็จ: ' + e.message)
  } finally { actionsBusy.value = false }
}
// แปลง backendUrl -> api base (เช่น http://localhost:5000)
function getApiBase(){
try{ return new URL(form.backendUrl).origin }catch{ return form.backendUrl.replace(/\/position.*$/,'') }
}

async function loadRecentRecords() {
  try {
    const api = getApiBase()
    const data = await fetchJSON(`${api}/api/positionrecord/recent`)
    recent.value = data || []
  } catch (e) {
    notify('โหลดรายการบันทึกล่าสุดไม่สำเร็จ: ' + e.message)
  }
}


// ===== Notifications (simple) =====
function notify(msg) { console.log(msg) }

// ===== Beacon options (editable list) =====
const beaconOptions = ref([
  { name: 'IBKS 105 No 1', address: 'D8:6F:B8:83:E6:55' },
  { name: 'IBKS 105 No 2', address: 'F7:C4:0B:AE:40:95' },
  { name: 'IBKS 105 No 3', address: 'C2:AE:AB:86:5F:C2' },
  { name: 'IBKS 105 No 4', address: 'D5:99:FB:6D:1C:DA' },
  { name: 'IBKS 105 No 5', address: 'DA:42:A7:22:9F:6B' },
  { name: 'IBKS 105 No 6', address: 'F0:40:4A:49:3E:2D' }
])

function onSelectBeaconByName() {
  if (form.beaconName === '__custom__') { form.beaconNameCustom = true; return }
  const hit = beaconOptions.value.find(b => b.name === form.beaconName)
  if (hit && !form.beaconAddressCustom) form.beaconAddress = hit.address
}

function onSelectBeaconByAddress() {
  if (form.beaconAddress === '__custom__') { form.beaconAddressCustom = true; return }
  const hit = beaconOptions.value.find(b => b.address === form.beaconAddress)
  if (hit && !form.beaconNameCustom) form.beaconName = hit.name
}

function toggleBeaconNameMode() { form.beaconNameCustom = !form.beaconNameCustom }
function toggleBeaconAddressMode() { form.beaconAddressCustom = !form.beaconAddressCustom }

// ใช้ค่าที่เจอจาก Scan Nearby
function useBeacon(item){
  if(!item) return
  form.beaconAddressCustom = false
  form.beaconNameCustom = false
  form.beaconAddress = item.address
  form.beaconName = item.name || form.beaconName
  // เพิ่มเข้า beaconOptions ถ้ายังไม่มี
  const exists = beaconOptions.value.some(b=>b.address===item.address)
  if(!exists){ beaconOptions.value.push({ name: item.name || item.address, address: item.address }) }
  notify('เลือก Beacon จากรายการแล้ว')
}


// ===== API calls =====
async function scanNearby(){
  actionsBusy.value = true
  scanningNearby.value = true
  try{
    const data = await fetchJSON(`${form.scannerUrl}/scan-nearby`)
    // จัดเรียงตาม RSSI จากแรงไปอ่อน
    nearby.value = (data || []).sort((a,b)=> (b?.rssi ?? -999) - (a?.rssi ?? -999))
    notify(`พบอุปกรณ์ ${nearby.value.length} ตัว`)
  }catch(e){
    notify('สแกนรอบๆ ไม่สำเร็จ: ' + e.message)
  }finally{
    actionsBusy.value = false
    scanningNearby.value = false
  }
}

// ===== API calls =====
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function refreshStatus() {
  try {
    const data = await fetchJSON(`${form.scannerUrl}/status`)
    scanner.running = !!data.running
    scanner.collectRound = data.collect_round ?? data.collectRound ?? 0
    scanner.laptopIndex = data.laptop_index ?? data.laptopIndex ?? null
    scanner.slot = data.slot ?? null
    scanner.interval = data.interval ?? null
    scanner.scanTimes = data.scan_times ?? data.scanTimes ?? null
    lastStatusAt.value = Date.now()
  } catch (e) {
    // offline or not started
    scanner.running = false
  }
}

async function startScanner() {
  actionsBusy.value = true
  try {
    // push config to scanner via GET /status read-only; rely on its config.json on that laptop
    await fetchJSON(`${form.scannerUrl}/start`, { method: 'POST' })
    notify('เริ่มทำงานสแกนอัตโนมัติแล้ว')
    await refreshStatus()
  } catch (e) {
    notify('เริ่มสแกนไม่สำเร็จ: ' + e.message)
  } finally { actionsBusy.value = false }
}

async function stopScanner() {
  actionsBusy.value = true
  try {
    await fetchJSON(`${form.scannerUrl}/stop`, { method: 'POST' })
    scanner.collectRound = 0   // reset รอบสะสมในหน้าเว็บ
    notify('หยุดสแกนแล้ว และรีเซ็ตรอบสะสม')
    await refreshStatus()
    await loadRecentRecords()  // โหลดรายการล่าสุดด้วย
  } catch (e) {
    notify('หยุดสแกนไม่สำเร็จ: ' + e.message)
  } finally {
    actionsBusy.value = false
  }
}

// Manual Single Scan (calls /scan on scanner)
async function singleScan() {
  actionsBusy.value = true
  try {
    const q = new URLSearchParams({ address: form.beaconAddress, name: form.beaconName })
    const data = await fetchJSON(`${form.scannerUrl}/scan?${q.toString()}`)
    latest.avg = data.rssi_avg
    latest.raw = data.rssi_values || []
    latest.used = data.used_for_avg || []
    latest.count = data.count || latest.raw.length
  } catch (e) {
    notify('สแกนครั้งเดียวไม่สำเร็จ: ' + e.message)
  } finally { actionsBusy.value = false }
}

// Send to backend /position-record (compose payload from laptopIndex)
async function saveToBackend() {
  if (latest.avg == null) return
    actionsBusy.value = true
  try {
    const payload = {
    slot: form.slot,
    collect: (scanner.collectRound || 0) + 1,
    }
    // ส่งเฉพาะค่าเครื่องที่ใช้งานอยู่เท่านั้น ไม่แตะต้องช่องอื่น
    if (form.laptopIndex === 1) payload.RSSI_1 = latest.avg
    if (form.laptopIndex === 2) payload.RSSI_2 = latest.avg
    if (form.laptopIndex === 3) payload.RSSI_3 = latest.avg


    await fetchJSON(form.backendUrl, { method: 'POST', body: JSON.stringify(payload) })
    notify('ส่งค่าบันทึกสำเร็จ (บันทึกเฉพาะช่องของเครื่องนี้)')
  } catch (e) {
    notify('ส่งค่าบันทึกล้มเหลว: ' + e.message)
  } finally { actionsBusy.value = false }
}

// Timer
onMounted(() => {
  loadConfig()
  refreshStatus()
  loadRecentRecords()
  statusTimer = setInterval(refreshStatus, 2000)
})
onBeforeUnmount(() => {
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<style scoped>
.label { @apply block text-xs font-medium text-gray-600 mb-1; }
.input { @apply w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200; }
.btn { @apply inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition; }
.btn-secondary { @apply inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200 transition; }
.btn-danger { @apply inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 transition; }
.badge { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium; }
.stat { @apply rounded-2xl border border-gray-100 p-4; }
.stat-title { @apply text-sm text-gray-500; }
.stat-value { @apply text-2xl font-semibold; }
.stat-desc { @apply text-xs text-gray-400; }
.codebox { @apply rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-mono text-gray-700 min-h-[48px]; }
.help-card { @apply rounded-xl border border-gray-100 bg-gray-50 p-3; }
</style>
