<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';

const props = defineProps<{
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  placeholder?: string;
  busy: boolean;
  error: string;
}>();

const emit = defineEmits<{ confirm: [value: string]; cancel: [] }>();

const value = ref(props.initialValue);
const input = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  await nextTick();
  input.value?.focus();
  input.value?.select();
});

function submit(): void {
  if (props.busy) return;
  emit('confirm', value.value);
}

function cancel(): void {
  if (props.busy) return;
  emit('cancel');
}
</script>

<template>
  <div class="overlay" @click.self="cancel" @keydown.esc.prevent="cancel">
    <form class="dialog" role="dialog" aria-modal="true" :aria-label="title" @submit.prevent="submit">
      <h2>{{ title }}</h2>
      <label class="field">
        <span>{{ label }}</span>
        <input
          ref="input"
          v-model="value"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="placeholder"
          :disabled="busy"
        />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button class="btn ghost" type="button" :disabled="busy" @click="cancel">取消</button>
        <button class="btn primary" type="submit" :disabled="busy || !value.trim()">
          {{ busy ? '处理中…' : confirmLabel }}
        </button>
      </div>
    </form>
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
}

.dialog {
  width: min(420px, 100%);
  padding: 22px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-strong);
}

.dialog h2 {
  margin: 0 0 14px;
  font-size: 17px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 12px;
  color: var(--muted);
}

.field input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-soft);
  outline: none;
  font-size: 13px;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.error {
  margin: 10px 0 0;
  color: var(--error);
  font-size: 12px;
  line-height: 1.6;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
