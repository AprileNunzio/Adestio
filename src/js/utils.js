export const Router = {
    history: [],
    navigate: async (pageName, params = {}, isBack = false) => {
        try {
            const el = document.getElementById('main-content');
            if (!el) return;

            const lastPage = Router.history[Router.history.length - 1];
            const isDifferentPage = !lastPage || lastPage.pageName !== pageName || JSON.stringify(lastPage.params) !== JSON.stringify(params);

            if (!isBack && isDifferentPage) {

                if (pageName !== 'oobe' && pageName !== 'auth_login' && pageName !== 'auth_register') {

                    Router.history.push({ pageName, params });
                }
            }

            el.innerHTML = '';

            const page = window.Pages[pageName];
            if (page && typeof page.render === 'function') {
                await page.render(el, params);

                window.dispatchEvent(new CustomEvent('router:navigated', { detail: { pageName } }));
            } else {
                el.innerHTML = `<h1>404</h1>`;
            }
        } catch (e) {
            console.error(e);
            toast("Errore di navigazione", "error");
        }
    },
    back: () => {
        if (Router.history.length > 1) {
            Router.history.pop(); 
            const prev = Router.history[Router.history.length - 1]; 
            Router.navigate(prev.pageName, prev.params, true);
        } else {

            Router.history = []; 
            if (window.electronAPI) {
                window.electronAPI.checkIsRegistered().then(reg => {
                    Router.navigate(reg ? 'auth_login' : 'oobe', {}, true);
                });
            } else {
                Router.navigate('auth_login', {}, true);
            }
        }
    }
};

export const toast = (message, type = 'info') => {
    try {
        console.log(`[TOAST ${type}]: ${message}`);

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none;';
            document.body.appendChild(container);
        }

        const toastEl = document.createElement('div');

        let bgColor = 'var(--md-surface-variant)';
        let icon = 'info';
        let color = 'var(--md-on-surface)';

        if (type === 'success') {
            bgColor = 'rgba(76, 175, 80, 0.95)';
            color = '#ffffff';
            icon = 'check_circle';
        } else if (type === 'error') {
            bgColor = 'rgba(244, 67, 54, 0.95)';
            color = '#ffffff';
            icon = 'error';
        }

        toastEl.style.cssText = `
            background: ${bgColor};
            color: ${color};
            padding: 0.8rem 1.5rem;
            border-radius: 24px;
            font-size: 0.95rem;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 0.8rem;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(8px);
        `;

        toastEl.innerHTML = `<span class="material-symbols-rounded" style="font-size: 1.2rem;">${icon}</span> <span>${message}</span>`;
        container.appendChild(toastEl);

        requestAnimationFrame(() => {
            toastEl.style.opacity = '1';
            toastEl.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toastEl.style.opacity = '0';
            toastEl.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                try {
                    if (container.contains(toastEl)) container.removeChild(toastEl);
                } catch(e){}
            }, 300);
        }, 4000);

    } catch (e) {
        console.error(e);
    }
};

export const Modal = {
    show: ({ title, content }) => {
        try {
            console.log(`[MODAL] ${title}: ${content}`);
        } catch (e) {
            console.error(e);
        }
    }
};

export const fmt = {
    euro: (val) => {
        try {
            return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
        } catch (e) {
            console.error(e);
            return val;
        }
    },
    data: (date) => {
        try {
            return new Intl.DateTimeFormat('it-IT').format(new Date(date));
        } catch (e) {
            console.error(e);
            return date;
        }
    }
};
