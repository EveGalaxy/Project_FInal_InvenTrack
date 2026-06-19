<template>
  <div>
    <NavBar v-if="showNavbar" />
    <RouterView />
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// ไม่แสดง Navbar ในหน้า Login
const showNavbar = computed(() => route.path !== '/login')
</script>
