<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineProps<{
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();
const root = ref<HTMLDivElement | null>(null);

onMounted(() => {
  root.value?.focus();
});
</script>

<template>
  <div ref="root" class="overlay" tabindex="-1" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="actions">
        <button class="btn ghost" type="button" @click="emit('cancel')">取消</button>
        <button class="btn" :class="danger ? 'danger' : 'primary'" type="button" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(31, 41, 51, 0.42);
  backdrop-filter: blur(3px);
  outline: none;
}

.dialog {
  width: min(400px, 100%);
  padding: 22px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(31, 41, 51, 0.2);
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
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
