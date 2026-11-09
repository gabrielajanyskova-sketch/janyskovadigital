// Slider referencí

const track = document.getElementById('refTrack');
const prev  = document.getElementById('refPrev');
const next  = document.getElementById('refNext');

if (track && prev && next) {
  let maxScroll = 0;
  let viewW = 0;

  function measure() {
    viewW     = track.clientWidth;
    maxScroll = track.scrollWidth - viewW - 2;
  }

  function updateBtns() {
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = maxScroll <= 2 || track.scrollLeft >= maxScroll;
  }

  prev.addEventListener('click', function() { track.scrollBy({ left: -viewW, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  next.addEventListener('click', function() { track.scrollBy({ left:  viewW, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  track.addEventListener('scroll', updateBtns, { passive: true });
  window.addEventListener('resize', function() {
    requestAnimationFrame(function() { measure(); updateBtns(); });
  });
  requestAnimationFrame(function() { measure(); updateBtns(); });
}
