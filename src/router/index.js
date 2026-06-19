import { createRouter, createWebHistory } from 'vue-router'
import BeaconView from '@/views/BeaconView.vue'
import LoginView from '@/views/LoginView.vue'
import ProductList from '@/views/ProductList.vue'
import SearchProduct from '@/views/SearchProduct.vue'
import SignUpView from '@/views/SignUpView.vue'
import CollectRssi from '@/views/CollectRssi.vue'
import RegisterProductsView from '@/views/RegisterProductsView.vue'

const routes = [

  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: SignUpView,
  },
  {
    path: '/product-list',
    name: 'product-list',
    component: ProductList,
  },
  {
    path: '/register-products',
    name: 'product',
    component: RegisterProductsView,
  },
  {
    path: '/register-beacon',
    name: 'beacon',
    component: BeaconView
  },
  {
    path: '/collect-rssi',
    name: 'collect-rssi',
    component: CollectRssi
  },
  {
    path: '/search-product',
    name: 'search-product',
    component: SearchProduct,
  },
  {
    path: '/', 
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  const publicPages = ['/login', '/sign-up']
  const authRequired = !publicPages.includes(to.path)

  if (authRequired && !token) {
    next('/login') // ❌ ไม่ได้ login → ไป login
  } else if (to.path === '/login' && token) {
    next('/product-list') // ✅ login แล้ว → ไม่ต้องกลับไป login ซ้ำ
  } else {
    next() // ✅ ผ่านได้
  }
})



export default router
