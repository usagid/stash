<script setup lang="ts">
const { theme, syncFromStorage } = useTheme()

syncFromStorage()

useHead({
  htmlAttrs: {
    class: computed(() => (theme.value === 'dark' ? 'dark' : ''))
  }
})
</script>

<template>
  <main>
    <NuxtPage />
    <ThemeToggle />
  </main>
</template>
