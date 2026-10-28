<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineProps<{
  title: string;
  message: string;
  reloadLabel: string;
  keepLabel: string;
  saveCopyLabel: string;
}>();

const emit = defineEmits<{
  reload: [];
  keep: [];
  saveCopy: [];
}>();

const root = ref<HTMLDivElement | null>(null);

onMounted(() => {
  root.value?.focus();
});
</script>

<template>
  <div
    ref="root"
    class="overlay"
    tabindex="-1"
    @click.self="emit('keep')"
    @keydown.esc="emit('keep')"
  >
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="actions">
        <button
          class="btn ghost copy"
          type="button"
          @click="emit('saveCopy')"
        >
          {{ saveCopyLabel }}
        </button>
        <button
          class="btn ghost keep"
          type="button"
          @click="emit('keep')"
        >
          {{ keepLabel }}
        </button>
        <button
          class="btn danger reload"
          type="button"
          @click="emit('reload')"
        >
          {{ reloadLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--overlay);
  backdrop-filter: blur(3px);
  outline: none;
}

.dialog {
  width: min(480px, 100%);
  padding: 22px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-strong);
}

.dialog h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

.dialog p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
