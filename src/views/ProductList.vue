<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8 animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-indigo-600">Find the latest products & locations</h1>
          <p class="text-sm text-gray-500">ค้นหา • ดูรายละเอียด • อัปเดตตำแหน่งล่าสุดด้วยการ Predict</p>
        </div>
      </div>

      <!-- Search / Filters -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="label">ค้นหาสินค้า (ชื่อ / ProductID)</label>
            <input v-model.trim="query" @input="onQueryChange" class="input" placeholder="เช่น น้ำดื่ม หรือ 1,2,.." />
          </div>
          <div class="self-end flex gap-2">
            <button class="btn" @click="searchProducts">ค้นหา</button>
            <button class="btn-secondary" @click="resetFilters">ล้างค่า</button>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-violet-700">ผลการค้นหา ({{ products.length }})</h2>
          <div class="text-xs text-gray-500">ฐานข้อมูล: {{ apiBase }}</div>
        </div>

        <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด…</div>
        <div v-else-if="!products.length" class="text-sm text-gray-400">ยังไม่มีรายการ</div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="p in products"
            :key="p.ProductID || p.id"
            class="rounded-xl border border-gray-200 p-3 hover:shadow cursor-pointer"
            @click="openProduct(p)"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="font-semibold text-teal-400">
                  {{ p.Name || p.name || 'สินค้า #' + (p.ProductID || p.id) }}
                </div>
                <div class="text-xs text-gray-500">
                  ID: {{ p.ProductID || p.id }}
                </div>
                <div class="text-xs text-gray-500" v-if="p.BeaconName || p.beaconName">
                  Beacon: {{ p.BeaconName || p.beaconName }}
                </div>
              </div>
              <div class="text-right">
                <div v-if="p.latest && p.latest.slot" class="text-sm font-medium text-red-300">Slot: {{ p.latest.slot }}</div>
                <div class="text-xs text-gray-500" v-if="p.latest && p.latest.shelfLabel">
                  ชั้น: {{ p.latest.shelfLevel }} • {{ p.latest.shelfLabel }}
                </div>
                <div class="text-[10px] text-gray-400" v-if="p.latest && p.latest.detectedAt">
                  อัปเดต: {{ fmtTime(p.latest.detectedAt) }}
                </div>
              </div>
            </div>
            <div class="mt-2 flex justify-end gap-2">
              <!-- <button class="btn-secondary" @click.stop="openProduct(p)">ดูรายละเอียด</button> -->
              <button class="btn-secondary" @click.stop="openEdit(p)">แก้ไข</button>
              <button class="btn-secondary" @click.stop="deleteProduct(p)">ลบ</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="closeModal"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-[min(92vw,820px)] p-5 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-teal-400">{{ selName }}</h3>
              <div class="text-xs text-gray-500">ProductID: {{ selId }}</div>
              <div class="text-xs text-gray-500">Category: {{ selCat }}</div>
            </div>
            <button class="btn-secondary" @click="closeModal">ปิด</button>
          </div>

          <div class="rounded-xl border border-gray-200 p-3">
            <div class="font-medium mb-2 text-gray-600">Description: {{selDes}}</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-xl border border-gray-200 p-3">
              <div class="font-medium mb-2 text-violet-700">ตำแหน่งล่าสุด</div>
              <div v-if="latest.loading" class="text-sm text-gray-500">กำลังโหลด…</div>
              <template v-else>
                <div class="text-2xl font-semibold text-red-500" v-if="latest.slot">Slot {{ latest.slot }}</div>
                <div class="text-sm text-gray-600" v-if="latest.shelfLabel">
                  ชั้น {{ latest.shelfLevel }} • {{ latest.shelfLabel }}
                </div>
                <div class="text-xs text-gray-400" v-if="latest.detectedAt">
                  อัปเดตล่าสุด: {{ fmtTime(latest.detectedAt) }}
                </div>
                <div class="text-sm text-gray-500" v-if="!latest.slot">ยังไม่เคยบันทึกตำแหน่ง</div>
              </template>
            </div>
            <div class="rounded-xl border border-gray-200 p-3">
              <div class="font-medium mb-2 text-violet-600">อัปเดต/ทำนายตำแหน่งตอนนี้</div>
              <div class="flex flex-wrap gap-2">
                <button class="btn" :disabled="predicting" @click="predictNow">Predict now</button>
                <label class="inline-flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" v-model="autoRefresh" /> Auto refresh ทุก {{ autoRefreshSec }}s
                </label>
              </div>
              <div class="mt-3 text-sm">
                <div class="text-gray-500" v-if="predicting">กำลังคำนวณ…</div>
                <div v-if="predictResult" class="space-y-1">
                  <div class="text-sm text-gray-600">
                    ผลล่าสุด:
                    <b v-if="predictResult.predictedSlot">Slot {{ predictResult.predictedSlot }}</b>
                    <span v-else>— ไม่พบตำแหน่ง</span>
                  </div>
                  <div class="text-xs text-gray-500" v-if="predictResult.shelfLabel">
                    ชั้น {{ predictResult.shelfLevel }} • {{ predictResult.shelfLabel }}
                  </div>
                  <div class="text-xs text-gray-400" v-if="predictResult.distance != null">
                    distance = {{ predictResult.distance?.toFixed?.(2) ?? predictResult.distance }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 p-3">
            <div class="font-medium mb-2 text-red-400">ประวัติการตรวจพบล่าสุด</div>
            <div class="overflow-auto max-h-60">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500">
                    <th class="py-1 pr-2">เวลา</th>
                    <th class="py-1 pr-2">Slot</th>
                    <th class="py-1 pr-2">ชั้น</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="h in history"
                    :key="h.DetectedAt || h.detectedAt"
                    class="border-t text-gray-500"
                  >
                    <td class="py-1 pr-2">{{ fmtTime(h.DetectedAt || h.detectedAt) }}</td>
                    <td class="py-1 pr-2">{{ h.Slot || h.slot }}</td>
                    <td class="py-1 pr-2">{{ h.ShelfLevel || h.shelfLevel }}</td>
                  </tr>
                  <tr v-if="!history.length">
                    <td colspan="3" class="py-2 text-gray-400">— ไม่มีข้อมูล —</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <!-- Edit Modal -->
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="closeEdit()"></div>
          <div class="relative bg-white rounded-2xl shadow-xl w-[min(92vw,720px)] p-5 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-lg font-semibold text-teal-600">แก้ไขสินค้า</h3>
              <div class="text-xs text-gray-500">ProductID: {{ selId }}</div>
            </div>
            <button class="btn-secondary" @click="closeEdit">ปิด</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="label">ชื่อสินค้า (Name)</label>
                <input v-model.trim="editForm.Name" class="input" placeholder="เช่น สินค้า A" />
              </div>
              <div>
                <label class="label">หมวดหมู่ (Category)</label>
                <input v-model.trim="editForm.Category" class="input" placeholder="เช่น อาหาร/อุปกรณ์" />
              </div>
              <div class="md:col-span-2">
                <label class="label">รายละเอียด (Description)</label>
                <textarea v-model.trim="editForm.Description" class="input" rows="3" placeholder="รายละเอียดสินค้า"></textarea>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button class="btn-secondary" @click="closeEdit">ยกเลิก</button>
              <button class="btn" :disabled="savingEdit" @click="submitEdit">บันทึก</button>
            </div>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

let apiBase = 'http://localhost:5000'
try {
  // ตรวจ Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    apiBase = import.meta.env.VITE_API_BASE
  }
  // ตรวจ Vue CLI environment
  else if (typeof process !== 'undefined' && process.env && process.env.VUE_APP_API_BASE) {
    apiBase = process.env.VUE_APP_API_BASE
  }
  // ตรวจ localStorage fallback
  else if (typeof localStorage !== 'undefined' && localStorage.getItem('API_BASE')) {
    apiBase = localStorage.getItem('API_BASE')
  }
} catch (e) {
  console.warn('⚠️ Fallback to default API base:', e)
}

const query = ref('')
const products = ref([])
const loading = ref(false)
const showModal = ref(false)
const selId = ref(null)
const selName = ref('')
const selCat = ref('')
const selDes = ref('')
const latest = reactive({ loading: false, slot: null, shelfLabel: null, shelfLevel: null, detectedAt: null })
const history = ref([])
const predicting = ref(false)
const predictResult = ref(null)
const autoRefresh = ref(false)
const autoRefreshSec = 8
let autoTimer = null

// === Helper ===
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
function fmtTime(t) {
  try { return new Date(t).toLocaleString() } catch { return t }
}
let qTimer = null
function onQueryChange() {
  clearTimeout(qTimer)
  qTimer = setTimeout(searchProducts, 300)
}
function resetFilters() {
  query.value = ''
  searchProducts()
}

// === API ===
async function searchProducts() {
  loading.value = true
  try {
    const url = `${apiBase}/api/products-with-latest${query.value ? `?q=${encodeURIComponent(query.value)}` : ''}`
    const rows = await fetchJSON(url)

    // map ผลรวมเป็นรูปแบบเดิมที่ UI ใช้
    products.value = rows.map(r => ({
      ...r,
      latest: (r.latestSlot || r.latestDetectedAt) ? {
        slot: r.latestSlot,
        shelfLevel: r.latestShelfLevel,
        shelfLabel: r.latestShelfLabel,
        detectedAt: r.latestDetectedAt,
      } : null
    }))
  } catch (e) {
    console.error(e)
    products.value = []
  } finally {
    loading.value = false
  }
}

async function loadLatestPosition(productId) {
  latest.loading = true
  try {
    const loc = await fetchJSON(`${apiBase}/api/product-location/${productId}/latest`)
    latest.slot = loc?.slot ?? loc?.Slot ?? null
    latest.shelfLabel = loc?.shelfLabel ?? null
    latest.shelfLevel = loc?.shelfLevel ?? null
    latest.detectedAt = loc?.detectedAt ?? loc?.DetectedAt ?? null
  } catch {
    latest.slot = null; latest.shelfLabel = null; latest.shelfLevel = null; latest.detectedAt = null
  } finally { latest.loading = false }
}

async function loadHistory(productId) {
  try {
    const rows = await fetchJSON(`${apiBase}/api/product-location/${productId}?limit=20`)
    history.value = rows || []
  } catch { history.value = [] }
}

async function predictNow() {
  if (!selId.value) return
  predicting.value = true
  try {
    predictResult.value = await fetchJSON(`${apiBase}/predict-slot/${selId.value}`, { method: 'POST' })
    await loadLatestPosition(selId.value)
    await loadHistory(selId.value)
  } catch (e) { console.error(e) }
  finally { predicting.value = false }
}

function openProduct(p) {
  selId.value = p.ProductID || p.id
  selName.value = p.Name || p.name || `สินค้า #${selId.value}`
  selCat.value = p.Category
  selDes.value = p.Description
  showModal.value = true
  predictResult.value = null
  loadLatestPosition(selId.value)
  loadHistory(selId.value)
  setupAuto()
}
function closeModal() {
  showModal.value = false
  clearInterval(autoTimer)
  window.location.reload();
}
function setupAuto() {
  clearInterval(autoTimer)
  if (autoRefresh.value) {
    autoTimer = setInterval(() => { predictNow() }, autoRefreshSec * 1000)
  }
}

// ====== Edit/Delete state & methods ======
const showEditModal = ref(false)
const savingEdit = ref(false)
const editForm = reactive({ Name: '', Category: '', Description: '' })
const originalEdit = reactive({ Name: '', Category: '', Description: '' })

function openEdit(p){
  selId.value = p.ProductID || p.id
  // อ่านให้ครอบคลุมชื่อฟิลด์ทุกรูปแบบที่อาจมาได้
  const Name = p.Name ?? p.ProductName ?? p.name ?? ''
  const Category = p.Category ?? ''
  const Description = p.Description ?? ''

  editForm.Name = Name
  editForm.Category = Category
  editForm.Description = Description

  // เก็บค่าเดิม
  originalEdit.Name = Name
  originalEdit.Category = Category
  originalEdit.Description = Description

  showEditModal.value = true
}

function closeEdit(){ showEditModal.value = false }

async function submitEdit(){
  if(!selId.value) return
  savingEdit.value = true
  try{
    const payload = {}

    // ส่งเฉพาะฟิลด์ที่ไม่ใช่ค่าว่าง และต่างจากค่าเดิม
    ;['Name','Category','Description'].forEach(k => {
      const v = editForm[k]
      if (v != null && v !== '' && v !== originalEdit[k]) {
        payload[k] = v
      }
    })

    // ถ้าไม่มีอะไรเปลี่ยนก็ปิดเลย
    if (Object.keys(payload).length === 0) {
      closeEdit()
      return
    }

    await fetchJSON(`${apiBase}/api/products/${selId.value}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    closeEdit()
    await searchProducts()
  } catch(e) {
    console.error('❌ แก้ไขสินค้าไม่สำเร็จ', e)
  } finally { savingEdit.value = false }
}

async function deleteProduct(p){
  const id = p.ProductID || p.id
  if(!id) return
  if(!confirm(`ยืนยันลบสินค้า #${id}?`)) return
  try{
      const url = `${apiBase}/api/products/${id}`
      await fetchJSON(url, { method: 'DELETE' })
      await searchProducts()
      console.log('🗑️ ลบสินค้าเรียบร้อย')
  }catch(e){ console.error('❌ ลบสินค้าไม่สำเร็จ', e) }
}



onMounted(() => { searchProducts() })
onBeforeUnmount(() => { clearInterval(autoTimer) })
</script>

<style scoped>
.label { @apply block text-xs font-medium text-gray-600 mb-1; }
.input { @apply w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200; }
.btn { @apply inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition; }
.btn-secondary { @apply inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200 transition; }
</style>
