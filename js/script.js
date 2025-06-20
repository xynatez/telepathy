document.addEventListener('DOMContentLoaded', () => {

    const header = document.getElementById('header');
    const navLinks = document.querySelectorAll('.nav-links a');
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.nav-links');
    const backToTopButton = document.getElementById('back-to-top');

    document.getElementById('current-year').textContent = new Date().getFullYear();

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });

                if (mobileMenu.classList.contains('active')) {
                    hamburger.classList.remove('active');
                    mobileMenu.classList.remove('active');
                }
            }
        });
    });

    // 3. Sticky Header & Back to Top Button Visibility
    const handleScroll = () => {
        const scrollPosition = window.scrollY;

        // Sticky Header
        if (scrollPosition > 50) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }

        // Back to Top Button
        if (scrollPosition > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', handleScroll);

    // 4. Mobile Navigation Toggle
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    });

    // 5. Intersection Observer for Scroll Animations (existing elements)
    // Removed #hero p from initial animation selectors as it's now typing
    const animatedElements = document.querySelectorAll('.anim-slide-up, .anim-fade-in, .anim-scale-up, .anim-slide-left, .anim-slide-right, .anim-fade-in-up');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target); // Animate only once
            }
        });
    }, { threshold: 0.15 });

    animatedElements.forEach(element => observer.observe(element));
    
    // Initial hero H1 and Button animation
    setTimeout(() => {
        document.querySelector('#hero h1')?.classList.add('animate');
        document.querySelector('#hero .btn')?.classList.add('animate');
    }, 100);

    // 6. Portfolio Filtering
    const filterContainer = document.querySelector('.filter-buttons');
    const portfolioItems = document.querySelectorAll('.portfolio-item');

    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                // Deactivate all buttons
                filterContainer.querySelector('.active').classList.remove('active');
                // Activate clicked button
                e.target.classList.add('active');

                const filterValue = e.target.getAttribute('data-filter');

                portfolioItems.forEach(item => {
                    item.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                    item.style.transform = 'scale(0.95)';
                    item.style.opacity = '0';
                    item.style.display = 'none';

                    setTimeout(() => {
                        if (item.dataset.category === filterValue || filterValue === 'all') {
                            item.style.display = 'grid'; // or 'block' depending on item styles
                            setTimeout(() => { // small delay for re-flow
                                item.style.transform = 'scale(1)';
                                item.style.opacity = '1';
                            }, 50);
                        }
                    }, 300);
                });
            }
        });
    }

    // 7. Active Nav Link on Scroll
    const sections = document.querySelectorAll('section[id]');
    const updateActiveNavLink = () => {
        let currentSectionId = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= sectionTop - header.offsetHeight - 50) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === currentSectionId) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', updateActiveNavLink);
    updateActiveNavLink(); // Initial check on load

    // === NEW: Reusable Typing Animation Function ===
    function setupTypingAnimation(elementId, typingDelay = 30) {
        const element = document.getElementById(elementId);

        if (element) {
            const originalText = element.textContent;
            element.textContent = ''; // Clear text initially
            
            // Set opacity to 1 directly on the element's style.
            // This ensures it remains visible even after .typing-text class is removed.
            element.style.opacity = '1'; 

            let typeIndex = 0;

            const typeEffect = () => {
                if (typeIndex < originalText.length) {
                    element.textContent += originalText.charAt(typeIndex);
                    // Add typing-text class only while typing for the caret
                    if (!element.classList.contains('typing-text')) {
                        element.classList.add('typing-text');
                    }
                    typeIndex++;
                    setTimeout(typeEffect, typingDelay);
                } else {
                    element.classList.remove('typing-text'); // Remove cursor when typing is done
                }
            };

            const typingObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        typeEffect(); // Start typing when element is visible
                        observer.unobserve(entry.target); // Stop observing after animation starts
                    }
                });
            }, { threshold: 0.5 }); // Trigger when 50% of the element is visible

            typingObserver.observe(element);
        }
    }

    // Apply typing animation to both desired paragraphs
    setupTypingAnimation('hero-subtitle-text', 50); // Slightly faster for hero
    setupTypingAnimation('about-subtitle-text', 30); // Default speed for about
    // === END NEW TYPING ANIMATION ===

});
