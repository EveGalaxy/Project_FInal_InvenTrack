<template>
    <nav class="bg-white shadow-md px-6 py-4 flex justify-between items-center">
      <h1 class="text-xl font-bold text-blue-600">INVEN_TRACK</h1>
      <div class="flex items-center gap-4">
        <ul class="flex gap-4">
            <li><RouterLink to="/product-list" class="nav-link text-gray-600 hover:text-blue-600 transition-colors font-medium" exact>🗂 ค้นหาสินค้าและตำแหน่ง</RouterLink></li>
            <li><RouterLink to="/register-products" class="nav-link text-gray-600 hover:text-blue-600 transition-colors font-medium">➕ ลงทะเบียนสินค้า</RouterLink></li>
            <li><RouterLink to="/register-beacon" class="nav-link text-gray-600 hover:text-blue-600 transition-colors font-medium">📡 ติดตั้ง Beacon</RouterLink></li>
            <li><RouterLink to="/collect-rssi" class="nav-link text-gray-600 hover:text-blue-600 transition-colors font-medium">📶 เก็บค่า RSSI</RouterLink></li>
        </ul>

        <button @click="logout" class="text-red-500 font-medium hover:underline">
        🔒 Log Out
        </button>
      </div>
    </nav>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>