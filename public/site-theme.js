(() => {
    const root = document.documentElement;
    if (root.hasAttribute('data-theme-ready')) return;

    const themeCookie = 'tf_public_theme';
    const savedTheme = document.cookie.split(/;\s*/).find(value => value.startsWith(themeCookie + '='));
    if (savedTheme === themeCookie + '=dark') root.setAttribute('data-public-theme', 'dark');
    root.setAttribute('data-theme-ready', '');

    document.addEventListener('click', event => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
        const theme = root.getAttribute('data-public-theme') === 'dark' ? 'light' : 'dark';
        if (theme === 'dark') root.setAttribute('data-public-theme', 'dark');
        else root.removeAttribute('data-public-theme');

        const host = location.hostname;
        const domain = host === 'travelfrontiers.pt' || host.endsWith('.travelfrontiers.pt')
            ? '; Domain=travelfrontiers.pt' : '';
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = themeCookie + '=' + theme + '; Path=/; Max-Age=31536000; SameSite=Lax' + domain + secure;
    });
})();
