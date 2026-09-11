import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * `base` matters for GitHub Pages, which serves a project site from
 * `/<repo>/` rather than from the domain root. It is driven by an environment
 * variable so the same config works for a project page, a user page and a
 * custom domain without being edited.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber'],
          lenis: ['lenis'],
        },
      },
    },
  },
})
