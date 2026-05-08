const tabs = document.querySelectorAll('button.game-menu-item');
const panels = document.querySelectorAll('.content-panel');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    panels.forEach(p => { p.classList.remove('active'); p.hidden = true; });
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'true');
    document.getElementById(btn.dataset.target).classList.add('active');
    document.getElementById(btn.dataset.target).hidden = false;
  });
});
