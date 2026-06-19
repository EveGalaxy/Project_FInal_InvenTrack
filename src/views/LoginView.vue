<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300">
    <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
      <h2 class="text-3xl font-bold text-center text-blue-700 mb-6">🔎 INVEN_TRACK 📦</h2>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            id="username"
            v-model="username"
            required
            class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            required
            class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
          <p v-if="errorMessage" class="mt-2 text-sm text-red-500">{{ errorMessage }}</p>
        </div>

        <div class="flex justify-between gap-3">
          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all"
          >
            Login
          </button>

          <RouterLink to="/sign-up" class="w-full">
            <button
              type="button"
              class="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition-all"
            >
              Sign Up
            </button>
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}
</style>


<script>
import axios from 'axios';
export default {
  data() {
    return {
        imageUrl: require('@/assets/duck-logo.webp'),
        username: "",
        password: "",
        errorMessage: ''
    }
  },
  methods: {
    async handleLogin() {
  
      try {
        const res = await axios.post('http://localhost:5000/api/auth/login', {
          username: this.username,
          password: this.password
        });
  
        localStorage.setItem('token', res.data.token);

        this.$router.push('/product-list');
      } catch (err) {
        this.errorMessage = err.response?.data?.error || "An unexpected error occurred";
      }
    }
  }
};
</script>
