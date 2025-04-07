// Theme Toggle
document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
});

// Mobile Menu Toggle
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    const nav = document.getElementById('mainNav');
    nav.classList.toggle('active');
});

// Sidebar Toggle
document.getElementById('showUsersBtn').addEventListener('click', () => {
    document.getElementById('activeUsers').classList.add('active');
});
document.getElementById('closeUsers').addEventListener('click', () => {
    document.getElementById('activeUsers').classList.remove('active');
});

// Smooth Scroll for Internal Links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId.startsWith('#')) {
            e.preventDefault();
            document.querySelector(targetId).scrollIntoView({ behavior: 'smooth' });
        }
    });
});