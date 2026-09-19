<script setup lang="ts">
interface Props {
  lang?: string
  theme?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'plaintext',
  theme: undefined,
  placeholder: undefined,
  rows: 10,
  disabled: false,
  readonly: false,
})

// Works both with and without a parent v-model: falls back to local state
// when the parent doesn't bind modelValue.
const modelValueProxy = defineModel<string>({ default: '' })

const inputRef = ref()
const highlightRef = ref<HTMLElement>()
const hasSelection = ref(false)

// Shiki needs the trailing newline to render a final empty line,
// keeping the overlay's line count aligned with the textarea.
const code = computed(() => `${modelValueProxy.value}\n`)

// Follows the app-wide theme toggle unless a theme is explicitly given.
const { theme: appTheme } = useTheme()
const shikiTheme = computed(() => props.theme ?? (appTheme.value === 'light' ? 'min-light' : 'min-dark'))

const highlightOptions = {
  lang: props.lang,
  theme: shikiTheme.value,
  unwrap: true,
}

const highlighted = await useShikiHighlighted(code, highlightOptions)

function getTextarea() {
  return inputRef.value?.textarea as HTMLTextAreaElement | undefined
}

function syncScroll() {
  const textarea = getTextarea()
  if (!textarea || !highlightRef.value) return
  highlightRef.value.scrollTop = textarea.scrollTop
  highlightRef.value.scrollLeft = textarea.scrollLeft
}

function updateSelection() {
  const textarea = getTextarea()
  hasSelection.value = !!textarea && textarea.selectionStart !== textarea.selectionEnd
}

watch(code, () => nextTick(syncScroll))

onMounted(() => {
  getTextarea()?.addEventListener('scroll', syncScroll)
})

onBeforeUnmount(() => {
  getTextarea()?.removeEventListener('scroll', syncScroll)
})
</script>

<template>
  <div class="code-input" :class="{ 'is-disabled': disabled, 'is-readonly': readonly, 'is-plaintext': lang === 'plaintext', 'is-selecting': hasSelection }">
    <div ref="highlightRef" class="code-input__highlight" aria-hidden="true" v-html="highlighted" />
    <el-input
      v-if="!readonly"
      ref="inputRef"
      v-model="modelValueProxy"
      type="textarea"
      class="code-input__textarea"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      resize="none"
      wrap="off"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      @input="syncScroll"
      @select="updateSelection"
      @keyup="updateSelection"
      @mouseup="updateSelection"
    />
  </div>
</template>

<style lang="scss" scoped>
.code-input {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  font-family: 'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;

  &__highlight,
  :deep(.el-textarea__inner) {
    margin: 0;
    width: 100%;
    height: 100%;
    padding: 5px 11px;
    font-family: 'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    white-space: pre;
    tab-size: 2;
    border: 1px solid transparent;
    border-radius: var(--el-input-border-radius, 4px);
    box-sizing: border-box;
  }

  &__highlight {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: auto;
    pointer-events: none;
    background: transparent;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    :deep(pre),
    :deep(code),
    :deep(span) {
      margin: 0;
      padding: 0;
      background: transparent !important;
      white-space: inherit;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }
  }

  &__textarea {
    position: relative;
    z-index: 2;
    display: block;
    width: 100%;
    height: 100%;

    :deep(.el-textarea__inner) {
      color: transparent;
      background: transparent;
      caret-color: var(--el-text-color-primary, #f5f5f5);
      -webkit-text-fill-color: transparent;
      box-shadow: none;

      &::selection {
        color: transparent;
        background: var(--el-color-primary-light-5);
        -webkit-text-fill-color: transparent;
      }
      resize: none;
    }
  }

  &.is-selecting:not(.is-plaintext) {
    .code-input__highlight {
      visibility: hidden;
    }

    :deep(.el-textarea__inner) {
      color: var(--el-text-color-primary);
      -webkit-text-fill-color: var(--el-text-color-primary);
    }
  }

  &.is-plaintext:not(.is-readonly) {
    .code-input__highlight {
      display: none;
    }

    :deep(.el-textarea__inner) {
      color: var(--el-text-color-primary);
      -webkit-text-fill-color: var(--el-text-color-primary);
    }
  }

  &.is-readonly {
    .code-input__highlight {
      position: relative;
      inset: auto;
      z-index: 1;
      min-height: 100%;
      overflow: auto;
      pointer-events: auto;
      cursor: text;
      opacity: 1;
    }
  }

  &.is-disabled &__highlight {
    opacity: 0.6;
  }
}
</style>
