/**
 * EXPERT PAGE TRANSITION SYSTEM
 * ─────────────────────────────
 * Uses the View Transitions API (Chrome 111+) for GPU-accelerated,
 * native-quality animations. Falls back to a polished CSS animation for
 * all other browsers.
 *
 * Three layers of delight:
 *  1. A circular clip-path REVEAL that explodes from the click origin
 *  2. A directional slide so the user always knows where they "are" in the flow
 *  3. Staggered content entrance — each semantic section enters on its own beat
 */

// ─── STAGGER ON PAGE LOAD ────────────────────────────────────────────────────
// Every time a page loads, its content enters with a precise waterfall cascade.
function initStagger() {
    // Targets: header, main's direct children (sections, articles, divs)
    const targets = [
        ...document.querySelectorAll('header'),
        ...document.querySelectorAll('main > *'),
        ...document.querySelectorAll('footer'),
    ];

    targets.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(22px)';
        el.style.transition = 'none';

        requestAnimationFrame(() => {
            setTimeout(() => {
                el.style.transition = `opacity 1.0s cubic-bezier(0.16, 1, 0.3, 1), transform 1.0s cubic-bezier(0.16, 1, 0.3, 1)`;
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, i * 125); // 125ms delay for a balanced, clear wave effect
        });
    });
}

// ─── CLICK ORIGIN TRACKING ───────────────────────────────────────────────────
// We track WHERE the user clicked so we can explode the reveal FROM that point.
let clickOriginX = window.innerWidth / 2;
let clickOriginY = window.innerHeight / 2;

document.addEventListener('click', (e) => {
    clickOriginX = e.clientX;
    clickOriginY = e.clientY;
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clickOriginX = window.innerWidth / 2;
        clickOriginY = window.innerHeight / 2;
    }
});

// ─── SET CSS CLICK ORIGIN CUSTOM PROPERTIES ──────────────────────────────────
function setOriginVars() {
    document.documentElement.style.setProperty('--origin-x', `${clickOriginX}px`);
    document.documentElement.style.setProperty('--origin-y', `${clickOriginY}px`);

    // Calculate the max radius needed to cover the entire viewport from the origin
    const maxRadius = Math.hypot(
        Math.max(clickOriginX, window.innerWidth - clickOriginX),
        Math.max(clickOriginY, window.innerHeight - clickOriginY)
    );
    document.documentElement.style.setProperty('--max-radius', `${maxRadius}px`);
}

// ─── MAIN NAVIGATION FUNCTION ─────────────────────────────────────────────────
window.transitionTo = function (url) {
    setOriginVars();

    if (!document.startViewTransition) {
        // ── FALLBACK: polished CSS exit for older browsers ──
        document.body.style.transition = 'opacity 0.7s cubic-bezier(0.4, 0, 1, 1), transform 0.7s cubic-bezier(0.4, 0, 1, 1)';
        document.body.style.opacity = '0';
        document.body.style.transform = 'scale(0.97) translateY(-8px)';
        setTimeout(() => { window.location.href = url; }, 700);
        return;
    }

    // ── PRIMARY PATH: Native View Transitions API ──
    document.startViewTransition(() => {
        window.location.href = url;
    });
};

// ─── BLOB CURRENT ANIMATIONS ─────────────────────────────────────────────────
// Automatically finds the fixed background container and applies
// water-current drift animations to each blob/ring shape.
function initBlobAnimations() {
    const bg = document.querySelector('.fixed.inset-0.overflow-hidden.pointer-events-none');
    if (!bg) return;

    const animClasses = [
        'blob-anim-main',   // index 0: large teal blob
        'blob-anim-amber',  // index 1: amber blob
        'blob-anim-ring-a', // index 2: top-mid large ring
        'blob-anim-ring-b', // index 3: top-mid small ring
        'blob-anim-ring-c', // index 4: bottom-left ring
        'blob-anim-ring-d', // index 5: bottom-right ring
    ];

    Array.from(bg.children).forEach((el, i) => {
        if (i < animClasses.length) {
            el.classList.add(animClasses[i]);
        }
    });
}

// ─── INTERCEPT ALL INTERNAL LINKS ────────────────────────────────────────────
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('http') || href.startsWith('//') || link.target) return;

    e.preventDefault();
    transitionTo(href);
}, true); // use capture to intercept before any inline onclick

// ─── RUN ON LOAD ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initStagger();
    initBlobAnimations(); // 🌊 water current effect on all blob shapes
});
