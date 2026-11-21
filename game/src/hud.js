// The heads-up display: cash, wanted stars, weapon and ammo, health and armour under the radar,
// the mission objective, dialogue subtitles, toasts, big JOB DONE / FLATLINED banners, district
// and vehicle names, the speedometer and radio, the crosshair and damage flashes.
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5L7 14.3 1.7 9.3l7.2-.9z"/></svg>';
export const ICONS = {
  fists: '<svg viewBox="0 0 64 32"><path d="M14 8h26a6 6 0 016 6v6a6 6 0 01-6 6H18l-6-4V12z" fill="currentColor"/><path d="M22 8v18M30 8v18M38 8v18" stroke="#000" stroke-width="2" opacity=".35"/></svg>',
  pistol: '<svg viewBox="0 0 64 32"><path d="M6 8h48v8H30l-2 4h-6l-3 10h-9l4-14H6z" fill="currentColor"/><rect x="54" y="9" width="5" height="4" fill="currentColor"/></svg>',
  smg: '<svg viewBox="0 0 64 32"><path d="M2 9h54v7H40l-2 3h-5l-1 10h-7l1-10h-6l-3 7h-7l3-10H2z" fill="currentColor"/><rect x="26" y="16" width="5" height="12" fill="currentColor"/></svg>',
};

function fmt(text) {
  return String(text).replace(/~([^~]+)~/g, '<em>$1</em>');
}

export class Hud {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    root.innerHTML = `
      <div class="hud-objective"><div class="obj-title"></div><div class="obj-text"></div><div class="obj-timer"></div></div>
      <div class="hud-toast"></div>
      <div class="hud-topright">
        <div class="hud-weapon"><span class="w-icon"></span><span class="w-ammo"></span></div>
        <div class="hud-cash">$0</div>
        <div class="hud-stars">${STAR.repeat(5)}</div>
      </div>
      <div class="hud-radar"><canvas width="230" height="230"></canvas>
        <div class="hud-bars"><div class="bar health"><i></i></div><div class="bar armor"><i></i></div></div>
      </div>
      <div class="hud-subtitle"></div>
      <div class="hud-banner"><b></b><span></span></div>
      <div class="hud-mission-title"></div>
      <div class="hud-district"></div>
      <div class="hud-vehicle"></div>
      <div class="hud-speedo"><b>0</b><span>KM/H</span><div class="radio"></div></div>
      <div class="hud-crosshair"><i></i><i></i><i></i><i></i></div>
      <div class="hud-hit"></div>
      <div class="hud-damage"></div>
      <div class="hud-hint"></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      objTitle: q('.obj-title'), objText: q('.obj-text'), objTimer: q('.obj-timer'), objective: q('.hud-objective'),
      toast: q('.hud-toast'), weaponIcon: q('.w-icon'), ammo: q('.w-ammo'), cash: q('.hud-cash'), stars: q('.hud-stars'),
      radar: q('.hud-radar canvas'), health: q('.bar.health i'), armor: q('.bar.armor i'), subtitle: q('.hud-subtitle'),
      banner: q('.hud-banner'), bannerTitle: q('.hud-banner b'), bannerSub: q('.hud-banner span'), missionTitle: q('.hud-mission-title'),
      district: q('.hud-district'), vehicle: q('.hud-vehicle'), speedo: q('.hud-speedo'), speed: q('.hud-speedo b'), radio: q('.hud-speedo .radio'),
      crosshair: q('.hud-crosshair'), hit: q('.hud-hit'), damage: q('.hud-damage'), hint: q('.hud-hint'),
    };
    this.timers = { toast: 0, subtitle: 0, banner: 0, district: 0, vehicle: 0, missionTitle: 0, hit: 0, damage: 0, hint: 0 };
    this.last = {};
    this.displayCash = 0;
    this.lastDistrict = '';
  }

  get radarCanvas() { return this.el.radar; }

  show(on) { this.root.style.display = on ? 'block' : 'none'; }

  setObjective(title, text) {
    if (this.last.objTitle !== title) { this.el.objTitle.textContent = title || ''; this.last.objTitle = title; }
    const html = fmt(text || '');
    if (this.last.objText !== html) { this.el.objText.innerHTML = html; this.last.objText = html; }
    this.el.objective.style.display = text ? 'block' : 'none';
  }

  subtitle(name, color, text, seconds = 3.5) {
    this.el.subtitle.innerHTML = `<b style="color:${color}">${name}:</b> ${fmt(text)}`;
    this.el.subtitle.classList.add('on');
    this.timers.subtitle = seconds;
  }

  toast(text, seconds = 3) {
    this.el.toast.innerHTML = fmt(text);
    this.el.toast.classList.add('on');
    this.timers.toast = seconds;
  }

  hint(text, seconds = 6) {
    this.el.hint.innerHTML = fmt(text);
    this.el.hint.classList.add('on');
    this.timers.hint = seconds;
  }

  banner(title, sub, color, seconds = 4) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerTitle.style.color = color;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.classList.add('on');
    this.timers.banner = seconds;
  }

  missionTitle(text) {
    this.el.missionTitle.textContent = text;
    this.el.missionTitle.classList.add('on');
    this.timers.missionTitle = 3.5;
  }

  showVehicleName(name) {
    this.el.vehicle.textContent = name;
    this.el.vehicle.classList.add('on');
    this.timers.vehicle = 3;
  }

  showDistrict(name) {
    this.el.district.textContent = name;
    this.el.district.classList.add('on');
    this.timers.district = 4;
  }

  pulseStars() {
    this.el.stars.classList.remove('pulse');
    void this.el.stars.offsetWidth;
    this.el.stars.classList.add('pulse');
  }

  hitMarker(head) {
    this.el.hit.className = 'hud-hit on' + (head ? ' head' : '');
    this.timers.hit = 0.15;
  }

  flashDamage() {
    this.timers.damage = 0.5;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    for (const k of Object.keys(this.timers)) {
      if (this.timers[k] > 0) {
        this.timers[k] -= dt;
        if (this.timers[k] <= 0) {
          const map = { toast: 'toast', subtitle: 'subtitle', banner: 'banner', district: 'district', vehicle: 'vehicle', missionTitle: 'missionTitle', hit: 'hit', hint: 'hint' };
          if (map[k]) this.el[map[k]].classList.remove('on');
        }
      }
    }
    this.el.damage.style.opacity = Math.max(0, this.timers.damage * 1.6) + (p.health < 25 ? 0.35 + Math.sin(g.time * 6) * 0.15 : 0);
    // cash rolls up like an odometer
    const cash = g.stats.cash;
    this.displayCash += (cash - this.displayCash) * Math.min(1, dt * 6);
    if (Math.abs(cash - this.displayCash) < 1 || g.mode === 'shot') this.displayCash = cash;
    const cashText = '$' + Math.round(this.displayCash).toLocaleString('en-US');
    if (this.last.cash !== cashText) { this.el.cash.textContent = cashText; this.last.cash = cashText; }
    // stars
    const level = g.wanted.level;
    const flashing = g.wanted.searching && Math.floor(g.time * 3) % 2 === 0;
    const starKey = level + ':' + flashing;
    if (this.last.stars !== starKey) {
      [...this.el.stars.children].forEach((s, i) => s.classList.toggle('lit', i < level && !flashing));
      [...this.el.stars.children].forEach((s, i) => s.classList.toggle('dim', i < level && flashing));
      this.el.stars.classList.toggle('active', level > 0);
      this.last.stars = starKey;
    }
    // weapon
    const wid = p.current;
    this.el.weaponIcon.hidden = Boolean(p.vehicle);
    if (this.last.weapon !== wid) { this.el.weaponIcon.innerHTML = ICONS[wid]; this.last.weapon = wid; }
    const s = p.ammoState;
    const ammoText = p.weapon.melee ? '' : p.reloadT > 0 ? 'RELOAD' : `${s.clip}<small>/${s.ammo}</small>`;
    if (this.last.ammo !== ammoText) { this.el.ammo.innerHTML = ammoText; this.last.ammo = ammoText; }
    this.el.health.style.width = Math.max(0, p.health) + '%';
    this.el.armor.style.width = Math.max(0, p.armor) + '%';
    // mission timer
    const timer = g.missions && g.missions.timer > 0 ? g.missions.timer : 0;
    const tt = timer > 0 ? `${Math.floor(timer / 60)}:${String(Math.floor(timer % 60)).padStart(2, '0')}` : '';
    if (this.last.timer !== tt) { this.el.objTimer.textContent = tt; this.last.timer = tt; }
    // in a car: speed and radio
    const v = p.vehicle;
    this.el.speedo.style.display = v ? 'block' : 'none';
    if (v) {
      const kmh = String(Math.round(Math.abs(v.speed) * 3.6));
      if (this.last.speed !== kmh) { this.el.speed.textContent = kmh; this.last.speed = kmh; }
      const station = g.audio ? g.audio.stationName : '';
      if (this.last.radio !== station) { this.el.radio.textContent = station; this.last.radio = station; }
    }
    const aimingGun = !v && p.aiming && p.current !== 'fists';
    this.el.crosshair.classList.toggle('on', aimingGun || (!v && g.mode === 'shot' && p.aiming));
  }
}
