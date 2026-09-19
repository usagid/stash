import { bundledLanguagesInfo } from 'shiki/langs'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  runtimeConfig: {
    stashDatabasePath: process.env.STASH_DATABASE_PATH || '.data/stashes.sqlite',
  },
  devtools: { enabled: true },
  css: [
    '@/assets/css/main.scss'
  ],
  app: {
    head: {
      titleTemplate: "stash - %s",
      charset: 'utf-16',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
      script: [
        {
          // Applied before hydration so the correct theme paints immediately, no flash.
          innerHTML: `(function(){try{var t=localStorage.getItem('stash-theme');if(t==='light'){document.documentElement.classList.remove('dark')}}catch(e){}})()`
        }
      ]
    }
  },
  modules: ['@element-plus/nuxt', '@nuxt/fonts', 'nuxt-shiki'],
  fonts: {
    families: [
      {
        name: 'Fira Code',
        provider: 'google',
        weights: [400, 500, 600, 700],
        global: true
      }
    ]
  },
  elementPlus: {
    themes: ['dark']
  },
  shiki: {
    defaultTheme: 'min-dark',
    bundledThemes: ['min-light', 'min-dark'],
    bundledLangs: bundledLanguagesInfo.map(language => language.id)
  }
})