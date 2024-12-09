
<template>
  <div class="app-container">
    <router-view/>
  </div>
</template>
<script setup>
</script>
<style scoped>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app-container {
  height: 100vh;
  width: 100vw;
}
</style>
