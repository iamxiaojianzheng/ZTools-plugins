import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/global.css';

if (import.meta.env.DEV && !window.services) {
  import('./dev/mock').then((m) => m.setupMock());
}

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
