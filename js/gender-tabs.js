document.addEventListener('DOMContentLoaded', function() {
    // =============================================
    // STATE AND CONFIGURATION
    // =============================================
    const state = {
        contentCache: new Map(),
        currentGender: '',
        isLoading: false,
        retryCount: 0,
        maxRetries: 3,
        prefetchedGenders: new Set(),
        carouselInstances: new Map() // Track carousel instances
    };

    const config = {
        ajaxurl: '/wp-admin/admin-ajax.php',
        validGenders: ['women', 'men', 'kids'],
        loadingTimeout: 30000,
        retryDelay: 1000,
        animationDuration: 300,
        prefetchDelay: 2000,
        get nonce() {
            return document.getElementById('gender-tabs-nonce')?.value || '';
        }
    };

    // =============================================
    // DOM ELEMENT CACHE
    // =============================================
    const elements = {
        tabsContainer: document.getElementById('gender-tabs-container'),
        contentContainer: document.getElementById('woocommerce-gender-content'),
        nonceInput: document.getElementById('gender-tabs-nonce'),
        intersectionObserver: null,
        get allTabs() {
            return Array.from(document.querySelectorAll('.tab-btn'));
        },
        get allMenus() {
            return Array.from(document.querySelectorAll('.comboMenu'));
        }
    };

    // =============================================
    // CAROUSEL AND SLIDER INITIALIZATION
    // =============================================
    const CarouselManager = {
    initializedCarousels: new Set(),

    initializeAll() {
        // 1. Product Carousels
        this.initProductCarousels();

        // 2. Offer Carousels
        this.initOfferCarousels();

        // 3. Banner Carousels
        this.initBannerCarousels();

        // 4. AWS Sliders (NEW)
        this.initAWSSliders();

        // 5. Category Images
        this.initCategoryImages();
    },

    // Add this new method for AWS Sliders
    initAWSSliders() {
        document.querySelectorAll('.aws-slider:not(.initialized)').forEach(sliderEl => {
            try {
                if (typeof AWSSlider !== 'undefined') {
                    new AWSSlider(sliderEl);
                    sliderEl.classList.add('initialized');
                    this.initializedCarousels.add(sliderEl);
                }
            } catch (error) {
                console.error('AWS Slider init error:', error);
            }
        });
    },

    initProductCarousels() {
        document.querySelectorAll('.pc-carousel-wrapper:not(.initialized)').forEach(carousel => {
            try {
                const container = carousel.querySelector('.pc-carousel-container');
                if (!container || !container.children.length) {
                    console.warn('Product carousel empty, skipping');
                    return;
                }

                new ProductCarousel(carousel);
                carousel.classList.add('initialized');
                this.initializedCarousels.add(carousel);
            } catch (error) {
                console.error('Product carousel init error:', error);
                this.fallbackToGrid(carousel);
            }
        });
    },

    initOfferCarousels() {
        document.querySelectorAll('.oc-carousel-wrapper:not(.initialized)').forEach(carousel => {
            try {
                if (typeof window.initCarousel === 'function') {
                    window.initCarousel(carousel);
                    carousel.classList.add('initialized');
                    this.initializedCarousels.add(carousel);
                }
            } catch (error) {
                console.error('Offer carousel init error:', error);
            }
        });
    },

    initBannerCarousels() {
        document.querySelectorAll('.abc-banner-carousel:not(.initialized)').forEach(carousel => {
            try {
                if (typeof ABCarousel !== 'undefined') {
                    new ABCarousel(carousel);
                    carousel.classList.add('initialized');
                    this.initializedCarousels.add(carousel);
                }
            } catch (error) {
                console.error('Banner carousel init error:', error);
            }
        });
    },

    initCategoryImages() {
        // Ensure category images load (lazy-load if needed)
        if (typeof initImageLoadStates === 'function') {
            initImageLoadStates();
        }
    },

    fallbackToGrid(carousel) {
        const container = carousel.querySelector('.pc-carousel-container');
        if (container) {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            container.style.gap = '20px';
        }
        carousel.querySelectorAll('.pc-carousel-prev, .pc-carousel-next').forEach(btn => {
            btn.style.display = 'none';
        });
    },

    destroyAll() {
        // Clean up only dynamically created instances
        this.initializedCarousels.forEach(carousel => {
            const instance = carousel._carouselInstance; // Assumes your carousels store instances
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
            }
            carousel.classList.remove('initialized');
        });
        this.initializedCarousels.clear();
    }
};

    // =============================================
    // PERFORMANCE UTILITIES
    // =============================================
    class Performance {
        constructor() {
            this.prefetchContent = this.prefetchContent.bind(this);
            this.setupIntersectionObserver = this.setupIntersectionObserver.bind(this);
            
            this.requestIdleCallback = (window.requestIdleCallback || 
                ((cb) => setTimeout(() => cb({
                    didTimeout: false,
                    timeRemaining: () => 1
                }), 1))).bind(window);

            this.cancelIdleCallback = (window.cancelIdleCallback || window.clearTimeout).bind(window);
        }

        async prefetchContent(gender) {
            if (state.contentCache.has(gender) || state.prefetchedGenders.has(gender)) return;
            
            state.prefetchedGenders.add(gender);
            
            try {
                const formData = new URLSearchParams({
                    action: 'load_gender_content',
                    gender,
                    nonce: config.nonce
                });

                const response = await fetch(config.ajaxurl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-WP-Nonce': config.nonce,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: formData
                });

                const data = await response.json();
                if (data.success) {
                    state.contentCache.set(gender, data.data.content);
                }
            } catch (error) {
                console.warn(`Prefetch failed for ${gender}:`, error);
            }
        }

        setupIntersectionObserver() {
            if (!('IntersectionObserver' in window)) return;

            const observerCallback = (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const gender = entry.target.dataset.gender;
                        if (gender) {
                            this.prefetchContent(gender);
                        }
                    }
                });
            };

            elements.intersectionObserver = new IntersectionObserver(
                observerCallback.bind(this),
                { threshold: 0.1 }
            );

            elements.allTabs.forEach(tab => {
                elements.intersectionObserver.observe(tab);
            });

 // Add this new block right after the IntersectionObserver setup
    // Prefetch content on hover (before click)
    elements.allTabs.forEach(tab => {
        tab.addEventListener('mouseenter', () => {
            const gender = tab.dataset.gender || utils.extractGenderFromUrl(tab.href);
            if (!state.contentCache.has(gender)) {
                performance.prefetchContent(gender);
            }
        }, { once: true }); // Only prefetch once per tab
    });
       
        }
    }

    const performance = new Performance();

    // =============================================
    // UTILITIES
    // =============================================
    const utils = {
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        async fetchWithTimeout(url, options, timeout) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        },

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        extractGenderFromUrl(url) {
            return config.validGenders.find(gender => url.includes(`/${gender}`)) || 'men';
        },

        isValidGender(gender) {
            return config.validGenders.includes(gender);
        },

        handleError(error, retryCallback) {
            console.error('Error:', error);
            const message = error.message || 'An error occurred. Please try again.';
            UI.showErrorState(message, true, retryCallback);
        }
    };

    // =============================================
    // UI MANAGEMENT
    // =============================================
    const UI = {
        updateActiveTab(activeBtn) {
            if (!activeBtn) return;
            
            elements.allMenus.forEach(menu => {
                const btn = menu.querySelector('.tab-btn');
                menu.classList.remove('home-active-tab-class');
                if (btn) {
                    btn.style.fontWeight = '400';
                    btn.setAttribute('aria-selected', 'false');
                    btn.setAttribute('tabindex', '-1');
                }
            });
            
            const activeMenu = activeBtn.closest('.comboMenu');
            if (activeMenu) {
                activeMenu.classList.add('home-active-tab-class');
                activeBtn.style.fontWeight = '600';
                activeBtn.setAttribute('aria-selected', 'true');
                activeBtn.setAttribute('tabindex', '0');
            }
        },

        addRippleEffect(button, event) {
            const ripple = button.querySelector('.ripple');
            if (!ripple) return;

            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            
            ripple.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${event.clientX - rect.left - size/2}px;
                top: ${event.clientY - rect.top - size/2}px;
            `;
            
            ripple.classList.remove('active');
            requestAnimationFrame(() => ripple.classList.add('active'));
        },

        showLoadingState() {
            if (!elements.contentContainer) return;
            
            elements.contentContainer.classList.add('loading');
            elements.contentContainer.setAttribute('aria-busy', 'true');
            elements.contentContainer.innerHTML = `
                <div class="loading-content" role="status" aria-live="polite">
                    <div class="loading-spinner" aria-hidden="true"></div>
                    <div>Loading collection...</div>
                </div>`;
        },

        showErrorState(message, isRetryable = true, retryCallback) {
            if (!elements.contentContainer) return;
            
            elements.contentContainer.classList.remove('loading');
            elements.contentContainer.setAttribute('aria-busy', 'false');
            elements.contentContainer.innerHTML = `
                <div class="error-message" role="alert">
                    <p>${message || 'Error loading content. Please try again.'}</p>
                    ${isRetryable ? '<button class="retry-btn" type="button">Retry</button>' : ''}
                </div>`;

            if (isRetryable && retryCallback) {
                const retryBtn = elements.contentContainer.querySelector('.retry-btn');
                retryBtn?.addEventListener('click', retryCallback, { once: true });
            }
        },

        updateBodyClass(gender) {
            document.body.classList.remove('men-page', 'women-page', 'kids-page');
            document.body.classList.add(`${gender}-page`);
        },

        ensureTabsVisible() {
            if (!elements.tabsContainer) return;
            
            elements.tabsContainer.style.cssText = `
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                height: 50px !important;
            `;
        },

        setupAccessibility() {
            elements.tabsContainer?.setAttribute('role', 'tablist');
            elements.allTabs.forEach(tab => {
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', 'false');
                tab.setAttribute('tabindex', '-1');
            });
            elements.contentContainer?.setAttribute('role', 'tabpanel');
        }
    };

    // =============================================
    // CONTENT MANAGEMENT
    // =============================================
    async function loadContent(url, isRetry = false) {
        if (!elements.contentContainer || state.isLoading) return;

        state.isLoading = true;
        UI.showLoadingState();

        try {
            const gender = utils.extractGenderFromUrl(url);
            const formData = new URLSearchParams({
                action: 'load_gender_content',
                gender,
                nonce: config.nonce
            });

            const response = await fetch(config.ajaxurl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) throw new Error('Failed to load content');

            // Clean up existing carousels
            CarouselManager.destroyAll();

            // Update content
            elements.contentContainer.innerHTML = data.data.content;

            // Add small delay before initialization
            await utils.delay(100);
            
            // Initialize all carousels
            CarouselManager.initializeAll();

          setTimeout(() => CarouselManager.initializeAll(), 500); // Double-check initialization

            window.dispatchEvent(new CustomEvent('gender-tab-loaded', {
                detail: { gender }
            }));

            state.contentCache.set(gender, data.data.content);
            history.pushState({ gender }, '', url);
            
        } catch (error) {
            console.error('Tab load error:', error);
            UI.showErrorState('Failed to load content. Please try again.');
        } finally {
            state.isLoading = false;
            elements.contentContainer.classList.remove('loading');
        }
    }

    // =============================================
    // EVENT HANDLERS
    // =============================================
    function initializeEventListeners() {
        elements.tabsContainer?.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.tab-btn');
            if (!tabBtn) return;
            
            e.preventDefault();
            UI.addRippleEffect(tabBtn, e);
            UI.updateActiveTab(tabBtn);
            loadContent(tabBtn.href);
        });

        elements.tabsContainer?.addEventListener('keydown', (e) => {
            const targetTab = e.target.closest('.tab-btn');
            if (!targetTab) return;

            let newTab;
            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    newTab = targetTab.closest('.comboMenu').previousElementSibling?.querySelector('.tab-btn');
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    newTab = targetTab.closest('.comboMenu').nextElementSibling?.querySelector('.tab-btn');
                    break;
                case 'Home':
                    e.preventDefault();
                    newTab = elements.allTabs[0];
                    break;
                case 'End':
                    e.preventDefault();
                    newTab = elements.allTabs[elements.allTabs.length - 1];
                    break;
            }

            if (newTab) {
                newTab.focus();
                UI.updateActiveTab(newTab);
                loadContent(newTab.href);
            }
        });

        window.addEventListener('popstate', (e) => {
            if (e.state?.gender) {
                const tabBtn = document.querySelector(`.tab-btn.${e.state.gender}`);
                if (tabBtn) {
                    UI.updateActiveTab(tabBtn);
                    loadContent(tabBtn.href);
                }
            }
        });
    }

    // =============================================
    // INITIALIZATION
    // =============================================
    function init() {
        UI.ensureTabsVisible();
        UI.setupAccessibility();
        
        const path = window.location.pathname;
        const initialGender = path.includes('/women') ? 'women' : 
                            path.includes('/kids') ? 'kids' : 'men';
        
        const initialTab = document.querySelector(`.tab-btn.${initialGender}`);
        if (initialTab) {
            UI.updateActiveTab(initialTab);
            UI.updateBodyClass(initialGender);
        }

        CarouselManager.initializeAll();
        initializeEventListeners();
        performance.setupIntersectionObserver();

        setTimeout(() => {
            config.validGenders.forEach(gender => {
                if (gender !== initialGender) {
                    performance.requestIdleCallback(() => {
                        performance.prefetchContent(gender);
                    });
                }
            });
        }, config.prefetchDelay);
    }

    init();
});
