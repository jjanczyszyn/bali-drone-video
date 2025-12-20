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
function getVideoSrc(video, isHero = false) {
    if (isMobile) {
        // For hero videos on mobile, use the 8-second looping version if available
        if (isHero && video.mobileSrc) {
            const heroSrc = video.mobileSrc.replace('.mp4', '_hero.mp4');
            return heroSrc;
        }
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

// Rotate hero background videos with seamless transitions
let currentHeroIndex = 0;
let nextHeroIndex = 1;
let heroVideos = [];
function initHeroVideoRotation() {
    const heroVideo = document.getElementById('hero-video');
    const heroSource = heroVideo.querySelector('source');

    // Filter videos for hero (only those with showInHero: true)
    heroVideos = allVideos.filter(v => v.showInHero !== false);

    if (heroVideos.length === 0) {
        console.error('No videos available for hero');
        return;
    }

    // Preload next video
    let nextVideo = null;

    function preloadNextVideo() {
        const nextIndex = (currentHeroIndex + 1) % heroVideos.length;
        nextVideo = document.createElement('video');
        nextVideo.muted = true;
        nextVideo.playsInline = true;
        nextVideo.preload = 'auto';
        const source = document.createElement('source');
        const videoSrc = getVideoSrc(heroVideos[nextIndex], true);
        source.src = videoSrc;
        source.type = getVideoType(videoSrc);
        nextVideo.appendChild(source);
        nextVideo.load();
    }

    function loadHeroVideo(index) {
        console.log('Loading hero video:', heroVideos[index]);
        const videoSrc = getVideoSrc(heroVideos[index], true);
        heroSource.src = videoSrc;
        heroSource.type = getVideoType(videoSrc);
        heroVideo.load();
        heroVideo.loop = isMobile; // Loop hero videos on mobile since they're 8 seconds
        heroVideo.play().catch(err => {
            console.error('Hero video play error:', err);
        });

        // Preload next video while current plays
        preloadNextVideo();
    }

    // Load first video
    loadHeroVideo(currentHeroIndex);

    // When video is about to end, prepare next one
    heroVideo.addEventListener('timeupdate', () => {
        // When 1 second left, ensure next video is ready
        if (heroVideo.duration - heroVideo.currentTime < 1 && heroVideo.duration > 0) {
            if (!nextVideo) {
                preloadNextVideo();
            }
        }
    });

    // When video ends, immediately load next one
    heroVideo.addEventListener('ended', () => {
        currentHeroIndex = (currentHeroIndex + 1) % heroVideos.length;
        loadHeroVideo(currentHeroIndex);
    });

    // Add error handler
    heroVideo.addEventListener('error', (e) => {
        console.error('Hero video error:', e, heroVideo.error);
        // Skip to next video on error
        currentHeroIndex = (currentHeroIndex + 1) % heroVideos.length;
        if (currentHeroIndex < heroVideos.length) {
            loadHeroVideo(currentHeroIndex);
        }
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

        // Set up rotating hero videos
        if (allVideos.length > 0) {
            initHeroVideoRotation();
        }

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

    gridContainer.innerHTML = filteredVideos.map((video, index) => `
        <div class="video-tile" data-index="${allVideos.indexOf(video)}">
            ${video.thumbnail
                ? `<img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" loading="lazy">`
                : `<video muted playsinline loop preload="none">
                     <source src="${getVideoSrc(video)}" type="${getVideoType(getVideoSrc(video))}">
                   </video>`
            }
            <div class="video-tile-overlay">
                ${video.link
                    ? `<a href="${video.link}" class="video-tile-title video-tile-link" target="_blank" rel="noopener">${video.title}</a>`
                    : `<div class="video-tile-title">${video.title}</div>`
                }
                <div class="video-tile-tag">${video.tag}</div>
            </div>
        </div>
    `).join('');

    // Add click listeners
    gridContainer.querySelectorAll('.video-tile').forEach(tile => {
        const titleLink = tile.querySelector('.video-tile-link');

        // Prevent link clicks from opening modal
        if (titleLink) {
            titleLink.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Open modal on click
        tile.addEventListener('click', () => {
            const videoIndex = parseInt(tile.dataset.index);
            openModal(allVideos[videoIndex]);
        });
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
