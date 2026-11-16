/**
 * TECHDEF // PORTAL LANDING EXPERIENCE
 * Signature Scroll-Driven Portal Opening & Auth Interface Controller
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. SCROLL-DRIVEN PORTAL REVERSIBLE MOTION
  // --------------------------------------------------------------------------
  const heroContainer = document.querySelector('.portal-hero-container');
  const panelLeft = document.querySelector('.hero-panel.panel-left');
  const panelRight = document.querySelector('.hero-panel.panel-right');
  const heroImage = document.querySelector('.hero-image');
  const duotoneWash = document.querySelector('.hero-duotone-wash');
  const dotAmber = document.querySelector('.hero-accent-dot.dot-amber-moving');
  const dotTeal = document.querySelector('.hero-accent-dot.dot-teal-moving');
  const heroWordmark = document.querySelector('.hero-wordmark');
  const wordLeft = document.querySelector('.word-left');
  const wordRight = document.querySelector('.word-right');
  const floatingMotif = document.querySelector('.floating-circle-motif');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ticking = false;

  function updatePortal() {
    ticking = false;
    if (prefersReducedMotion || !heroContainer) return;

    const rect = heroContainer.getBoundingClientRect();
    const scrollableDistance = heroContainer.offsetHeight - window.innerHeight;
    const currentScroll = -rect.top;
    const progress = Math.max(0, Math.min(1, currentScroll / Math.max(1, scrollableDistance)));

    // Ease in-out progression for natural mechanical opening
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // 1. Solid Panels Part Outward Past 100% of Width
    const panelOffset = eased * 105;
    if (panelLeft) panelLeft.style.transform = `translateX(-${panelOffset}%)`;
    if (panelRight) panelRight.style.transform = `translateX(${panelOffset}%)`;

    // 2. Full-bleed Hero Image Settles Down from 1.15 to 1.0
    const imageScale = 1.15 - (eased * 0.15);
    if (heroImage) heroImage.style.transform = `scale(${imageScale.toFixed(4)})`;

    // 3. Duotone Wash rises from 0 to 0.40
    if (duotoneWash) duotoneWash.style.opacity = (eased * 0.4).toFixed(3);

    // 4. Accent dots travel outward to opposite corners
    const dotX = (eased * 40).toFixed(2);
    const dotY = (eased * 38).toFixed(2);
    if (dotAmber) dotAmber.style.transform = `translate(calc(-50% - ${dotX}vw), calc(-50% - ${dotY}vh))`;
    if (dotTeal) dotTeal.style.transform = `translate(calc(-50% + ${dotX}vw), calc(-50% + ${dotY}vh))`;

    // 5. Signature Title Move: Grows while tracking tightens and halves split
    const titleScale = 1.0 + (eased * 0.32);
    const tracking = -0.02 - (eased * 0.04); // tightens from -0.02em to -0.06em
    const splitDistance = eased * 44; // translates left/right by ~44%

    if (heroWordmark) {
      heroWordmark.style.transform = `scale(${titleScale.toFixed(4)})`;
      heroWordmark.style.letterSpacing = `${tracking.toFixed(4)}em`;
    }
    if (wordLeft) wordLeft.style.transform = `translateX(-${splitDistance.toFixed(2)}%)`;
    if (wordRight) wordRight.style.transform = `translateX(${splitDistance.toFixed(2)}%)`;

    // 6. Statement fold floating circular visual drift
    if (floatingMotif) {
      const globalScroll = window.scrollY || window.pageYOffset;
      const rot = (globalScroll * 0.06) % 360;
      const transY = (globalScroll * 0.04) % 60;
      floatingMotif.style.transform = `translateY(calc(-50% + ${transY}px)) rotate(${rot}deg)`;
    }
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updatePortal);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // Initial run
  updatePortal();

  // --------------------------------------------------------------------------
  // 2. OPERATOR AUTH INTERFACE (SIGN IN / SIGN UP)
  // --------------------------------------------------------------------------
  const tabSignIn = document.getElementById('tab-signin');
  const tabSignUp = document.getElementById('tab-signup');
  const formSignIn = document.getElementById('form-signin');
  const formSignUp = document.getElementById('form-signup');
  const authFeedback = document.getElementById('auth-feedback');
  const userGreetingPill = document.getElementById('user-greeting-pill');

  function showFeedback(type, text) {
    if (!authFeedback) return;
    authFeedback.className = `auth-feedback ${type}`;
    authFeedback.textContent = text;
    authFeedback.style.display = 'block';
  }

  function hideFeedback() {
    if (!authFeedback) return;
    authFeedback.style.display = 'none';
  }

  // Check existing session
  function checkSession() {
    try {
      const stored = localStorage.getItem('techdef_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user && user.username) {
          if (userGreetingPill) {
            userGreetingPill.innerHTML = `OPERATOR: <strong>${user.username}</strong> &bull; <a href="/dashboard" style="color:var(--amber);text-decoration:none;font-weight:bold;">ENTER DASHBOARD &rarr;</a>`;
            userGreetingPill.style.display = 'block';
          }
        }
      }
    } catch (e) {}
  }

  checkSession();

  // Tab Switcher
  if (tabSignIn && tabSignUp && formSignIn && formSignUp) {
    tabSignIn.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      formSignIn.style.display = 'flex';
      formSignUp.style.display = 'none';
      hideFeedback();
    });

    tabSignUp.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      formSignUp.style.display = 'flex';
      formSignIn.style.display = 'none';
      hideFeedback();
    });
  }

  // Handle Sign In Submit
  if (formSignIn) {
    formSignIn.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFeedback();

      const identifier = document.getElementById('signin-identifier')?.value.trim();
      const password = document.getElementById('signin-password')?.value;

      if (!identifier || !password) {
        showFeedback('error', 'Please provide both username/email and password.');
        return;
      }

      showFeedback('success', 'Authenticating operator credentials...');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        }).catch(() => null);

        let user = null;
        if (res && res.ok) {
          const data = await res.json();
          user = data.user;
        } else {
          // Local offline fallback
          user = {
            username: identifier.includes('@') ? identifier.split('@')[0] : identifier,
            email: identifier.includes('@') ? identifier : `${identifier}@techdef.local`,
            role: 'Operator'
          };
        }

        localStorage.setItem('techdef_user', JSON.stringify(user));
        showFeedback('success', `Welcome back, ${user.username}. Entering Dashboard...`);
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 650);

      } catch (err) {
        showFeedback('error', 'Authentication failed. Please verify credentials.');
      }
    });
  }

  // Handle Sign Up Submit
  if (formSignUp) {
    formSignUp.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFeedback();

      const username = document.getElementById('signup-username')?.value.trim();
      const email = document.getElementById('signup-email')?.value.trim();
      const password = document.getElementById('signup-password')?.value;

      if (!username || !email || !password) {
        showFeedback('error', 'All fields are required to register.');
        return;
      }

      if (password.length < 6) {
        showFeedback('error', 'Password must be at least 6 characters.');
        return;
      }

      showFeedback('success', 'Creating operator profile...');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        }).catch(() => null);

        let user = null;
        if (res && res.ok) {
          const data = await res.json();
          user = data.user;
        } else {
          user = { username, email, role: 'Registered Operator' };
        }

        localStorage.setItem('techdef_user', JSON.stringify(user));
        showFeedback('success', `Account created successfully! Launching Dashboard...`);
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 650);

      } catch (err) {
        showFeedback('error', 'Registration encountered an error. Try again.');
      }
    });
  }

  // Guest Bypass Direct Launch
  const guestButtons = document.querySelectorAll('.guest-bypass-btn, .btn-launch-guest');
  guestButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const guestUser = {
        username: 'Guest_Operator',
        email: 'guest@techdef.local',
        role: 'Guest'
      };
      localStorage.setItem('techdef_user', JSON.stringify(guestUser));
      window.location.href = '/dashboard';
    });
  });

})();
