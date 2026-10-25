<script setup lang="ts">
import { computed } from 'vue';
import { Check } from '@lucide/vue';
import SettingsSelect from './SettingsSelect.vue';
import ThemeImportControl from './ThemeImportControl.vue';
import {
  isSettingModified,
  type SettingDefinition,
} from '../../lib/settingsSchema';

const props = defineProps<{
  setting: SettingDefinition;
}>();

const emit = defineEmits<{
  update: [value: string | number | boolean];
  reset: [];
}>();

const modified = computed(() => isSettingModified(props.setting));
const checked = computed(() => props.setting.value === true);

function onNumberChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    input.value = String(props.setting.value);
    return;
  }
  emit('update', value);
}

function onCheckboxChange(event: Event): void {
  emit('update', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <article
    class="setting-item"
    :class="{ modified }"
    :data-setting-id="setting.id"
  >
    <div class="setting-copy">
      <div class="setting-title-row">
        <h3 :id="`${setting.id}-title`">{{ setting.title }}</h3>
        <span v-if="modified" class="modified-badge">已修改</span>
      </div>
      <p class="setting-description">{{ setting.description }}</p>

      <div class="setting-control">
        <SettingsSelect
          v-if="setting.controlType === 'select'"
          :model-value="String(setting.value)"
          :options="setting.options ?? []"
          :labelledby="`${setting.id}-title`"
          @update="emit('update', $event)"
        />

        <div v-else-if="setting.controlType === 'input'" class="number-shell">
          <input
            type="number"
            class="setting-number"
            :value="setting.value"
            :min="setting.min"
            :max="setting.max"
            :step="setting.step"
            :aria-labelledby="`${setting.id}-title`"
            @change="onNumberChange"
          />
          <span v-if="setting.suffix" class="number-suffix">
            {{ setting.suffix }}
          </span>
        </div>

        <label v-else class="checkbox-control">
          <input
            type="checkbox"
            class="checkbox-input"
            :checked="checked"
            :aria-labelledby="`${setting.id}-title`"
            @change="onCheckboxChange"
          />
          <span class="checkbox-box" aria-hidden="true">
            <Check v-if="checked" :size="11" :stroke-width="3" />
          </span>
          <span class="checkbox-label">{{ checked ? '已启用' : '已停用' }}</span>
        </label>
      </div>

      <ThemeImportControl
        v-if="setting.controlType === 'select' && setting.themeImport"
        :kind="setting.themeImport"
        :model-value="String(setting.value)"
        :default-value="String(setting.defaultValue)"
        @select="emit('update', $event)"
      />

      <p v-if="setting.hint" class="setting-hint">
        {{ setting.hint.text }}
        <button
          v-if="setting.hint.linkLabel"
          type="button"
          class="hint-link"
          @click="emit('reset')"
        >
          {{ setting.hint.linkLabel }}
        </button>
      </p>
    </div>
  </article>
</template>

<style scoped>
.setting-item {
  position: relative;
  padding: 15px 24px 17px 21px;
  border-bottom: 1px solid var(--border);
  transition: background 0.12s ease;
}

.setting-item:hover {
  background: var(--hover);
}

.setting-item.modified::before {
  position: absolute;
  top: 15px;
  bottom: 17px;
  left: 0;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
  content: '';
}

.setting-copy {
  max-width: 760px;
}

.setting-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-title-row h3 {
  margin: 0;
  color: var(--ink);
  font-family: var(--mono-font);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.modified-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 9.5px;
  line-height: 1.4;
}

.setting-description {
  margin: 4px 0 9px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.setting-control {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.number-shell {
  display: flex;
  width: 160px;
  height: 28px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-soft);
}

.number-shell:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.setting-number {
  width: 100%;
  height: 100%;
  padding: 0 8px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-family: var(--mono-font);
  font-size: 11.5px;
  appearance: textfield;
}

.setting-number::-webkit-inner-spin-button,
.setting-number::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.number-suffix {
  padding-right: 9px;
  color: var(--faint);
  font-size: 10.5px;
  pointer-events: none;
}

.checkbox-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11.5px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.checkbox-box {
  display: grid;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--faint);
  border-radius: 2px;
  background: var(--bg-soft);
  color: var(--primary-ink);
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.checkbox-control:hover .checkbox-box {
  border-color: var(--muted);
}

.checkbox-input:checked + .checkbox-box {
  border-color: var(--accent);
  background: var(--accent);
}

.checkbox-input:focus-visible + .checkbox-box {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.checkbox-label {
  line-height: 1;
}

.setting-hint {
  margin: 9px 0 0;
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.65;
}

.hint-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: inherit;
  line-height: inherit;
}

.hint-link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}
</style>
