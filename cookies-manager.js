// Gestor de Cookies RGPD - Travel Frontiers
class CookieManager {
    constructor() {
        this.cookieName = 'tf_cookie_consent';
        this.cookieExpiry = 365; // dias
        this.init();
    }

    init() {
        // Verificar se já existe consentimento
        if (!this.hasConsent()) {
            this.showBanner();
        } else {
            this.showFloatingButton();
            this.loadConsentedCookies();
        }

        this.bindEvents();
    }

    bindEvents() {
        // Banner buttons
        document.getElementById('cookieAcceptAll')?.addEventListener('click', () => this.acceptAll());
        document.getElementById('cookieRejectAll')?.addEventListener('click', () => this.rejectAll());
        document.getElementById('cookieSettings')?.addEventListener('click', () => this.showModal());

        // Modal events
        document.getElementById('cookieModalClose')?.addEventListener('click', () => this.hideModal());
        document.getElementById('cookieSaveSettings')?.addEventListener('click', () => this.saveSettings());

        // Floating button
        document.getElementById('reviewCookies')?.addEventListener('click', () => this.showModal());

        // Click outside modal to close
        document.getElementById('cookieModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'cookieModal') {
                this.hideModal();
            }
        });
    }

    showBanner() {
        const banner = document.getElementById('cookieBanner');
        if (banner) {
            banner.style.display = 'block';
        }
    }

    hideBanner() {
        const banner = document.getElementById('cookieBanner');
        if (banner) {
            banner.style.display = 'none';
        }
        this.showFloatingButton();
    }

    showFloatingButton() {
        const floatingBtn = document.getElementById('cookieSettings-float');
        if (floatingBtn) {
            floatingBtn.style.display = 'block';
        }
    }

    showModal() {
        const modal = document.getElementById('cookieModal');
        if (modal) {
            // Carregar configurações atuais
            this.loadCurrentSettings();
            modal.style.display = 'flex';
        }
    }

    hideModal() {
        const modal = document.getElementById('cookieModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    loadCurrentSettings() {
        const consent = this.getConsent();
        if (consent) {
            document.getElementById('essential').checked = true; // sempre true
            document.getElementById('analytics').checked = consent.analytics || false;
            document.getElementById('marketing').checked = consent.marketing || false;
        }
    }

    acceptAll() {
        const consent = {
            essential: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString()
        };
        this.saveConsent(consent);
        this.hideBanner();
        this.loadConsentedCookies();
        this.triggerGTMEvent('cookie_consent_all');
    }

    rejectAll() {
        const consent = {
            essential: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().toISOString()
        };
        this.saveConsent(consent);
        this.hideBanner();
        this.loadConsentedCookies();
        this.triggerGTMEvent('cookie_consent_reject');
    }

    saveSettings() {
        const consent = {
            essential: true, // sempre true
            analytics: document.getElementById('analytics').checked,
            marketing: document.getElementById('marketing').checked,
            timestamp: new Date().toISOString()
        };

        this.saveConsent(consent);
        this.hideModal();
        this.hideBanner();
        this.loadConsentedCookies();

        // Trigger GTM event
        this.triggerGTMEvent('cookie_consent_custom', consent);

        // Show success message
        this.showNotification('Configurações guardadas com sucesso!');
    }

    saveConsent(consent) {
        const consentString = JSON.stringify(consent);
        const expiry = new Date();
        expiry.setTime(expiry.getTime() + (this.cookieExpiry * 24 * 60 * 60 * 1000));

        document.cookie = `${this.cookieName}=${consentString}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
    }

    getConsent() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === this.cookieName) {
                try {
                    return JSON.parse(decodeURIComponent(value));
                } catch (e) {
                    console.warn('Erro ao parse do consentimento de cookies:', e);
                    return null;
                }
            }
        }
        return null;
    }

    hasConsent() {
        return this.getConsent() !== null;
    }

    loadConsentedCookies() {
        const consent = this.getConsent();
        if (!consent) return;

        // Carregar Google Analytics se consentido
        if (consent.analytics && typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
        }

        // Carregar cookies de marketing se consentido
        if (consent.marketing && typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'ad_storage': 'granted',
                'ad_user_data': 'granted',
                'ad_personalization': 'granted'
            });
        }

        // Trigger GTM events baseado no consentimento
        if (typeof dataLayer !== 'undefined') {
            dataLayer.push({
                'event': 'cookie_consent_loaded',
                'cookie_consent': consent
            });
        }
    }

    triggerGTMEvent(eventName, consentData = null) {
        if (typeof dataLayer !== 'undefined') {
            const eventData = {
                'event': eventName,
                'timestamp': new Date().toISOString()
            };

            if (consentData) {
                eventData.cookie_consent = consentData;
            }

            dataLayer.push(eventData);
        }
    }

    showNotification(message) {
        // Criar notificação temporária
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10002;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;

        // Adicionar CSS de animação se não existir
        if (!document.querySelector('#cookie-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'cookie-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remover após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Método público para verificar consentimento específico
    hasConsentFor(type) {
        const consent = this.getConsent();
        return consent ? consent[type] === true : false;
    }

    // Método para resetar consentimento (útil para desenvolvimento)
    resetConsent() {
        document.cookie = `${this.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        location.reload();
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    window.cookieManager = new CookieManager();
});

// Configuração inicial do Google Analytics com consentimento negado por padrão
if (typeof gtag !== 'undefined') {
    gtag('consent', 'default', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied'
    });
}
