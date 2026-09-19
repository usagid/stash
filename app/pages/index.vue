<script setup lang="ts">
import { bundledLanguagesInfo } from 'shiki/langs'
import { reactive } from 'vue'

const code = ref('')
const { theme } = useTheme()

useHead({
  title: 'new',
})

const formatOptions = [
  { label: 'Plain text', value: 'plaintext' },
  ...bundledLanguagesInfo.map(language => ({
    label: language.name,
    value: language.id
  }))
]

const encryptionOptions = [
  { label: 'AES-256-GCM (recommended)', value: 'AES-256-GCM' },
  { label: 'AES-128-GCM', value: 'AES-128-GCM' },
]

const expirationOptions = [
  { label: 'Never', value: 'never' },
  { label: '5 minutes', value: '300' },
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '1 day', value: '86400' },
  { label: '1 week', value: '604800' },
  { label: '1 month', value: '2592000' },
  { label: '1 year', value: '31536000' },
]

const fieldTypeOptions = [
  { label: 'Text', value: 'text' },
  { label: 'Secret', value: 'secret' },
]

type FieldType = 'text' | 'secret'

interface FormField {
  id: number
  title: string
  value: string
  type: FieldType
}

const form = reactive({
  type: 'text',
  format: 'plaintext',
  encryption: 'AES-256-GCM' as 'AES-256-GCM' | 'AES-128-GCM',
  password: '',
  burn: false,
  expiration: '86400',
})

const formFields = ref<FormField[]>([])
const nextFieldId = ref(1)
const isSubmitting = ref(false)
const submitError = ref('')
const createdUrl = ref('')
const copiedUrl = ref(false)
const createdUrlInput = ref()
const fieldDraft = reactive({
  title: '',
  value: '',
  type: 'text' as FieldType,
})

const addField = () => {
  const title = fieldDraft.title.trim()
  if (!title || !fieldDraft.value.trim()) return

  formFields.value.push({
    id: nextFieldId.value++,
    title,
    value: fieldDraft.value,
    type: fieldDraft.type,
  })
  fieldDraft.title = ''
  fieldDraft.value = ''
  fieldDraft.type = 'text'
}

const removeField = (id: number) => {
  formFields.value = formFields.value.filter(field => field.id !== id)
}

const onSubmit = async () => {
  if (isSubmitting.value) return

  submitError.value = ''
  isSubmitting.value = true
  try {
    const payload = form.type === 'form'
      ? { version: 1, type: 'form' as const, fields: formFields.value }
      : { version: 1, type: 'text' as const, format: form.format, content: code.value }
    const { envelope, fragmentKey } = await encryptStash(payload, form.password, form.encryption)
    const expiresAt = form.expiration === 'never'
      ? null
      : Date.now() + Number(form.expiration) * 1000
    const result = await $fetch<{ id: string }>('/api/stashes', {
      method: 'POST',
      body: {
        envelope,
        expiresAt,
        burnAfterReading: form.burn,
      },
    })

    createdUrl.value = `${window.location.origin}/${result.id}${fragmentKey ? `#${fragmentKey}` : ''}`
    await nextTick()
    const urlInput = createdUrlInput.value?.input as HTMLInputElement | undefined
    urlInput?.focus()
    urlInput?.select()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Unable to create stash'
  } finally {
    isSubmitting.value = false
  }
}

const copyCreatedUrl = async () => {
  if (!createdUrl.value) return
  await navigator.clipboard.writeText(createdUrl.value)
  copiedUrl.value = true
}

const resetForm = () => {
  createdUrl.value = ''
  copiedUrl.value = false
  form.type = 'text'
  form.format = 'plaintext'
  form.encryption = 'AES-256-GCM'
  form.password = ''
  form.burn = false
  form.expiration = '86400'
  formFields.value = []
  nextFieldId.value = 1
  fieldDraft.title = ''
  fieldDraft.value = ''
  fieldDraft.type = 'text'
}

</script>

<template>
  <div class="page-layout">
    <aside class="sidebar" aria-label="Options">
      <div>
        <img :src="theme === 'light' ? '/stash.png' : '/stash_white.png'" class="logo" alt="Stash" />
      </div>
      <div>
        <el-form :model="form" label-width="120px" class="options-form">
          <el-form-item label="Type" label-position="right" required>
            <el-radio-group v-model="form.type" aria-label="Type">
              <el-radio-button value="text">Text</el-radio-button>
              <el-radio-button value="form">Form</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="Format" required>
            <el-select v-model="form.format" placeholder="Select a format" class="format-select" :disabled="form.type == 'form'">
              <el-option
                v-for="option in formatOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="Encryption">
            <el-select v-model="form.encryption" class="encryption-select">
              <el-option
                v-for="option in encryptionOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="Password">
            <el-input v-model="form.password" type="password" show-password />
        </el-form-item>

        <el-form-item label="Expiration" required>
          <el-select v-model="form.expiration" placeholder="Select an expiration" class="expiration-select">
            <el-option
              v-for="option in expirationOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Burn after reading">
          <el-switch v-model="form.burn" />
        </el-form-item>

        <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />

        <el-form-item>
          <el-button type="primary" :loading="isSubmitting" @click="onSubmit">Create stash</el-button>
          <el-button @click="resetForm">Reset</el-button>
        </el-form-item>
        </el-form>
      </div>
    </aside>

    <main v-if="createdUrl" class="result-container creation-result" aria-label="Created stash">
      <el-result icon="success" title="Stash created" sub-title="Copy this URL. The decryption key stays in the URL fragment.">
        <template #extra>
          <div class="creation-result__url">
            <el-input ref="createdUrlInput" :model-value="createdUrl" readonly aria-label="Stash URL" />
            <el-button type="primary" @click="copyCreatedUrl">
              {{ copiedUrl ? 'Copied' : 'Copy URL' }}
            </el-button>
          </div>
        </template>
      </el-result>
    </main>
    <main v-else-if="form.type == 'text'" class="result-container editor-result" aria-label="Result">
      <CodeInput :key="form.format" v-model="code" :lang="form.format" placeholder="Start typing here!" />
    </main>
    <main v-else class="result-container form-builder" aria-label="Form builder">
      <div class="form-builder__header">
        <h2>Form builder</h2>
      </div>

      <el-form class="field-form" label-position="top" @submit.prevent="addField">
        <div class="field-form__grid">
          <el-form-item label="Title" required>
            <el-input v-model="fieldDraft.title" placeholder="Field title" />
          </el-form-item>
          <el-form-item label="Type" required>
            <el-select v-model="fieldDraft.type" class="field-type-select">
              <el-option
                v-for="option in fieldTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="Value" required>
          <el-input
            v-model="fieldDraft.value"
            :type="fieldDraft.type === 'secret' ? 'password' : 'text'"
            :placeholder="fieldDraft.type === 'secret' ? 'Secret value' : 'Field value'"
            :show-password="fieldDraft.type === 'secret'"
          />
        </el-form-item>
        <el-button type="primary" native-type="submit">Add field</el-button>
      </el-form>

      <el-divider />

      <div v-if="formFields.length" class="field-list">
        <div v-for="field in formFields" :key="field.id" class="field-list__item">
          <div class="field-list__heading">
            <strong>{{ field.title }}</strong>
            <el-tag size="small">{{ field.type === 'secret' ? 'Secret' : 'Text' }}</el-tag>
          </div>
          <el-input
            v-model="field.value"
            :type="field.type === 'secret' ? 'password' : 'text'"
            :aria-label="field.title"
            :show-password="field.type === 'secret'"
          />
          <el-button text type="danger" @click="removeField(field.id)">Remove</el-button>
        </div>
      </div>
      <el-empty v-else description="No fields added yet" />
    </main>
  </div>
</template>

<style lang="scss">

.page-layout {
  display: grid;
  grid-template-columns: minmax(0, 25%) minmax(0, 1fr);
  gap: 10px;
  min-height: 100vh;
}

.sidebar,
.result-container {
  min-height: calc(100vh - 2rem);
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
}

.sidebar {
  background: var(--el-bg-color);
}

.options-form,
.format-select,
.encryption-select {
  width: 100%;
}

.result-container {
  background: var(--el-fill-color-blank);
}

.editor-result {
  display: flex;
  min-height: calc(100vh - 2rem);
}

.editor-result .code-input {
  flex: 1;
}

.creation-result {
  display: grid;
  place-items: center;
}

.creation-result__url {
  display: flex;
  width: min(100%, 1100px);
  gap: 0.75rem;
}

.creation-result__url .el-input {
  flex: 1;
}

.form-builder {
  max-width: 900px;
}

.form-builder__header {
  margin-bottom: 1.5rem;

  h2,
  p {
    margin: 0;
  }

  p {
    margin-top: 0.35rem;
    color: var(--el-text-color-secondary);
  }
}

.field-form__grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(160px, 1fr);
  gap: 1rem;
}

.field-type-select {
  width: 100%;
}

.field-list {
  display: grid;
  gap: 1rem;
}

.field-list__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem 1rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}

.field-list__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.field-list__item .el-input {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .field-form__grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .field-list__item {
    grid-template-columns: 1fr auto;
  }
}

@media (max-width: 1024px) {
  .page-layout {
    grid-template-columns: 1fr;
  }
}
</style>
