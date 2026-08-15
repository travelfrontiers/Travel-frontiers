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

    // Re-render post + related if on detail page
    if (currentPage === 'post' && forum._currentPost) {
        displayPost(forum._currentPost);
        displayRelatedPosts();
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

// Helper: return localized category label
const CATEGORY_MAP = {
    destinos:    { pt: 'Destinos',    en: 'Destinations', fr: 'Destinations' },
    restaurants: { pt: 'Restaurantes', en: 'Restaurants',  fr: 'Restaurants'  },
    dicas:       { pt: 'Dicas',        en: 'Tips',          fr: 'Conseils'     },
    atividades:  { pt: 'Atividades',   en: 'Activities',    fr: 'Activités'    }
};

function getLocalizedCategory(category) {
    if (!category) return '';
    const key = category.toLowerCase();
    const map = CATEGORY_MAP[key];
    return map ? (map[currentForumLang] || map.pt) : category;
}

// Helper: relative date string
function formatRelativeDate(dateStr) {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diffDays < 1)  return { pt: 'Hoje', en: 'Today', fr: "Auj." }[currentForumLang]  || 'Today';
    if (diffDays < 30) return { pt: `${diffDays}d atrás`, en: `${diffDays}d ago`, fr: `il y a ${diffDays}j` }[currentForumLang] || `${diffDays}d ago`;
    const m = Math.floor(diffDays / 30);
    if (m < 12)        return { pt: `${m}m atrás`, en: `${m}mo ago`, fr: `il y a ${m}m` }[currentForumLang] || `${m}mo ago`;
    const y = Math.floor(m / 12);
    return { pt: `${y}a atrás`, en: `${y}y ago`, fr: `il y a ${y}a` }[currentForumLang] || `${y}y ago`;
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
        try {
            // Load all posts from central index (1 single fast request)
            const response = await fetch('./posts/index.json');
            if (response.ok) {
                const postsList = await response.json();
                this.posts = postsList.map(post => {
                    post.likes = this.likes[post.id] || post.likes || 0;
                    return post;
                });
                return this.posts;
            }
        } catch (error) {
            console.error('Error loading posts index:', error);
        }
        return [];
    }

    async loadPost(postId) {
        try {
            const postResponse = await fetch(`./posts/${postId}.json`);
            if (!postResponse.ok) throw new Error('Post not found');

            const post = await postResponse.json();
            post.likes = this.likes[postId] || post.likes || 0;
            this.currentPostId = postId;
            this._currentPost = post;

            // Load comments (defaults cleanly to empty list on 404 without needing boilerplate files)
            try {
                const commentsResponse = await fetch(`./comments/${postId}.json`);
                if (commentsResponse.ok) {
                    const data = await commentsResponse.json();
                    this.comments[postId] = data.comments || [];
                } else {
                    this.comments[postId] = [];
                }
            } catch (_) {
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

    async loadRelatedPosts(ids) {
        const related = [];
        for (const id of ids) {
            try {
                const res = await fetch(`./posts/${id}.json`);
                if (res.ok) related.push(await res.json());
            } catch (_) { /* skip missing */ }
        }
        this._relatedPosts = related;
        return related;
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
            const catLabel = getLocalizedCategory(post.category);
            const dateLabel = formatRelativeDate(post.date);
            const firstName = (post.author || '').split(' ')[0];

            return `
            <div class="post-card" onclick="openPost('${post.id}')">
                <div class="post-card-image-wrapper">
                    <img src="${post.thumbnail || './img/default.png'}" alt="${title}" class="post-card-image" onerror="this.style.display='none'">
                    <span class="post-card-category">${catLabel}</span>
                </div>
                <div class="post-card-content">
                    <div class="post-card-destination">📍 ${post.destination}</div>
                    <h3 class="post-card-title">${title}</h3>
                    <p class="post-card-excerpt">${excerpt}</p>
                    <div class="post-card-meta">
                        <span class="post-card-author">✍ ${firstName}</span>
                        <span class="post-card-date">${dateLabel}</span>
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
            const byCategory = filter === 'all'
                ? forum.posts
                : forum.posts.filter(p => p.category.toLowerCase() === filter);

            filteredPosts = byCategory;

            // Re-apply any active search query on top of the new category filter
            const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
            if (query) {
                const searched = byCategory.filter(p => {
                    const title = getLocalizedField(p, 'title').toLowerCase();
                    const excerpt = getLocalizedField(p, 'excerpt').toLowerCase();
                    const dest = p.destination.toLowerCase();
                    return title.includes(query) || excerpt.includes(query) || dest.includes(query);
                });
                displayPosts(searched);
            } else {
                displayPosts(byCategory);
            }
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
        const postId = urlParams.get('id');

        if (!postId) {
            window.location.href = './';
            return;
        }

        const post = await forum.loadPost(postId);
        if (!post) {
            const notFoundText = getForumTranslation('post.notFound') || 'Post não encontrado.';
            postLoading.innerHTML = `<p>${notFoundText}</p>`;
            return;
        }

        // Load related posts before rendering so cards are available
        if (post.relatedPosts && post.relatedPosts.length > 0) {
            await forum.loadRelatedPosts(post.relatedPosts);
        } else {
            forum._relatedPosts = [];
        }

        displayPost(post);
        displayRelatedPosts();
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
        // FIX: CSS ::before already adds 📍 — only set the text
        document.getElementById('postDestination').textContent = post.destination;
        document.getElementById('postImage').src = post.thumbnail || './img/default.png';
        document.getElementById('postImage').alt = title;

        document.getElementById('postBody').innerHTML = content;

        // Tags
        const postTagsEl = document.getElementById('postTags');
        if (postTagsEl && post.tags && post.tags.length > 0) {
            postTagsEl.innerHTML = post.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');
            postTagsEl.classList.remove('hidden');
        } else if (postTagsEl) {
            postTagsEl.classList.add('hidden');
        }

        // Breadcrumb — preserve active language in URL
        const breadcrumb = document.getElementById('breadcrumbBack');
        if (breadcrumb) breadcrumb.href = `./?lang=${currentForumLang}`;

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

        // Update page title
        document.title = `${title} - Travel Frontiers Forum`;
    };

    // Render related posts from pre-loaded forum._relatedPosts
    window.displayRelatedPosts = function() {
        const related = forum._relatedPosts || [];
        const relatedSection = document.getElementById('relatedSection');
        const relatedContainer = document.getElementById('relatedContainer');
        if (!relatedSection || !relatedContainer) return;

        if (related.length === 0) {
            relatedSection.classList.add('hidden');
            return;
        }

        relatedSection.classList.remove('hidden');
        relatedContainer.innerHTML = related.map(rp => {
            const rpTitle = getLocalizedField(rp, 'title');
            return `
                <a class="related-item" href="./post.html?id=${rp.id}&lang=${currentForumLang}">
                    <img class="related-item-img" src="${rp.thumbnail || './img/default.png'}" alt="${rpTitle}" onerror="this.style.display='none'">
                    <div class="related-item-body">
                        <span class="related-item-dest">${rp.destination}</span>
                        <h4>${rpTitle}</h4>
                    </div>
                </a>
            `;
        }).join('');
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
            const feedbackEl = document.getElementById('formFeedback');

            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('comment', text);
            formData.append('postId', postId);

            const successText = getForumTranslation('comments.success') || 'Comentário enviado!';
            const errorText = getForumTranslation('comments.error') || 'Erro ao enviar comentário.';

            try {
                const response = await fetch('https://formspree.io/f/mwveqvbl', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    if (feedbackEl) {
                        feedbackEl.textContent = successText;
                        feedbackEl.className = 'form-feedback success';
                    }
                    commentForm.reset();
                } else {
                    if (feedbackEl) {
                        feedbackEl.textContent = errorText;
                        feedbackEl.className = 'form-feedback error';
                    }
                }
            } catch (error) {
                console.error('Error submitting comment:', error);
                if (feedbackEl) {
                    feedbackEl.textContent = errorText;
                    feedbackEl.className = 'form-feedback error';
                }
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
