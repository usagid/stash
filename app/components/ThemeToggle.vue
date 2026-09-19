<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'

const { theme, toggle } = useTheme()
</script>

<template>
  <div class="theme-toggle">
    <el-switch
      :model-value="theme === 'dark'"
      inline-prompt
      :active-icon="Moon"
      :inactive-icon="Sunny"
      @change="toggle"
    />
  </div>
</template>

<style scoped lang="scss">
.theme-toggle {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 50;
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  box-shadow: var(--el-box-shadow-lighter);
}
</style>
