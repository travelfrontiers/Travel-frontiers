// ============================================
// FORUM TRANSLATIONS (PT, EN, FR)
// ============================================

const forumTranslations = {
    pt: {
        nav: { home: 'Início', services: 'Serviços', forum: 'Fórum', contact: 'Contacto' },
        hero: { subtitle: 'Descubra destinos, restaurantes e dicas de viagem compartilhadas pela comunidade' },
        search: { placeholder: '🔍 Pesquisar posts...' },
        filter: { all: 'Todos', destinations: 'Destinos', restaurants: 'Restaurantes', tips: 'Dicas de Viagem', activities: 'Atividades' },
        loading: 'Carregando posts...',
        'loading.post': 'Carregando post...',
        noResults: 'Nenhum post encontrado. Tente outra pesquisa!',
        post: { readAlso: 'Leia Também', likes: 'Gostos', notFound: 'Post não encontrado.', by: 'por' },
        comments: {
            title: 'Comentários',
            leaveComment: 'Deixe um Comentário',
            name: 'Nome *',
            comment: 'Comentário *',
            submit: 'Enviar Comentário',
            moderation: 'Os comentários serão moderados antes de aparecer.',
            noComments: 'Sem comentários ainda. Seja o primeiro a comentar!',
            success: 'Comentário enviado! Será moderado em breve.',
            error: 'Erro ao enviar comentário. Tente novamente.'
        },
        footer: { rights: 'Todos os direitos reservados.', backToSite: 'Voltar ao site' }
    },
    en: {
        nav: { home: 'Home', services: 'Services', forum: 'Forum', contact: 'Contact' },
        hero: { subtitle: 'Discover destinations, restaurants and travel tips shared by the community' },
        search: { placeholder: '🔍 Search posts...' },
        filter: { all: 'All', destinations: 'Destinations', restaurants: 'Restaurants', tips: 'Travel Tips', activities: 'Activities' },
        loading: 'Loading posts...',
        'loading.post': 'Loading post...',
        noResults: 'No posts found. Try another search!',
        post: { readAlso: 'Read Also', likes: 'Likes', notFound: 'Post not found.', by: 'by' },
        comments: {
            title: 'Comments',
            leaveComment: 'Leave a Comment',
            name: 'Name *',
            comment: 'Comment *',
            submit: 'Submit Comment',
            moderation: 'Comments will be moderated before appearing.',
            noComments: 'No comments yet. Be the first to comment!',
            success: 'Comment submitted! It will be moderated shortly.',
            error: 'Error submitting comment. Please try again.'
        },
        footer: { rights: 'All rights reserved.', backToSite: 'Back to site' }
    },
    fr: {
        nav: { home: 'Accueil', services: 'Services', forum: 'Forum', contact: 'Contact' },
        hero: { subtitle: 'Découvrez des destinations, restaurants et conseils de voyage partagés par la communauté' },
        search: { placeholder: '🔍 Rechercher des posts...' },
        filter: { all: 'Tous', destinations: 'Destinations', restaurants: 'Restaurants', tips: 'Conseils de Voyage', activities: 'Activités' },
        loading: 'Chargement des posts...',
        'loading.post': 'Chargement du post...',
        noResults: 'Aucun post trouvé. Essayez une autre recherche !',
        post: { readAlso: 'Lire Aussi', likes: 'J\'aime', notFound: 'Post non trouvé.', by: 'par' },
        comments: {
            title: 'Commentaires',
            leaveComment: 'Laisser un Commentaire',
            name: 'Nom *',
            comment: 'Commentaire *',
            submit: 'Envoyer le Commentaire',
            moderation: 'Les commentaires seront modérés avant d\'apparaître.',
            noComments: 'Pas encore de commentaires. Soyez le premier à commenter !',
            success: 'Commentaire envoyé ! Il sera modéré sous peu.',
            error: 'Erreur lors de l\'envoi du commentaire. Veuillez réessayer.'
        },
        footer: { rights: 'Tous droits réservés.', backToSite: 'Retour au site' }
    }
};

// ============================================
// LANGUAGE MANAGEMENT
// ============================================

let currentForumLang = 'pt';

function initForumLanguage() {
    // Priority: URL param > localStorage > default (pt)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    const storedLang = localStorage.getItem('forumLang');
    currentForumLang = urlLang || storedLang || 'pt';
    if (!forumTranslations[currentForumLang]) currentForumLang = 'pt';

    // Update UI
    const langCode = document.getElementById('langCode');
    if (langCode) langCode.textContent = currentForumLang.toUpperCase();
    document.documentElement.lang = currentForumLang;

    updateForumContent();
}

function changeForumLanguage(lang) {
    currentForumLang = lang;
    localStorage.setItem('forumLang', lang);

    const langCode = document.getElementById('langCode');
    const langDropdown = document.getElementById('langDropdown');
    if (langCode) langCode.textContent = lang.toUpperCase();
    if (langDropdown) langDropdown.classList.remove('show');
    document.documentElement.lang = lang;

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    history.replaceState({}, '', url);

    updateForumContent();

    // Re-render posts if on listing page
    if (currentPage === 'forum' && postsContainer && forum.posts.length > 0) {
        displayPosts(forum.posts);
    }

    // Re-render post if on detail page
    if (currentPage === 'post' && forum._currentPost) {
        displayPost(forum._currentPost);
        displayComments(forum.currentPostId);
    }
}

function updateForumContent() {
    // Update data-translate elements
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(el => {
        const key = el.getAttribute('data-translate');
        const translation = getForumTranslation(key);
        if (translation) el.textContent = translation;
    });

    // Update placeholder attributes
    const placeholders = document.querySelectorAll('[data-translate-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-translate-placeholder');
        const translation = getForumTranslation(key);
        if (translation) el.placeholder = translation;
    });
}

function getForumTranslation(key) {
    const keys = key.split('.');
    let value = forumTranslations[currentForumLang];
    for (const k of keys) {
        value = value?.[k];
    }
    return value;
}

// Helper: get localized field from a post object
// Looks for field_lang (e.g. title_en), falls back to field
function getLocalizedField(obj, field) {
    if (!obj) return '';
    const langField = `${field}_${currentForumLang}`;
    return obj[langField] || obj[field] || '';
}

// ============================================
// FORUM DATA MANAGEMENT CLASS
// ============================================

class ForumManager {
    constructor() {
        this.posts = [];
        this.comments = {};
        this.likes = this.loadLikes();
        this.currentPostId = null;
        this._currentPost = null; // Store for re-rendering on lang change
    }

    loadLikes() {
        const stored = localStorage.getItem('forumLikes');
        return stored ? JSON.parse(stored) : {};
    }

    saveLikes() {
        localStorage.setItem('forumLikes', JSON.stringify(this.likes));
    }

    async loadAllPosts() {
        const postIds = [
            'malta-best-restaurants',
            'malta-hidden-gems',
            'iceland-hiking-guide',
            'iceland-budget-tips',
            'japan-tokyo-itinerary'
        ];

        for (const id of postIds) {
            try {
                const response = await fetch(`./posts/${id}.json`);
                if (response.ok) {
                    const post = await response.json();
                    post.likes = this.likes[id] || 0;
                    this.posts.push(post);
                } else {
                    console.error(`Failed to load ${id}: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error loading post ${id}:`, error);
            }
        }
        return this.posts;
    }

    async loadPost(postId) {
        try {
            const postResponse = await fetch(`./posts/${postId}.json`);
            if (!postResponse.ok) throw new Error('Post not found');

            const post = await postResponse.json();
            post.likes = this.likes[postId] || 0;
            this.currentPostId = postId;
            this._currentPost = post;

            // Load comments
            try {
                const commentsResponse = await fetch(`./comments/${postId}.json`);
                if (commentsResponse.ok) {
                    const data = await commentsResponse.json();
                    this.comments[postId] = data.comments || [];
                }
            } catch (error) {
                console.log('No comments yet for this post');
                this.comments[postId] = [];
            }

            return post;
        } catch (error) {
            console.error('Error loading post:', error);
            return null;
        }
    }

    addLike(postId) {
        this.likes[postId] = (this.likes[postId] || 0) + 1;
        this.saveLikes();
        return this.likes[postId];
    }

    getApprovedComments(postId) {
        return this.comments[postId]?.filter(c => c.approved) || [];
    }
}

// ============================================
// INITIALIZE
// ============================================

const forum = new ForumManager();

// ============================================
// DOM ELEMENTS
// ============================================

const postsContainer = document.getElementById('postsContainer');
const postContent = document.getElementById('postContent');
const postLoading = document.getElementById('postLoading');
const commentsSection = document.getElementById('commentsSection');
const commentsList = document.getElementById('commentsList');
const commentForm = document.getElementById('commentForm');
const noResults = document.getElementById('noResults');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');

// ============================================
// DETECT CURRENT PAGE
// ============================================

const currentPage = window.location.pathname.endsWith('/post.html') || window.location.pathname.includes('post.html') ? 'post' : 'forum';

// ============================================
// PAGE: FORUM LISTING (index.html)
// ============================================

if (currentPage === 'forum' && postsContainer) {
    let filteredPosts = [];

    async function initForumPage() {
        await forum.loadAllPosts();
        displayPosts(forum.posts);
        filteredPosts = [...forum.posts];
    }

    // Display posts in grid — with localized fields
    window.displayPosts = function(posts) {
        if (posts.length === 0) {
            postsContainer.innerHTML = '';
            noResults.classList.remove('hidden');
            return;
        }

        noResults.classList.add('hidden');
        postsContainer.innerHTML = posts.map(post => {
            const title = getLocalizedField(post, 'title');
            const excerpt = getLocalizedField(post, 'excerpt');
            const readTime = getLocalizedField(post, 'readTime');

            return `
            <div class="post-card" onclick="openPost('${post.id}')">
                <div class="post-card-image-wrapper">
                    <img src="${post.thumbnail || './img/default.png'}" alt="${title}" class="post-card-image" onerror="this.style.display='none'">
                </div>
                <div class="post-card-content">
                    <span class="post-card-badge">${post.destination}</span>
                    <h3 class="post-card-title">${title}</h3>
                    <p class="post-card-excerpt">${excerpt}</p>
                    <div class="post-card-meta">
                        <span class="post-card-readtime">${readTime || '5 min'}</span>
                        <span class="post-card-likes">♥ ${post.likes || 0}</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    };

    // Filter by category
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            const filtered = filter === 'all'
                ? forum.posts
                : forum.posts.filter(p => p.category.toLowerCase() === filter);

            filteredPosts = filtered;
            displayPosts(filtered);
        });
    });

    // Search posts — searches across all language fields
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const searched = filteredPosts.filter(p => {
                const title = getLocalizedField(p, 'title').toLowerCase();
                const excerpt = getLocalizedField(p, 'excerpt').toLowerCase();
                const dest = p.destination.toLowerCase();
                return title.includes(query) || excerpt.includes(query) || dest.includes(query);
            });
            displayPosts(searched);
        });
    }

    // Open individual post
    window.openPost = function(postId) {
        sessionStorage.setItem('selectedPostId', postId);
        const langParam = currentForumLang !== 'pt' ? `&lang=${currentForumLang}` : `?lang=${currentForumLang}`;
        window.location.href = `./post.html?id=${postId}&lang=${currentForumLang}`;
    };

    document.addEventListener('DOMContentLoaded', () => {
        initForumLanguage();
        initForumPage();
    });
}

// ============================================
// PAGE: INDIVIDUAL POST (post.html)
// ============================================

if (currentPage === 'post' && postContent) {

    async function initPostPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('id') || sessionStorage.getItem('selectedPostId');

        if (!postId) {
            window.location.href = './index.html';
            return;
        }

        const post = await forum.loadPost(postId);
        if (!post) {
            const notFoundText = getForumTranslation('post.notFound') || 'Post não encontrado.';
            postLoading.innerHTML = `<p>${notFoundText}</p>`;
            return;
        }

        displayPost(post);
        displayComments(postId);
        setupCommentForm(postId);
    }

    window.displayPost = function(post) {
        postLoading.classList.add('hidden');
        postContent.classList.remove('hidden');
        commentsSection.classList.remove('hidden');

        const title = getLocalizedField(post, 'title');
        const content = getLocalizedField(post, 'content');
        const readTime = getLocalizedField(post, 'readTime');
        const byText = getForumTranslation('post.by') || 'por';

        // Locale map for date formatting
        const localeMap = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };
        const locale = localeMap[currentForumLang] || 'pt-PT';

        document.getElementById('postTitle').textContent = title;
        document.getElementById('postAuthor').textContent = `${byText} ${post.author}`;
        document.getElementById('postDate').textContent = new Date(post.date).toLocaleDateString(locale);
        document.getElementById('postReadTime').textContent = readTime || '5 min read';
        document.getElementById('postDestination').textContent = `📍 ${post.destination}`;
        document.getElementById('postImage').src = post.thumbnail || './img/default.png';
        document.getElementById('postImage').alt = title;

        document.getElementById('postBody').innerHTML = content;

        // Affiliate link
        if (post.affiliateLink) {
            const affiliateText = getLocalizedField(post.affiliateLink, 'text');
            document.getElementById('affiliateLink').href = post.affiliateLink.url;
            document.getElementById('affiliateText').textContent = affiliateText;
            document.getElementById('affiliateSection').classList.remove('hidden');
        }

        // CTA
        const ctaText = getLocalizedField(post.cta, 'text');
        const ctaButton = getLocalizedField(post.cta, 'button');
        document.getElementById('ctaTitle').textContent = ctaText;
        document.getElementById('ctaButton').href = post.cta.link;
        document.getElementById('ctaButton').textContent = ctaButton;

        // Like button
        const likeBtn = document.getElementById('likeBtn');
        document.getElementById('likeCount').textContent = post.likes;

        if (forum.likes[post.id]) {
            likeBtn.classList.add('liked');
        }

        // Remove old listener by cloning
        const newLikeBtn = likeBtn.cloneNode(true);
        likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
        newLikeBtn.addEventListener('click', () => {
            const newCount = forum.addLike(post.id);
            document.getElementById('likeCount').textContent = newCount;
            newLikeBtn.classList.add('liked');
        });

        // Related posts
        if (post.relatedPosts && post.relatedPosts.length > 0) {
            document.getElementById('relatedSection').classList.remove('hidden');
        }

        // Update page title
        document.title = `${title} - Travel Frontiers Forum`;
    };

    window.displayComments = function(postId) {
        const approvedComments = forum.getApprovedComments(postId);
        const noCommentsText = getForumTranslation('comments.noComments') || 'Sem comentários ainda.';
        const localeMap = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };
        const locale = localeMap[currentForumLang] || 'pt-PT';

        if (approvedComments.length === 0) {
            commentsList.innerHTML = `<p style="color: #9ca3af;">${noCommentsText}</p>`;
            return;
        }

        commentsList.innerHTML = approvedComments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${comment.name}</span>
                    <span class="comment-date">${new Date(comment.date).toLocaleDateString(locale)}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
            </div>
        `).join('');
    };

    function setupCommentForm(postId) {
        if (!commentForm) return;

        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('commenterName').value;
            const email = document.getElementById('commenterEmail').value;
            const text = document.getElementById('commenterText').value;

            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('comment', text);
            formData.append('postId', postId);

            try {
                const response = await fetch('https://formspree.io/f/mwveqvbl', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                const successText = getForumTranslation('comments.success') || 'Comentário enviado!';
                const errorText = getForumTranslation('comments.error') || 'Erro ao enviar comentário.';

                if (response.ok) {
                    alert(successText);
                    commentForm.reset();
                } else {
                    alert(errorText);
                }
            } catch (error) {
                console.error('Error submitting comment:', error);
                const errorText = getForumTranslation('comments.error') || 'Erro ao enviar comentário.';
                alert(errorText);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initForumLanguage();
        initPostPage();
    });
}

// ============================================
// SHARED: Language selector + Mobile menu
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Language selector toggle
    const langButton = document.getElementById('currentLang');
    const langDropdown = document.getElementById('langDropdown');
    if (langButton && langDropdown) {
        langButton.addEventListener('click', () => langDropdown.classList.toggle('show'));
        document.addEventListener('click', (e) => {
            if (!langButton.contains(e.target) && !langDropdown.contains(e.target)) {
                langDropdown.classList.remove('show');
            }
        });
    }

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('show');
            mobileMenuBtn.classList.toggle('active');
        });
    }
});

// ============================================
// END OF FORUM SCRIPT
// ============================================
