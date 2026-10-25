<script setup lang="ts">
import { computed, ref } from 'vue';
import { Upload, X } from '@lucide/vue';
import {
  MAX_THEME_FILE_BYTES,
  parseCodeThemeFile,
  parseUiThemeFile,
} from '../../lib/themeImport';
import {
  addCustomCodeTheme,
  addCustomUiTheme,
  customCodeThemes,
  customUiThemes,
  removeCustomCodeTheme,
  removeCustomUiTheme,
} from '../../lib/customThemes';
import { t } from '../../lib/i18n';

const props = defineProps<{
  kind: 'ui' | 'code';
  modelValue: string;
  defaultValue: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const error = ref('');
const notice = ref('');

const isUi = computed(() => props.kind === 'ui');
const accept = computed(() =>
  isUi.value ? '.json,application/json' : '.css,text/css',
);
const formatLabel = computed(() =>
  isUi.value
    ? t('themeImport.uiFormat')
    : t('themeImport.codeFormat'),
);
const themes = computed(() =>
  isUi.value ? customUiThemes.value : customCodeThemes.value,
);

function openPicker(): void {
  if (busy.value) return;
  error.value = '';
  notice.value = '';
  input.value?.click();
}

async function onFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;

  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    if (file.size > MAX_THEME_FILE_BYTES) {
      throw new Error(t('themeImport.error.tooLarge'));
    }
    const text = await file.text();
    if (isUi.value) {
      const theme = addCustomUiTheme(parseUiThemeFile(text));
      notice.value = t('themeImport.imported', { name: theme.name });
      emit('select', theme.id);
    } else {
      const theme = addCustomCodeTheme(
        parseCodeThemeFile(text, file.name),
      );
      notice.value = t('themeImport.imported', { name: theme.name });
      emit('select', theme.id);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    busy.value = false;
  }
}

function removeTheme(id: string, name: string): void {
  if (isUi.value) removeCustomUiTheme(id);
  else removeCustomCodeTheme(id);
  if (props.modelValue === id) {
    emit('select', props.defaultValue);
  }
  notice.value = t('themeImport.deleted', { name });
  error.value = '';
}
</script>

<template>
  <div class="theme-import">
    <div class="theme-import-actions">
      <button
        type="button"
        class="theme-import-button"
        :disabled="busy"
        @click="openPicker"
      >
        <Upload :size="13" aria-hidden="true" />
        {{ isUi ? t('themeImport.importUi') : t('themeImport.importCode') }}
      </button>
      <span class="theme-import-format">{{
        t('themeImport.supports', { format: formatLabel })
      }}</span>
      <input
        ref="input"
        class="theme-file-input"
        type="file"
        :accept="accept"
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="theme-import-message error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="notice" class="theme-import-message" role="status">
      {{ notice }}
    </p>

    <ul v-if="themes.length" class="custom-theme-list">
      <li
        v-for="theme in themes"
        :key="theme.id"
        class="custom-theme-item"
      >
        <span class="custom-theme-name">{{ theme.name }}</span>
        <button
          type="button"
          class="custom-theme-delete"
          :title="t('themeImport.delete', { name: theme.name })"
          :aria-label="t('themeImport.delete', { name: theme.name })"
          @click="removeTheme(theme.id, theme.name)"
        >
          <X :size="12" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.theme-import {
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-soft);
}

.theme-import-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
}

.theme-import-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  font-size: 11px;
}

.theme-import-button:hover:not(:disabled) {
  border-color: var(--faint);
  background: var(--btn-hover-bg);
}

.theme-import-button:disabled {
  opacity: 0.55;
}

.theme-import-format {
  color: var(--faint);
  font-size: 10.5px;
}

.theme-file-input {
  display: none;
}

.theme-import-message {
  margin: 7px 0 0;
  color: var(--success);
  font-size: 10.5px;
  line-height: 1.5;
}

.theme-import-message.error {
  color: var(--error);
}

.custom-theme-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.custom-theme-item {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 4px;
  padding: 2px 3px 2px 7px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--muted);
  font-size: 10.5px;
}

.custom-theme-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-theme-delete {
  display: grid;
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--faint);
}

.custom-theme-delete:hover {
  background: var(--error-soft);
  color: var(--error);
}
</style>
