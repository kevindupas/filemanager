import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { polyfill } from 'mobile-drag-drop';
import 'mobile-drag-drop/default.css';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { initializeGridTheme } from './hooks/use-grid-theme';

declare global {
    const route: typeof routeFn;
}

// Enable native HTML5 drag & drop on touch devices (commander + file rows) without
// rewriting the drag logic. Long-press starts a drag so scrolling/tapping still work.
polyfill({
    holdToDrag: 200,
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
});
// iOS Safari needs a non-passive touchmove listener for the polyfill to take effect.
window.addEventListener('touchmove', () => {}, { passive: false });

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// Apply the saved thegridcn theme (data-theme + dark) before paint.
initializeGridTheme();
