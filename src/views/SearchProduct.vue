<template>
    <div class="SearchProduct">
        <h2 class="titleSearch">Search Product</h2>
        <div class="main-search-input">
          <div class="main-search-input-item">
            <input type="text" placeholder="What are you looking for?" value="" fdprocessedid="ea6hnv" style="padding-right: 0px;">
          </div>
          <div class="main-search-input-item-location">
            <div id="autocomplete-container">
              <input id="autocomplete-input" type="text" placeholder="Beacon Type" fdprocessedid="xffmj">
            </div>
          </div>
          <div class="main-search-input-item">
            <select data-placeholder="All Categories" class="chosen-select custom-select" fdprocessedid="d8kc">
              <option>All Categories</option>
              <option>อาหาร</option>
              <option>อุปกรณ์อิเล็กทรอนิกส์</option>
              <option>ของใช้ทั่วไป</option>
            </select>
          </div>
          <a href="#" class="btn main-search-btn btn-radius btn-lg btn-white">
            <span class="btn-inner--text no-underline">Search</span>
          </a>
          </div>
        </div><br>
    <div class="btnunder">
        <button class="productlist" @click="gotoProductList()">แสดงรายการสินค้า</button> 
        <button class="logout" @click="logoutSystem()">Log Out</button> 
    </div>
</template>

<script>
export default {
  data() {
    return {
        imageUrl: require('@/assets/shelves1.jpg'),
    }
  },
  methods: {
    gotoProductList(){
      this.$router.replace('/product-list');
    },
    logoutSystem() {
      this.$router.replace('/login');
    },
  }
}
</script>
