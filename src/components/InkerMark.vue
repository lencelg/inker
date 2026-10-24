<script setup lang="ts">
// Inker 品牌标记：45° 斜置的笔（笔杆 + 分隔带 + 笔尖）与落笔横线的单色版本。
// 省略背景渐变，全部填充跟随 currentColor，可直接嵌进强调色容器做单色使用。
</script>

<template>
  <svg viewBox="0 0 256 256" fill="none" aria-hidden="true">
    <g transform="rotate(45 128 128)">
      <rect x="104" y="58" width="48" height="60" rx="11" fill="currentColor" />
      <rect
        x="104"
        y="124"
        width="48"
        height="16"
        fill="currentColor"
        fill-opacity="0.55"
      />
      <path d="M104 140H152L128 196Z" fill="currentColor" />
    </g>
    <rect
      x="60"
      y="196"
      width="76"
      height="15"
      rx="7.5"
      fill="currentColor"
      fill-opacity="0.8"
    />
  </svg>
</template>
