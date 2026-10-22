<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { api } from '../api';
import { dirname } from '../lib/paths';
import type { SearchMatch } from '../types';

const props = defineProps<{
  notesDir: string | null;
}>();

const emit = defineEmits<{ open: [match: SearchMatch] }>();

interface DisplayMatch extends SearchMatch {
  before: string;
  hit: string;
  after: string;
}

interface SearchGroup {
  path: string;
  name: string;
  directory: string;
  matches: DisplayMatch[];
}

const query = ref('');
const results = ref<SearchMatch[]>([]);
const truncated = ref(false);
const loading = ref(false);
const error = ref('');
const input = ref<HTMLInputElement | null>(null);
let searchTimer = 0;
let requestId = 0;

const groups = computed<SearchGroup[]>(() => {
  const grouped = new Map<string, SearchGroup>();
  for (const match of results.value) {
    let group = grouped.get(match.path);
    if (!group) {
      group = {
        path: match.path,
        name: match.name,
        directory: dirname(match.path),
        matches: [],
      };
      grouped.set(match.path, group);
    }
    group.matches.push({ ...match, ...splitMatch(match) });
  }
  return [...grouped.values()];
});

function splitMatch(match: SearchMatch): Pick<DisplayMatch, 'before' | 'hit' | 'after'> {
  const characters = Array.from(match.text);
  const start = Math.max(0, Math.min(match.matchStart, characters.length));
  const end = Math.max(
    start,
    Math.min(start + match.matchLength, characters.length),
  );
  return {
    before: characters.slice(0, start).join(''),
    hit: characters.slice(start, end).join(''),
    after: characters.slice(end).join(''),
  };
}

watch(
  () => props.notesDir,
  () => {
    requestId += 1;
    query.value = '';
    results.value = [];
    truncated.value = false;
    loading.value = false;
    error.value = '';
  },
);

watch(query, () => {
  window.clearTimeout(searchTimer);
  requestId += 1;
  loading.value = false;
  error.value = '';
  if (!query.value.trim()) {
    results.value = [];
    truncated.value = false;
    return;
  }
  searchTimer = window.setTimeout(() => {
    void runSearch();
  }, 250);
});

onMounted(async () => {
  await nextTick();
  input.value?.focus();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer);
  requestId += 1;
});

function clearQuery(): void {
  query.value = '';
  results.value = [];
  truncated.value = false;
  window.clearTimeout(searchTimer);
  input.value?.focus();
}

async function runSearch(): Promise<void> {
  window.clearTimeout(searchTimer);
  const text = query.value.trim();
  if (!text || !props.notesDir) {
    results.value = [];
    truncated.value = false;
    loading.value = false;
    return;
  }

  const current = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const response = await api.searchNotes(text);
    if (current !== requestId) return;
    results.value = response.matches;
    truncated.value = response.truncated;
  } catch (err) {
    if (current !== requestId) return;
    results.value = [];
    truncated.value = false;
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    if (current === requestId) {
      loading.value = false;
    }
  }
}
</script>

<template>
  <aside class="search-panel">
    <header class="panel-heading">
      <h2>搜索</h2>
      <span v-if="loading" class="status">搜索中…</span>
    </header>

    <form class="search-form" role="search" @submit.prevent="runSearch">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="10.5"
          cy="10.5"
          r="6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="m15 15 4.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="text"
        placeholder="搜索笔记"
        autocomplete="off"
        spellcheck="false"
        aria-label="搜索笔记"
      />
      <button
        v-if="query"
        class="clear-button"
        type="button"
        aria-label="清除搜索"
        @click="clearQuery"
      >
        ×
      </button>
    </form>

    <div class="search-results">
      <p v-if="!notesDir" class="hint">
        请先在文件视图中选择笔记文件夹。
      </p>
      <p v-else-if="!query.trim()" class="hint">
        搜索所有 Markdown 笔记的内容。
      </p>
      <p v-else-if="error" class="error">{{ error }}</p>
      <p v-else-if="!loading && groups.length === 0" class="hint">
        没有找到匹配项。
      </p>
      <template v-else>
        <section
          v-for="group in groups"
          :key="group.path"
          class="result-group"
        >
          <div class="result-file" :title="group.path">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <path
                d="M14 3.5V8h4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
            </svg>
            <span class="file-name">{{ group.name }}</span>
            <span v-if="group.directory" class="file-dir">
              {{ group.directory }}
            </span>
            <span class="match-count">{{ group.matches.length }}</span>
          </div>

          <button
            v-for="match in group.matches"
            :key="`${match.path}:${match.line}`"
            class="result-item"
            type="button"
            :title="`${match.path}:${match.line}`"
            @click="emit('open', match)"
          >
            <span class="result-line">{{ match.line }}</span>
            <span class="result-text">
              {{ match.before
              }}<mark>{{ match.hit }}</mark>{{ match.after }}
            </span>
          </button>
        </section>
        <p v-if="truncated" class="hint">
          结果过多，仅显示前 500 条。
        </p>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-width: 0;
  padding: 16px 12px 12px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 4px;
}

.panel-heading h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.status {
  color: var(--muted);
  font-size: 11px;
}

.search-form {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.search-form:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--focus-ring);
}

.search-form svg {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  color: var(--faint);
}

.search-form input {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
}

.search-form input::placeholder {
  color: var(--faint);
}

.clear-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
}

.clear-button:hover {
  background: var(--hover);
  color: var(--ink);
}

.search-results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 6px;
}

.hint,
.error {
  margin: 0;
  padding: 8px 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.65;
}

.error {
  color: var(--error);
}

.result-group {
  margin-bottom: 8px;
}

.result-file {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
  color: var(--ink);
  font-size: 12.5px;
}

.result-file svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--faint);
}

.file-name {
  flex-shrink: 0;
  font-weight: 600;
}

.file-dir {
  overflow: hidden;
  color: var(--faint);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.match-count {
  flex-shrink: 0;
  min-width: 18px;
  margin-left: auto;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 10px;
  text-align: center;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 4px 6px 4px 20px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 12.5px;
  text-align: left;
}

.result-item:hover {
  background: var(--hover);
  color: var(--ink);
}

.result-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.result-line {
  flex-shrink: 0;
  min-width: 20px;
  color: var(--faint);
  font-family: var(--mono-font);
  font-size: 11px;
  line-height: 1.65;
  text-align: right;
}

.result-text {
  flex: 1;
  overflow: hidden;
  font-family: var(--mono-font);
  line-height: 1.65;
  white-space: pre;
  text-overflow: ellipsis;
}

.result-text mark {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--warning-soft);
  color: var(--warning);
}
</style>
