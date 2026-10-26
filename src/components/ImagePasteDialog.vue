<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../lib/i18n';
import {
  sanitizeImageStem,
  stripImageExtension,
} from '../lib/imagePaste';

const props = defineProps<{
  file: File;
  defaultName: string;
  extension: string;
  folder: string;
}>();

const emit = defineEmits<{
  confirm: [name: string];
  cancel: [];
}>();

const name = ref(props.defaultName);
const error = ref('');
const previewUrl = ref('');
const input = ref<HTMLInputElement | null>(null);
let objectUrl = '';

const cleanName = computed(() =>
  sanitizeImageStem(stripImageExtension(name.value.trim())),
);

const targetPath = computed(() => {
  const fileName = `${cleanName.value}.${props.extension}`;
  const folder =
    props.folder === '' ? t('imagePaste.rootFolder') : props.folder;
  return `${folder}/${fileName}`;
});

onMounted(async () => {
  try {
    if (typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(props.file);
      previewUrl.value = objectUrl;
    }
  } catch {
    previewUrl.value = '';
  }
  await nextTick();
  input.value?.focus();
  input.value?.select();
});

onBeforeUnmount(() => {
  if (objectUrl !== '') {
    URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
});

function submit(): void {
  const value = name.value.trim();
  if (value === '') {
    error.value = t('imagePaste.emptyName');
    input.value?.focus();
    return;
  }
  emit('confirm', value);
}

function cancel(): void {
  emit('cancel');
}
</script>

<template>
  <div
    class="overlay image-paste-overlay"
    @click.self="cancel"
    @keydown.esc.prevent="cancel"
  >
    <form
      class="dialog image-paste-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="t('imagePaste.title')"
      @submit.prevent="submit"
    >
      <h2>{{ t('imagePaste.title') }}</h2>

      <div class="image-paste-body">
        <div v-if="previewUrl" class="image-paste-preview">
          <img :src="previewUrl" :alt="t('imagePaste.preview')" />
        </div>

        <div class="image-paste-fields">
          <label class="field" for="image-paste-name">
            <span class="field-label">{{ t('imagePaste.nameLabel') }}</span>
            <span class="image-name-shell">
              <input
                id="image-paste-name"
                ref="input"
                v-model="name"
                type="text"
                autocomplete="off"
                spellcheck="false"
              />
              <span class="image-extension">.{{ extension }}</span>
            </span>
          </label>

          <p class="image-target">
            {{ t('imagePaste.target', { path: targetPath }) }}
          </p>
          <p class="image-hint">{{ t('imagePaste.sameName') }}</p>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn ghost" type="button" @click="cancel">
          {{ t('action.cancel') }}
        </button>
        <button class="btn primary" type="submit">
          {{ t('imagePaste.confirm') }}
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
  width: min(560px, 100%);
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

.image-paste-body {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.image-paste-preview {
  display: grid;
  width: 150px;
  height: 150px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
}

.image-paste-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-paste-fields {
  min-width: 0;
  flex: 1;
}

.field {
  display: grid;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--muted);
}

.image-name-shell {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-soft);
}

.image-name-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.image-name-shell input {
  width: 100%;
  min-width: 0;
  padding: 9px 0 9px 11px;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
}

.image-extension {
  padding: 0 11px 0 2px;
  color: var(--faint);
  font-family: var(--mono-font);
  font-size: 12px;
  white-space: nowrap;
}

.image-target {
  margin: 10px 0 0;
  color: var(--muted);
  font-family: var(--mono-font);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.image-hint {
  margin: 4px 0 0;
  color: var(--faint);
  font-size: 11px;
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

@media (max-width: 560px) {
  .image-paste-body {
    flex-direction: column;
  }

  .image-paste-preview {
    width: 100%;
    height: 120px;
  }
}
</style>
