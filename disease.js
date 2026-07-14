// ======================================================
// Infectious Disease Simulation — SIRD Model (p5.js)
// ======================================================
//
// Compartments:
//   0  Susceptible   (teal)
//   1  Infected      (vermillion)
//   2  Recovered     (steel blue)
//   3  Deceased       (removed from the field, tallied only)
//
// Reads its parameters from window.params, which script.js
// keeps in sync with the control panel. Call
// window.restartSimulation() to re-seed the population with
// the current parameter values.
// ======================================================

const COLORS = {
  susceptible: [59, 140, 126],
  infected: [194, 68, 68],
  recovered: [60, 110, 158],
  deceased: [91, 95, 99]
};

let people = [];

let susceptibleHistory = [];
let infectedHistory = [];
let recoveredHistory = [];
let deceasedHistory = [];
const HISTORY_LENGTH = 400;

let cumulativeBirths = 0;
let cumulativeDeaths = 0;
let birthAccumulator = 0;

window.simState = window.simState || { paused: false };


// ------------------------------------------------------
// p5 lifecycle
// ------------------------------------------------------

function setup() {
  const container = document.getElementById('canvas-container');
  const cnv = createCanvas(container.clientWidth, container.clientHeight);
  cnv.parent('canvas-container');
  frameRate(60);
  restartSimulation();
}

function windowResized() {
  const container = document.getElementById('canvas-container');
  resizeCanvas(container.clientWidth, container.clientHeight);
}

function draw() {
  background(16, 22, 26);

  if (!window.simState.paused) {
    stepSimulation();
  }

  for (const p of people) {
    p.display();
  }

  drawGraph();
  drawCanvasReadout();
}


// ------------------------------------------------------
// Simulation control
// ------------------------------------------------------

function restartSimulation() {
  const p = window.params;

  people = [];
  susceptibleHistory = [];
  infectedHistory = [];
  recoveredHistory = [];
  deceasedHistory = [];
  cumulativeBirths = 0;
  cumulativeDeaths = 0;
  birthAccumulator = 0;
  frameCount = 0;

  const w = width || 800;
  const h = height || 600;

  for (let i = 0; i < p.startPop; i++) {
    people.push(new Person(random(w), random(h)));
  }

  for (let i = 0; i < p.startInfected && i < people.length; i++) {
    people[i].infect();
  }

  updateTelemetryDOM();
}
window.restartSimulation = restartSimulation;


function stepSimulation() {
  const p = window.params;

  // Movement
  for (const person of people) {
    person.move();
  }

  // Transmission: infected individuals expose nearby susceptibles
  for (let i = 0; i < people.length; i++) {
    const source = people[i];
    if (source.state !== 1) continue;

    for (let j = 0; j < people.length; j++) {
      const target = people[j];
      if (target.state !== 0) continue;

      const d = dist(source.x, source.y, target.x, target.y);
      if (d < p.infectionRadius && random(1) < p.infectionChance) {
        target.infect();
      }
    }
  }

  // Disease progression (recovery or death) and natural births
  for (const person of people) {
    person.updateDisease();
  }

  // Births: expected new susceptibles this frame, scaled by
  // current living population and the birth-rate parameter.
  const alive = people.length;
  birthAccumulator += (alive * p.birthRate) / 1_000_000;
  while (birthAccumulator >= 1) {
    const parent = people[floor(random(people.length))];
    const bx = parent ? parent.x : random(width);
    const by = parent ? parent.y : random(height);
    people.push(new Person(bx, by));
    cumulativeBirths++;
    birthAccumulator -= 1;
  }

  // Remove the deceased from the active field
  people = people.filter(person => {
    if (person.state === 3) {
      cumulativeDeaths++;
      return false;
    }
    return true;
  });

  updateHistory();

  if (frameCount % 6 === 0) {
    updateTelemetryDOM();
  }
}


// ------------------------------------------------------
// Person
// ------------------------------------------------------

class Person {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    const angle = random(TWO_PI);
    const speed = random(0.8, 2);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;

    // 0 susceptible, 1 infected, 2 recovered, 3 deceased
    this.state = 0;
    this.infectedTimer = 0;
    this.willDie = false;
  }

  infect() {
    if (this.state !== 0) return;
    const p = window.params;

    this.state = 1;
    this.infectedTimer = p.recoveryTime;
    this.willDie = random(1) < p.deathRate;
  }

  move() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;

    this.x = constrain(this.x, 0, width);
    this.y = constrain(this.y, 0, height);

    this.vx += random(-0.05, 0.05);
    this.vy += random(-0.05, 0.05);

    const speed = sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 2.2) {
      this.vx *= 2.2 / speed;
      this.vy *= 2.2 / speed;
    }
  }

  updateDisease() {
    if (this.state !== 1) return;

    this.infectedTimer--;
    if (this.infectedTimer <= 0) {
      this.state = this.willDie ? 3 : 2;
    }
  }

  display() {
    noStroke();
    const c = this.state === 0 ? COLORS.susceptible
            : this.state === 1 ? COLORS.infected
            : COLORS.recovered;
    fill(c[0], c[1], c[2]);
    circle(this.x, this.y, 7);
  }
}


// ------------------------------------------------------
// History + graph
// ------------------------------------------------------

function updateHistory() {
  let S = 0, I = 0, R = 0;
  for (const p of people) {
    if (p.state === 0) S++;
    else if (p.state === 1) I++;
    else if (p.state === 2) R++;
  }

  susceptibleHistory.push(S);
  infectedHistory.push(I);
  recoveredHistory.push(R);
  deceasedHistory.push(cumulativeDeaths);

  if (susceptibleHistory.length > HISTORY_LENGTH) {
    susceptibleHistory.shift();
    infectedHistory.shift();
    recoveredHistory.shift();
    deceasedHistory.shift();
  }
}

function drawGraph() {
  const graphW = min(260, width * 0.32);
  const graphH = 150;
  const graphX = width - graphW - 18;
  const graphY = height - graphH - 18;

  const startingPop = window.params.startPop;
  const scaleMax = max(startingPop, 10);

  fill(20, 27, 31, 235);
  stroke(70, 82, 87);
  strokeWeight(1);
  rect(graphX, graphY, graphW, graphH, 2);

  drawSeries(susceptibleHistory, COLORS.susceptible, graphX, graphY, graphW, graphH, scaleMax);
  drawSeries(infectedHistory, COLORS.infected, graphX, graphY, graphW, graphH, scaleMax);
  drawSeries(recoveredHistory, COLORS.recovered, graphX, graphY, graphW, graphH, scaleMax);
  drawSeries(deceasedHistory, COLORS.deceased, graphX, graphY, graphW, graphH, scaleMax);

  noStroke();
  fill(200, 210, 208);
  textFont('IBM Plex Mono');
  textSize(10);
  textStyle(BOLD);
  text('EPIDEMIC CURVE', graphX + 10, graphY + 16);
  textStyle(NORMAL);
}

function drawSeries(data, c, gx, gy, gw, gh, scaleMax) {
  stroke(c[0], c[1], c[2]);
  strokeWeight(1.5);
  noFill();

  beginShape();
  for (let i = 0; i < data.length; i++) {
    const x = map(i, 0, HISTORY_LENGTH, gx, gx + gw);
    const y = map(data[i], 0, scaleMax, gy + gh - 6, gy + 22);
    vertex(x, y);
  }
  endShape();
}

function drawCanvasReadout() {
  let S = 0, I = 0, R = 0;
  for (const p of people) {
    if (p.state === 0) S++;
    else if (p.state === 1) I++;
    else if (p.state === 2) R++;
  }

  noStroke();
  fill(220, 226, 224);
  textFont('IBM Plex Mono');
  textSize(12);
  textStyle(BOLD);
  text('LIVE COUNTS', 18, 26);
  textStyle(NORMAL);

  fill(COLORS.susceptible[0], COLORS.susceptible[1], COLORS.susceptible[2]);
  text('Susceptible  ' + S, 18, 46);

  fill(COLORS.infected[0], COLORS.infected[1], COLORS.infected[2]);
  text('Infected     ' + I, 18, 64);

  fill(COLORS.recovered[0], COLORS.recovered[1], COLORS.recovered[2]);
  text('Recovered    ' + R, 18, 82);

  fill(COLORS.deceased[0], COLORS.deceased[1], COLORS.deceased[2]);
  text('Deceased     ' + cumulativeDeaths, 18, 100);
}


// ------------------------------------------------------
// DOM telemetry (masthead strip)
// ------------------------------------------------------

function updateTelemetryDOM() {
  const alive = people.length;
  const popEl = document.getElementById('pop-count');
  const dayEl = document.getElementById('day-count');
  const birthEl = document.getElementById('birth-count');
  const deathEl = document.getElementById('death-count');

  if (popEl) popEl.textContent = alive;
  if (dayEl) dayEl.textContent = floor(frameCount / 60);
  if (birthEl) birthEl.textContent = cumulativeBirths;
  if (deathEl) deathEl.textContent = cumulativeDeaths;
}