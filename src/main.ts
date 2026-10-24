import { createApp } from 'vue';
import { openUrl } from '@tauri-apps/plugin-opener';
import inkerIconUrl from '../assets/icons/inker.svg?url';
import './lib/font-assets';
import 'katex/dist/katex.min.css';
import App from './App.vue';
import './style.css';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = inkerIconUrl;
document.head.append(favicon);

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href') ?? '';
  if (!href || href.startsWith('#')) return;

  event.preventDefault();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
    void openUrl(href);
  }
});

createApp(App).mount('#app');
