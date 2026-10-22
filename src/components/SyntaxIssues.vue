<script setup lang="ts">
import { computed } from 'vue';
import type { SyntaxIssue } from '../types';

const props = defineProps<{
  issues: SyntaxIssue[];
}>();

const errorCount = computed(() => props.issues.filter((issue) => issue.severity === 'error').length);
const warningCount = computed(() => props.issues.length - errorCount.value);

const statusLabel = computed(() => {
  if (props.issues.length === 0) {
    return '通过';
  }
  const parts: string[] = [];
  if (errorCount.value > 0) {
    parts.push(`${errorCount.value} 个错误`);
  }
  if (warningCount.value > 0) {
    parts.push(`${warningCount.value} 个提示`);
  }
  return parts.join(' · ');
});
</script>

<template>
  <section class="issues-panel">
    <header class="issues-header">
      <span>语法检查</span>
      <span class="status" :class="errorCount > 0 ? 'bad' : 'ok'">{{ statusLabel }}</span>
    </header>

    <p v-if="issues.length === 0" class="hint success">未发现语法问题，可以保存了。</p>
    <ul v-else class="issue-list">
      <li
        v-for="(issue, index) in issues"
        :key="`${issue.line}-${issue.rule}-${index}`"
        :class="issue.severity"
      >
        <span class="line">L{{ issue.line }}</span>
        <span class="badge">{{ issue.severity === 'error' ? '错误' : '提示' }}</span>
        <span class="message">{{ issue.message }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.issues-panel {
  max-height: 200px;
  overflow-y: auto;
  padding: 12px 16px 14px;
  background: var(--bg-soft);
  border-top: 1px solid var(--border);
}

.issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}

.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
}

.status.ok {
  background: #ecfdf3;
  color: #047857;
}

.status.bad {
  background: var(--error-soft);
  color: var(--error);
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}

.hint.success {
  color: #047857;
}

.issue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.issue-list li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.issue-list li.warning {
  background: var(--warning-soft);
}

.issue-list li.error {
  background: var(--error-soft);
}

.line {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--muted);
}

.badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
}

.error .badge {
  color: var(--error);
}

.warning .badge {
  color: var(--warning);
}

.message {
  color: var(--ink);
}
</style>
