// Global state
let allVideos = [];
let currentFilter = 'All';
let isMobile = window.innerWidth <= 768;

// Helper function to get video MIME type
function getVideoType(src) {
    const ext = src.split('.').pop().toLowerCase();
    const types = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'webm': 'video/webm',
        'ogg': 'video/ogg'
    };
    return types[ext] || 'video/mp4';
}

// Get appropriate video source based on device
function getVideoSrc(video) {
    if (isMobile) {
        return video.mobileSrc || video.src;
    }
    return video.src;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    loadManifest();
    initModal();
    initBookingForm();
});

// Initialize hero background video with looping hero_loop.mp4
function initHeroVideoRotation() {
    const heroVideo = document.getElementById('hero-video');
    const heroSource = heroVideo.querySelector('source');

    // Use appropriate hero_loop video based on device
    const videoSrc = isMobile ? 'videos/mobile/hero_loop.mp4' : 'videos/hero_loop_desktop.mp4';
    const posterSrc = 'videos/mobile/hero_poster.jpg';

    heroVideo.poster = posterSrc;
    heroSource.src = videoSrc;
    heroSource.type = getVideoType(videoSrc);
    heroVideo.loop = true; // Loop the hero video
    heroVideo.load();
    heroVideo.play().catch(err => {
        console.error('Hero video play error:', err);
    });

    // Add error handler
    heroVideo.addEventListener('error', (e) => {
        console.error('Hero video error:', e, heroVideo.error);
    });
}

// Load and render videos from manifest
async function loadManifest() {
    try {
        const response = await fetch('videos/manifest.json');
        if (!response.ok) {
            console.error('Manifest not found. Using fallback.');
            allVideos = [];
            return;
        }

        allVideos = await response.json();
        console.log('Loaded videos:', allVideos);

        // Initialize hero video
        initHeroVideoRotation();

        renderFilters();
        renderVideos();
    } catch (error) {
        console.error('Error loading manifest:', error);
    }
}

// Render filter tags
function renderFilters() {
    const filterContainer = document.getElementById('filter-tags');
    const tags = ['All', ...new Set(allVideos.map(v => v.tag))];

    filterContainer.innerHTML = tags.map(tag =>
        `<span class="filter-tag ${tag === currentFilter ? 'active' : ''}" data-tag="${tag}">${tag}</span>`
    ).join('');

    // Add click listeners
    filterContainer.querySelectorAll('.filter-tag').forEach(tagEl => {
        tagEl.addEventListener('click', () => {
            currentFilter = tagEl.dataset.tag;
            renderFilters();
            renderVideos();
        });
    });
}

// Render video grid
function renderVideos() {
    const gridContainer = document.getElementById('video-grid');
    const filteredVideos = currentFilter === 'All'
        ? allVideos
        : allVideos.filter(v => v.tag === currentFilter);

    if (filteredVideos.length === 0) {
        gridContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No videos available.</p>';
        return;
    }

    gridContainer.innerHTML = filteredVideos.map((video, index) => {
        const videoSrc = getVideoSrc(video);
        return `
        <div class="video-tile" data-index="${allVideos.indexOf(video)}">
            <video class="video-thumbnail" muted playsinline loop preload="none">
                <source src="${videoSrc}" type="${getVideoType(videoSrc)}">
            </video>
            <div class="video-tile-overlay">
                ${video.link
                    ? `<a href="${video.link}" class="video-tile-title video-tile-link" target="_blank" rel="noopener">${video.title}</a>`
                    : `<div class="video-tile-title">${video.title}</div>`
                }
                <div class="video-tile-tag">${video.tag}</div>
            </div>
        </div>
        `;
    }).join('');

    // Set up Intersection Observer to autoplay videos when visible
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const videoEl = entry.target;

            if (entry.isIntersecting) {
                // Load and play video when it enters viewport
                if (videoEl.readyState === 0) {
                    // Video not loaded yet, load it first
                    videoEl.load();
                    videoEl.addEventListener('loadeddata', () => {
                        videoEl.play().catch(() => {});
                    }, { once: true });
                } else {
                    // Video already loaded, just play
                    videoEl.play().catch(() => {});
                }
            } else {
                // Pause video when it leaves viewport
                videoEl.pause();
            }
        });
    }, {
        threshold: 0.5 // Play when 50% visible
    });

    // Add click listeners and observe videos
    gridContainer.querySelectorAll('.video-tile').forEach(tile => {
        const titleLink = tile.querySelector('.video-tile-link');
        const videoEl = tile.querySelector('video');
        const videoIndex = parseInt(tile.dataset.index);
        const video = allVideos[videoIndex];

        // Prevent link clicks from opening modal
        if (titleLink) {
            titleLink.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Open modal on click
        tile.addEventListener('click', () => {
            openModal(video);
        });

        // Observe video for autoplay when visible
        if (videoEl) {
            videoObserver.observe(videoEl);
        }
    });
}

// Modal functionality
function initModal() {
    const modal = document.getElementById('video-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const modalVideo = document.getElementById('modal-video');

    // Close modal
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    function closeModal() {
        modal.classList.remove('active');
        modalVideo.pause();
        modalVideo.currentTime = 0;
        // Clear video source to free memory
        const modalSource = modalVideo.querySelector('source');
        modalSource.src = '';
        modalVideo.load();
    }
}

function openModal(video) {
    const modal = document.getElementById('video-modal');
    const modalVideo = document.getElementById('modal-video');
    const modalTitle = document.getElementById('modal-title');
    const modalSource = modalVideo.querySelector('source');

    const videoSrc = getVideoSrc(video);
    modalSource.src = videoSrc;
    modalSource.type = getVideoType(videoSrc);
    modalTitle.textContent = video.title;
    modalVideo.load();
    modal.classList.add('active');
    modalVideo.play().catch(() => {});
}

// Booking form functionality
function initBookingForm() {
    const form = document.getElementById('booking-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            whatsapp: document.getElementById('whatsapp').value,
            business: document.getElementById('business').value,
            location: document.getElementById('location').value,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            notes: document.getElementById('notes').value
        };

        // Format WhatsApp message with proper line breaks
        let message = `Hi JJ, I want to book the 1,000,000 IDR Neo drone shoot.%0A%0A`;
        message += `Name: ${formData.name}%0A`;
        message += `WhatsApp: ${formData.whatsapp}%0A`;
        message += `Business: ${formData.business}%0A`;
        message += `Location: ${formData.location}%0A`;
        message += `Preferred Date: ${formData.date}%0A`;
        message += `Preferred Time: ${formData.time}`;
        if (formData.notes) {
            message += `%0A%0ANotes: ${formData.notes}`;
        }

        // Open WhatsApp
        const whatsappUrl = `https://wa.me/16469340781?text=${message}`;

        window.open(whatsappUrl, '_blank');
    });
}
