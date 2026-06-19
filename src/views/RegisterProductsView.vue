<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8 animate-fade-in p-6 max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-indigo-600">RegisterProducts with Beacon</h1>
          <p class="text-sm text-gray-500">สร้าง/แก้ไขสินค้า และเลือก Beacon ที่บันทึกไว้ในฐานข้อมูลมาผูกกับสินค้า</p>
        </div>
      </div>

      <!-- Product Form -->
      <div class="bg-white rounded-2xl shadow p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-teal-600">ฟอร์มสินค้า</h2>
          <div class="text-xs text-gray-500">API: {{ apiBase }}</div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="label">ชื่อสินค้า (Name)</label>
            <input v-model.trim="form.Name" class="input" placeholder="เช่น น้ำดื่ม 350ml" />
          </div>
          <div>
            <label class="label">หมวดหมู่ (Category)</label>
            <input v-model.trim="form.Category" class="input" placeholder="เช่น เครื่องดื่ม" />
          </div>
          <div class="md:col-span-2">
            <label class="label">รายละเอียด (Description)</label>
            <textarea v-model.trim="form.Description" class="input" rows="3" placeholder="รายละเอียดสินค้า"></textarea>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="label">เลือก Beacon ที่จะผูก (จำเป็น)</label>
            <div class="flex gap-2">
              <select v-model.number="form.BeaconID" class="input">
                <option :value="null">— เลือก Beacon —</option>
                <option v-for="b in beacons" :key="b.BeaconID" :value="b.BeaconID">
                  {{ b.BeaconName }} — {{ b.Address }}
                </option>
              </select>
              <button class="btn-secondary" @click="reloadBeacons">รีเฟรช Beacon</button>
            </div>
            <div class="text-xs text-gray-500 mt-1">* Beacon มาจากตาราง <code>beacon</code> (จัดการได้ที่หน้า ลงทะเบียน Beacon)</div>
          </div>
          <div>
            <label class="label">โหมด</label>
            <div class="flex gap-2">
              <button class="btn" :disabled="busy" @click="submitProduct">{{ form.ProductID? 'บันทึกการแก้ไข':'บันทึกสินค้าใหม่' }}</button>
              <button class="btn-secondary" :disabled="busy" @click="resetForm">ล้างฟอร์ม</button>
            </div>
          </div>
        </div>

        <div class="text-xs text-gray-500" v-if="form.ProductID">กำลังแก้ไขสินค้า ID: {{ form.ProductID }}</div>
      </div>

      <!-- Products List -->
      <div class="bg-white rounded-2xl shadow p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-blue-600">รายการสินค้า ({{ products.length }})</h2>
          <div class="flex items-center gap-2">
            <input v-model.trim="query" @input="onQueryChange" class="input" placeholder="ค้นหา (ชื่อ / หมวดหมู่ / คำอธิบาย / ID)" />
            <button class="btn-secondary" @click="searchProducts">ค้นหา</button>
          </div>
        </div>

        <div v-if="loading" class="text-sm text-gray-500">กำลังโหลด…</div>
        <div v-else-if="!products.length" class="text-sm text-gray-400">ยังไม่มีสินค้า</div>

        <div class="overflow-auto">
          <table class="w-full text-sm min-w-[820px]">
            <thead>
              <tr class="text-left text-gray-500 border-b">
                <th class="py-2 pr-3">ProductID</th>
                <th class="py-2 pr-3">Name</th>
                <th class="py-2 pr-3">Category</th>
                <th class="py-2 pr-3">Beacon</th>
                <th class="py-2 pr-3">MAC</th>
                <th class="py-2 pr-3">การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in products" :key="p.ProductID" class="border-b text-teal-400 hover:bg-gray-50">
                <td class="py-1 pr-3">{{ p.ProductID }}</td>
                <td class="py-1 pr-3">{{ p.Name }}</td>
                <td class="py-1 pr-3">{{ p.Category }}</td>
                <td class="py-1 pr-3">{{ p.BeaconName || '—' }}</td>
                <td class="py-1 pr-3 font-mono">{{ p.Address || '—' }}</td>
                <td class="py-1 pr-3">
                  <div class="flex gap-2">
                    <button class="btn-secondary" @click="fillForEdit(p)">แก้ไข</button>
                    <button class="btn-secondary" @click="unlinkBeacon(p)" :disabled="!p.BeaconID">ยกเลิกผูก</button>
                    <button class="btn-secondary" @click="deleteProduct(p)">ลบ</button>
                  </div>
                </td>
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

// ===== API Base (ปลอดภัยทั้ง Vite/Vue-CLI/LocalStorage) =====
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
const busy = ref(false)
const query = ref('')
const loading = ref(false)
const products = ref([])
const beacons = ref([])

const form = reactive({
  ProductID: null,
  Name: '',
  Category: '',
  Description: '',
  BeaconID: null,
})

// ===== Helpers =====
async function fetchJSON(url, opts={}){
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts })
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
function notify(x){ console.log(x) }
let qTimer=null
function onQueryChange(){ clearTimeout(qTimer); qTimer = setTimeout(searchProducts, 300) }

// ===== Loaders =====
async function reloadBeacons(){
  try{ beacons.value = await fetchJSON(`${apiBase}/api/beacons`) }
  catch(e){ beacons.value = []; notify('โหลด Beacon ไม่สำเร็จ: ' + e.message) }
}

async function searchProducts(){
  loading.value = true
  try{
    const url = `${apiBase}/api/products${query.value?`?q=${encodeURIComponent(query.value)}`:''}`
    products.value = await fetchJSON(url)
  }catch(e){ products.value = []; notify('โหลดสินค้าไม่สำเร็จ: ' + e.message) }
  finally{ loading.value = false }
}

// ===== Form Ops =====
function resetForm(){
  form.ProductID = null
  form.Name = ''
  form.Category = ''
  form.Description = ''
  form.BeaconID = null
}

function fillForEdit(p){
  form.ProductID = p.ProductID
  form.Name = p.Name || ''
  form.Category = p.Category || ''
  form.Description = p.Description || ''
  form.BeaconID = p.BeaconID ?? null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function submitProduct(){
  if(!form.Name?.trim()) return alert('กรุณากรอกชื่อสินค้า')
  if(!form.BeaconID) return alert('กรุณาเลือก Beacon ที่จะผูก')

  busy.value = true
  try{
    // 1) create or update product
    let productId = form.ProductID
    if(productId){
      await fetchJSON(`${apiBase}/api/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ Name: form.Name, Category: form.Category, Description: form.Description })
      })
    } else {
      const r = await fetchJSON(`${apiBase}/api/products`, {
        method: 'POST',
        body: JSON.stringify({ Name: form.Name, Category: form.Category, Description: form.Description })
      })
      productId = r.insertedId || r.ProductID || r.id
    }

    if(!productId) throw new Error('ไม่ทราบรหัสสินค้า (ProductID) จากการบันทึก')

    // 2) link product ↔ beacon (upsert)
    // รองรับ 2 รูปแบบ endpoint: (เลือกอันที่คุณมี)
    // A) POST /api/product-beacon { productId, beaconId }
    // B) POST /api/product-beacon/link { productId, beaconId }
    let linkOk = false
    try{
      await fetchJSON(`${apiBase}/api/product-beacon`, { method:'POST', body: JSON.stringify({ productId, beaconId: form.BeaconID }) })
      linkOk = true
    }catch(e){
      // fallback path B
      await fetchJSON(`${apiBase}/api/product-beacon/link`, { method:'POST', body: JSON.stringify({ productId, beaconId: form.BeaconID }) })
      linkOk = true
    }

    if(!linkOk) throw new Error('เชื่อมโยงสินค้า-บีคอนไม่สำเร็จ')

    notify('บันทึกสินค้าและผูก Beacon สำเร็จ')
    resetForm()
    await Promise.all([searchProducts(), reloadBeacons()])
  }catch(e){
    notify('บันทึกไม่สำเร็จ: ' + e.message)
  }finally{ busy.value = false }
}

async function unlinkBeacon(p){
  if(!p?.ProductID || !p?.BeaconID) return
  if(!confirm(`ยืนยันยกเลิกการผูก Beacon ของสินค้า #${p.ProductID}?`)) return

  // รองรับ 2 รูปแบบ DELETE
  try{
    await fetchJSON(`${apiBase}/api/product-beacon/${p.ProductID}/${p.BeaconID}`, { method:'DELETE' })
  }catch{
    await fetchJSON(`${apiBase}/api/product-beacon`, { method:'DELETE', body: JSON.stringify({ productId: p.ProductID, beaconId: p.BeaconID }) })
  }
  await searchProducts()
}

async function deleteProduct(p){
  if(!confirm(`ยืนยันลบสินค้า #${p.ProductID}?`)) return
  try{
    await fetchJSON(`${apiBase}/api/products/${p.ProductID}`, { method:'DELETE' })
    await searchProducts()
  }catch(e){ notify('ลบสินค้าไม่สำเร็จ: ' + e.message) }
}

onMounted(()=>{ reloadBeacons(); searchProducts(); })
</script>

<style scoped>
.label { @apply block text-xs font-medium text-gray-600 mb-1; }
.input { @apply w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200; }
.btn { @apply inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition; }
.btn-secondary { @apply inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200 transition; }
</style>
