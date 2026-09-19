<script setup lang="ts">
import type { StashEnvelope } from '~/composables/useStashCrypto'

interface StashResponse {
  id: string
  envelope: StashEnvelope
  passwordProtected: boolean
  expiresAt: number | null
  burnAfterReading: boolean
}

type StashPayload = Awaited<ReturnType<typeof decryptStash>>

const route = useRoute()
const stashId = String(route.params.stashId)
const stash = ref<StashResponse>()
const payload = ref<StashPayload>()
const password = ref('')
const loading = ref(true)
const decrypting = ref(false)
const errorMessage = ref('')
const copiedFieldTitle = ref('')

const copyField = async (title: string, value: string) => {
  await navigator.clipboard.writeText(value)
  copiedFieldTitle.value = title
  window.setTimeout(() => {
    if (copiedFieldTitle.value === title) copiedFieldTitle.value = ''
  }, 1500)
}

const decrypt = async () => {
  if (!stash.value || decrypting.value) return

  decrypting.value = true
  errorMessage.value = ''
  try {
    payload.value = await decryptStash(
      stash.value.envelope,
      password.value,
      route.hash.slice(1),
    )


  } catch {
    payload.value = undefined
    errorMessage.value = stash.value.passwordProtected
      ? 'The password is incorrect or the stash is corrupted.'
      : 'The decryption key is missing or the stash is corrupted.'
  } finally {
    decrypting.value = false
  }
}

onMounted(async () => {
  try {
    stash.value = await $fetch<StashResponse>(`/api/stashes/${stashId}`)
    if (!stash.value.passwordProtected) await decrypt()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Stash not found or expired.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="stash-reader">
    <el-card class="stash-reader__card">
      <el-skeleton v-if="loading" :rows="5" animated />


      <el-result
        v-else-if="errorMessage && !stash"
        icon="error"
        title="Unable to read stash"
        sub-title="There was an error reading the stash. It may have expired or been deleted."
      />

      <template v-else-if="stash && !payload">
        <div class="stash-reader__unlock">
          <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          type="error"
          show-icon
          :closable="false"
          class="stash-reader__alert"
        />
        <el-form v-if="stash.passwordProtected" label-position="top" @submit.prevent="decrypt">
          <el-form-item label="Password">
            <el-input v-model="password" type="password" show-password autofocus />
          </el-form-item>
          <el-button type="primary" native-type="submit" :loading="decrypting">Unlock stash</el-button>
        </el-form>
          <el-alert
            v-else
            title="This stash cannot be decrypted because its URL key is missing."
            type="error"
            show-icon
            :closable="false"
          />
        </div>
      </template>

      <template v-else-if="payload?.type === 'text'">
        <CodeInput
          v-model="payload.content"
          :lang="payload.format || 'plaintext'"
          class="stash-reader__code"
          readonly
          :rows="16"
        />
      </template>

      <template v-else-if="payload?.type === 'form'">
        <el-form label-position="right" label-width="180px" class="stash-form-fields">
          <el-form-item v-for="field in payload.fields" :key="field.title" :label="field.title">
            <el-input
              :model-value="field.value"
              :type="field.type === 'secret' ? 'password' : 'text'"
              :show-password="field.type === 'secret'"
              readonly
            >
              <template #append>
                <el-button @click="copyField(field.title, field.value)">
                  {{ copiedFieldTitle === field.title ? 'Copied' : 'Copy' }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
      </template>
    </el-card>
  </main>
</template>

<style lang="scss">
.stash-reader {
  min-height: 100vh;
}

.stash-reader__card {
  min-height: 100vh;
  width: 100%;
  border: 0;
  border-radius: 0;
}

.stash-reader__card .el-card__body {
  min-height: 100vh;
  padding: 0;
}

.stash-reader__code {
  min-height: 100vh;
  padding: 1rem;
  box-sizing: border-box;
}

.stash-reader__unlock {
  display: grid;
  min-height: 100vh;
  padding: 2rem;
  place-items: center;
}

.stash-reader__unlock > * {
  width: min(100%, 420px);
}

.stash-reader__card .el-result {
  display: flex;
  min-height: calc(100vh - 6rem);
  align-items: center;
  justify-content: center;
}

.stash-reader__alert {
  margin-bottom: 1rem;
}


.stash-form-fields {
  display: flex;
  width: min(100%, 800px);
  min-height: 100vh;
  margin: 0 auto;
  flex-direction: column;
  justify-content: center;
}

@media (max-width: 640px) {
  .stash-form-fields {
    .el-form-item {
      display: block;
    }

    .el-form-item__label {
      width: auto !important;
      margin-bottom: 0.35rem;
      text-align: left;
    }
  }
}

@media (max-width: 640px) {
  .stash-reader {
    padding: 1rem;
  }
}
</style>
