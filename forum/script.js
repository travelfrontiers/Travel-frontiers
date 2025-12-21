// ============================================
// FORUM DATA MANAGEMENT CLASS
// ============================================

class ForumManager {
    constructor() {
        this.posts = [];
        this.comments = {};
        this.likes = this.loadLikes();
        this.currentPostId = null;
    }

    // Load likes from localStorage
    loadLikes() {
        const stored = localStorage.getItem('forumLikes');
        return stored ? JSON.parse(stored) : {};
    }

    // Save likes to localStorage
    saveLikes() {
        localStorage.setItem('forumLikes', JSON.stringify(this.likes));
    }

    // Fetch all posts - CAMINHO RELATIVO CORRETO
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

    // Fetch single post - CAMINHO RELATIVO CORRETO
    async loadPost(postId) {
        try {
            const postResponse = await fetch(`./posts/${postId}.json`);
            if (!postResponse.ok) throw new Error('Post not found');
            
            const post = await postResponse.json();
            post.likes = this.likes[postId] || 0;
            this.currentPostId = postId;

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

    // Add like
    addLike(postId) {
        this.likes[postId] = (this.likes[postId] || 0) + 1;
        this.saveLikes();
        return this.likes[postId];
    }

    // Get approved comments
    getApprovedComments(postId) {
        return this.comments[postId]?.filter(c => c.approved) || [];
    }
}

// ============================================
// INITIALIZE FORUM MANAGER
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

    // Load and display all posts
    async function initForumPage() {
        await forum.loadAllPosts();
        displayPosts(forum.posts);
        filteredPosts = [...forum.posts];
    }

    // Display posts in grid
    function displayPosts(posts) {
        if (posts.length === 0) {
            postsContainer.innerHTML = '';
            noResults.classList.remove('hidden');
            return;
        }

        noResults.classList.add('hidden');
        postsContainer.innerHTML = posts.map(post => `
            <div class="post-card" onclick="openPost('${post.id}')">
                <img src="${post.thumbnail || './img/default.jpg'}" alt="${post.title}" class="post-card-image" onerror="this.src='./img/default.jpg'">
                <div class="post-card-content">
                    <span class="post-card-badge">${post.destination}</span>
                    <h3 class="post-card-title">${post.title}</h3>
                    <p class="post-card-excerpt">${post.excerpt || ''}</p>
                    <div class="post-card-meta">
                        <span class="post-card-readtime">${post.readTime || '5 min'}</span>
                        <span class="post-card-likes">♥ ${post.likes || 0}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

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

    // Search posts
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const searched = filteredPosts.filter(p => 
                p.title.toLowerCase().includes(query) || 
                p.excerpt?.toLowerCase().includes(query) ||
                p.destination.toLowerCase().includes(query)
            );
            displayPosts(searched);
        });
    }

    // Open individual post - CAMINHO RELATIVO CORRETO
    window.openPost = function(postId) {
        sessionStorage.setItem('selectedPostId', postId);
        window.location.href = `./post.html?id=${postId}`;
    };

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', initForumPage);
}

// ============================================
// PAGE: INDIVIDUAL POST (post.html)
// ============================================

if (currentPage === 'post' && postContent) {
    
    async function initPostPage() {
        // Get post ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('id') || sessionStorage.getItem('selectedPostId');

        if (!postId) {
            window.location.href = './index.html';
            return;
        }

        const post = await forum.loadPost(postId);
        if (!post) {
            postLoading.innerHTML = '<p>Post não encontrado.</p>';
            return;
        }

        // Display post
        displayPost(post);
        displayComments(postId);

        // Setup comment form
        setupCommentForm(postId);
    }

    function displayPost(post) {
        postLoading.classList.add('hidden');
        postContent.classList.remove('hidden');
        commentsSection.classList.remove('hidden');

        // Set header information
        document.getElementById('postTitle').textContent = post.title;
        document.getElementById('postAuthor').textContent = `by ${post.author}`;
        document.getElementById('postDate').textContent = new Date(post.date).toLocaleDateString('pt-PT');
        document.getElementById('postReadTime').textContent = post.readTime || '5 min read';
        document.getElementById('postDestination').textContent = `📍 ${post.destination}`;
        document.getElementById('postImage').src = post.thumbnail || './img/default.jpg';
        document.getElementById('postImage').alt = post.title;

        // Set body content
        document.getElementById('postBody').innerHTML = post.content;

        // Show affiliate link if available
        if (post.affiliateLink) {
            document.getElementById('affiliateLink').href = post.affiliateLink.url;
            document.getElementById('affiliateText').textContent = post.affiliateLink.text;
            document.getElementById('affiliateSection').classList.remove('hidden');
        }

        // Set CTA button
        document.getElementById('ctaTitle').textContent = post.cta.text;
        document.getElementById('ctaButton').href = post.cta.link;
        document.getElementById('ctaButton').textContent = post.cta.button;

        // Setup like button
        const likeBtn = document.getElementById('likeBtn');
        document.getElementById('likeCount').textContent = post.likes;
        
        if (forum.likes[post.id]) {
            likeBtn.classList.add('liked');
        }

        likeBtn.addEventListener('click', () => {
            const newCount = forum.addLike(post.id);
            document.getElementById('likeCount').textContent = newCount;
            likeBtn.classList.add('liked');
        });

        // Display related posts
        if (post.relatedPosts && post.relatedPosts.length > 0) {
            displayRelatedPosts(post.relatedPosts);
        }
    }

    function displayRelatedPosts(relatedIds) {
        // Show related posts section
        document.getElementById('relatedSection').classList.remove('hidden');
        // Can be expanded to load actual related posts
    }

    function displayComments(postId) {
        const approvedComments = forum.getApprovedComments(postId);
        
        if (approvedComments.length === 0) {
            commentsList.innerHTML = '<p style="color: #999;">Sem comentários ainda. Seja o primeiro a comentar!</p>';
            return;
        }

        commentsList.innerHTML = approvedComments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${comment.name}</span>
                    <span class="comment-date">${new Date(comment.date).toLocaleDateString('pt-PT')}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
            </div>
        `).join('');
    }

    function setupCommentForm(postId) {
        if (!commentForm) return;

        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('commenterName').value;
            const email = document.getElementById('commenterEmail').value;
            const text = document.getElementById('commenterText').value;

            // Prepare form data for Formspree
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('comment', text);
            formData.append('postId', postId);

            try {
                // IMPORTANT: Replace YOUR_FORM_ID with your actual Formspree form ID
                // Get form ID from https://formspree.io
                const response = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    alert('Comentário enviado! Será moderado em breve.');
                    commentForm.reset();
                } else {
                    alert('Erro ao enviar comentário. Tente novamente.');
                }
            } catch (error) {
                console.error('Error submitting comment:', error);
                alert('Erro ao enviar comentário. Tente novamente.');
            }
        });
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', initPostPage);
}

// ============================================
// END OF FORUM SCRIPT
// ============================================
