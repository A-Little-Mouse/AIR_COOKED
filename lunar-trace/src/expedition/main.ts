import './expedition.css';
import { mountExpedition } from './expedition.ts';

const game = mountExpedition(document.querySelector<HTMLDivElement>('#app')!);
if (import.meta.env.DEV) (window as unknown as { __expedition?: typeof game }).__expedition = game; // dev-only hook for tests
