<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8 animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-indigo-600">Register Beacon</h1>
          <p class="text-sm text-gray-500">สแกนหา Beacon รอบตัว • เลือก • บันทึกลงฐานข้อมูล</p>
        </div>
      </div>

      <!-- Scanner & API Config -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="label">Scanner URL (Flask)</label>
            <input v-model.trim="scannerUrl" class="input" placeholder="http://localhost:8000" />
          </div>
          <div class="md:col-span-2 flex items-end gap-2">
            <button class="btn" :disabled="busy" @click="scanNearby">สแกนรอบๆ (Scan Nearby)</button>
            <button class="btn-secondary" :disabled="busy" @click="reloadFromDb">โหลดจากฐานข้อมูล</button>
            <span class="text-xs text-gray-500" v-if="apiBase">API: {{ apiBase }}</span>
          </div>
        </div>
      </div>

      <!-- Nearby Results + Pick to form -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-blue-600">Beacon รอบๆ ({{ nearby.length }})</h2>
          <div class="text-xs text-gray-500">คลิกหนึ่งแถวเพื่อเติมเข้าฟอร์ม</div>
        </div>
        <div class="overflow-auto mt-3">
          <table class="w-full text-sm min-w-[680px]">
            <thead>
              <tr class="text-left text-teal-500">
                <th class="py-1 pr-3">MAC</th>
                <th class="py-1 pr-3">ชื่ออุปกรณ์</th>
                <th class="py-1 pr-3">RSSI</th>
                <th class="py-1 pr-3">เลือก</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in nearby" :key="d.address + (d.name||'')" class="border-t text-orange-300 hover:bg-gray-50">
                <td class="py-1 pr-3 font-mono">{{ d.address }}</td>
                <td class="py-1 pr-3">{{ d.name || '—' }}</td>
                <td class="py-1 pr-3">{{ d.rssi ?? '—' }}</td>
                <td class="py-1 pr-3">
                  <button class="btn-secondary" @click="pickToForm(d)">เลือก</button>
                </td>
              </tr>
              <tr v-if="!nearby.length">
                <td colspan="5" class="py-2 text-gray-400">— ยังไม่มีผลสแกน —</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Register / Edit Form -->
      <div class="bg-white rounded-2xl shadow p-4">
        <h2 class="font-semibold mb-2 text-blue-600">ฟอร์มลงทะเบียน Beacon</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="label">Beacon Name</label>
            <input v-model.trim="form.BeaconName" class="input" placeholder="เช่น IBKS 105 No 1" />
          </div>
          <div>
            <label class="label">MAC Address</label>
            <input v-model.trim="form.Address" class="input font-mono" placeholder="D8:6F:B8:83:E6:55" />
            <div class="text-[11px] text-gray-500 mt-1">รูปแบบ: 6 กลุ่มตัวอักษรฐาน 16 คั่นด้วย ":"</div>
          </div>
          <div>
            <label class="label">Major (optional)</label>
            <input v-model.number="form.Major" type="number" class="input" placeholder="เช่น 2" />
          </div>
          <div>
            <label class="label">Minor (optional)</label>
            <input v-model.number="form.Minor" type="number" class="input" placeholder="เช่น 21" />
          </div>
        </div>
        <div class="flex gap-2 pt-3">
          <button class="btn" :disabled="busy" @click="saveBeacon">บันทึก</button>
          <button class="btn-secondary" :disabled="busy" @click="resetForm">ล้างฟอร์ม</button>
        </div>
      </div>

      <!-- DB List -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-blue-600">รายการ Beacon ในฐานข้อมูล ({{ beacons.length }})</h2>
          <div class="text-xs text-gray-500">คลิก "แก้ไข" เพื่อเติมค่าลงฟอร์ม</div>
        </div>
        <div class="overflow-auto mt-2">
          <table class="w-full text-sm min-w-[720px]">
            <thead>
              <tr class="text-left text-gray-500">
                <th class="py-1 pr-3">BeaconID</th>
                <th class="py-1 pr-3">Name</th>
                <th class="py-1 pr-3">MAC</th>
                <th class="py-1 pr-3">Major</th>
                <th class="py-1 pr-3">Minor</th>
                <th class="py-1 pr-3">การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in beacons" :key="b.BeaconID" class="border-t text-teal-400 hover:bg-gray-50">
                <td class="py-1 pr-3">{{ b.BeaconID }}</td>
                <td class="py-1 pr-3">{{ b.BeaconName }}</td>
                <td class="py-1 pr-3 font-mono">{{ b.Address }}</td>
                <td class="py-1 pr-3">{{ b.Major ?? '—' }}</td>
                <td class="py-1 pr-3">{{ b.Minor ?? '—' }}</td>
                <td class="py-1 pr-3">
                  <div class="flex gap-2">
                    <button class="btn-secondary" @click="fillFromDb(b)">แก้ไข</button>
                    <button class="btn-secondary" @click="removeBeacon(b)">ลบ</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!beacons.length">
                <td colspan="6" class="py-2 text-gray-400">— ยังไม่มี beacon ในฐานข้อมูล —</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// ===== API Base (Vite / Vue-CLI / LocalStorage) =====
let apiBase = 'http://localhost:5000'
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    apiBase = import.meta.env.VITE_API_BASE
  } else if (typeof process !== 'undefined' && process.env && process.env.VUE_APP_API_BASE) {
    apiBase = process.env.VUE_APP_API_BASE
  } else if (typeof localStorage !== 'undefined' && localStorage.getItem('API_BASE')) {
    apiBase = localStorage.getItem('API_BASE')
  }
} catch {}

// ===== State =====
const scannerUrl = ref('http://localhost:8000')
const nearby = ref([])
const beacons = ref([])
const busy = ref(false)

const form = reactive({
  BeaconID: null,
  BeaconName: '',
  Address: '',
  Major: null,
  Minor: null,
})

// ===== Helpers =====
function notify(x){ console.log(x) }
function isValidMac(addr){
  return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(addr || '')
}
async function fetchJSON(url, opts={}){
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts })
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ===== Actions: Scan / Load DB =====
async function scanNearby(){
  busy.value = true
  try{
    const rows = await fetchJSON(`${scannerUrl.value}/scan-nearby`)
    // คาดว่าฝั่ง Flask คืน [{address, name, rssi, count}] หรืออย่างน้อย address/name
    nearby.value = (rows||[]).sort((a,b)=> (b?.rssi ?? -999) - (a?.rssi ?? -999))
    notify(`พบอุปกรณ์ ${nearby.value.length} ตัว`)
  }catch(e){ notify('สแกนไม่สำเร็จ: ' + e.message) }
  finally{ busy.value = false }
}

async function reloadFromDb(){
  try {
    beacons.value = await fetchJSON(`${apiBase}/api/beacons`)
  } catch(e) {
    notify('โหลดจากฐานข้อมูลไม่สำเร็จ: ' + e.message)
    beacons.value = []
  }
}

// ===== Form helpers =====
function pickToForm(d){
  if(d?.address) form.Address = d.address.toUpperCase()
  if(d?.name) form.BeaconName = d.name
}
function fillFromDb(b){
  form.BeaconID = b.BeaconID
  form.BeaconName = b.BeaconName || ''
  form.Address = (b.Address || '').toUpperCase()
  form.Major = b.Major ?? null
  form.Minor = b.Minor ?? null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function resetForm(){
  form.BeaconID = null
  form.BeaconName = ''
  form.Address = ''
  form.Major = null
  form.Minor = null
}

// ===== Save / Update / Delete =====
async function saveBeacon(){
  if(!form.BeaconName?.trim()) return alert('กรุณากรอก Beacon Name')
  if(!isValidMac(form.Address)) return alert('รูปแบบ MAC ไม่ถูกต้อง')

  const payload = {
    BeaconName: form.BeaconName.trim(),
    Address: form.Address.toUpperCase(),
    Major: form.Major ?? null,
    Minor: form.Minor ?? null,
  }

  busy.value = true
  try{
    if(form.BeaconID){
      // UPDATE
      await fetchJSON(`${apiBase}/api/beacons/${form.BeaconID}`, { method:'PUT', body: JSON.stringify(payload) })
      notify('อัปเดตสำเร็จ')
    } else {
      // CREATE
      await fetchJSON(`${apiBase}/api/beacons`, { method:'POST', body: JSON.stringify(payload) })
      notify('บันทึกสำเร็จ')
    }
    resetForm()
    await reloadFromDb()
  }catch(e){ notify('บันทึกล้มเหลว: ' + e.message) }
  finally{ busy.value = false }
}

async function removeBeacon(b){
  if(!confirm(`ยืนยันลบ Beacon #${b.BeaconID} ?`)) return
  try{
    await fetchJSON(`${apiBase}/api/beacons/${b.BeaconID}`, { method:'DELETE' })
    await reloadFromDb()
    notify('ลบสำเร็จ')
  }catch(e){ notify('ลบไม่สำเร็จ: ' + e.message) }
}

onMounted(()=>{
  reloadFromDb()
})
</script>

<style scoped>
.label { @apply block text-xs font-medium text-gray-600 mb-1; }
.input { @apply w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200; }
.btn { @apply inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition; }
.btn-secondary { @apply inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200 transition; }
</style>
