import { createApp } from 'vue';
import { initShiki } from './lib/shikiHighlighter';
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

void initShiki();
createApp(App).mount('#app');
