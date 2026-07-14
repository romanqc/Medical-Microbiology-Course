// ======================================================
// Control panel wiring
// ======================================================
//
// Keeps window.params in sync with the slider inputs and
// calls into models/disease.js to restart or pause the
// simulation. All simulation logic lives in disease.js —
// this file only touches the DOM.
// ======================================================

window.params = {
  startPop: 250,
  startInfected: 1,
  infectionRadius: 12,
  infectionChance: 0.25,
  recoveryTime: 600,
  deathRate: 0.03,
  birthRate: 0
};

const sliderConfig = [
  { id: 'startPop', paramKey: 'startPop', transform: v => v },
  { id: 'startInfected', paramKey: 'startInfected', transform: v => v },
  { id: 'infectionRadius', paramKey: 'infectionRadius', transform: v => v },
  { id: 'infectionChance', paramKey: 'infectionChance', transform: v => v / 100, displayTransform: v => v },
  { id: 'recoveryTime', paramKey: 'recoveryTime', transform: v => v },
  { id: 'deathRate', paramKey: 'deathRate', transform: v => v / 100, displayTransform: v => v },
  { id: 'birthRate', paramKey: 'birthRate', transform: v => v }
];

function readSlidersIntoParams() {
  for (const cfg of sliderConfig) {
    const input = document.getElementById(cfg.id);
    const output = document.getElementById('out-' + cfg.id);
    const raw = Number(input.value);

    window.params[cfg.paramKey] = cfg.transform(raw);
    if (output) {
      output.textContent = cfg.displayTransform ? cfg.displayTransform(raw) : raw;
    }
  }
}

function wireSliderLiveLabels() {
  for (const cfg of sliderConfig) {
    const input = document.getElementById(cfg.id);
    const output = document.getElementById('out-' + cfg.id);
    if (!input || !output) continue;

    input.addEventListener('input', () => {
      const raw = Number(input.value);
      output.textContent = cfg.displayTransform ? cfg.displayTransform(raw) : raw;
    });
  }
}

function wireButtons() {
  const applyBtn = document.getElementById('btn-apply');
  const pauseBtn = document.getElementById('btn-pause');

  applyBtn.addEventListener('click', () => {
    readSlidersIntoParams();
    if (typeof window.restartSimulation === 'function') {
      window.restartSimulation();
    }
  });

  pauseBtn.addEventListener('click', () => {
    window.simState.paused = !window.simState.paused;
    pauseBtn.textContent = window.simState.paused ? 'Resume' : 'Pause';
    pauseBtn.classList.toggle('is-active', window.simState.paused);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.simState = { paused: false };
  readSlidersIntoParams();
  wireSliderLiveLabels();
  wireButtons();
});