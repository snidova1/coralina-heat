// Saving: the story position, cash, weapons, health, the time of day and where you stand, kept in
// localStorage (with a quiet fallback when storage is blocked), plus the player's settings.
const SAVE_KEY = 'coralina-heat-save-v1';
const SETTINGS_KEY = 'coralina-heat-settings-v1';

export const DEFAULT_SETTINGS = { master: 0.8, music: 0.5, sensitivity: 1, shadows: true, drawDistance: 1, invertY: false };

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export class SaveSystem {
  constructor(game) {
    this.game = game;
  }

  hasSave() {
    const s = storage();
    try { return !!(s && s.getItem(SAVE_KEY)); } catch { return false; }
  }

  save() {
    const g = this.game;
    const p = g.player;
    const data = {
      version: 1,
      savedAt: Date.now(),
      mission: g.missions.index,
      stats: g.stats,
      health: p.health,
      armor: p.armor,
      weapons: p.weapons,
      current: p.current,
      position: { x: p.position.x, z: p.position.z },
      hour: g.day.hour,
      sideJobs: g.sideJobs?.pack(),
    };
    const s = storage();
    try {
      if (!s) throw new Error('Storage unavailable');
      s.setItem(SAVE_KEY, JSON.stringify(data, (k, v) => (v === Infinity ? 'Infinity' : v)));
      if (g.hud) g.hud.toast('Game saved.');
      return true;
    } catch {
      if (g.hud) g.hud.toast('Could not save: storage is blocked.');
      return false;
    }
  }

  autosave() {
    this.save();
  }

  load() {
    const s = storage();
    let data = null;
    try { data = s && JSON.parse(s.getItem(SAVE_KEY), (k, v) => (v === 'Infinity' ? Infinity : v)); } catch { data = null; }
    if (!data) return false;
    const g = this.game;
    const p = g.player;
    g.missions.index = data.mission || 0;
    Object.assign(g.stats, data.stats || {});
    p.health = data.health ?? 100;
    p.armor = data.armor ?? 0;
    if (data.weapons) p.weapons = data.weapons;
    p.current = data.current && p.weapons[data.current] ? data.current : 'fists';
    if (data.position) p.position.set(data.position.x, 0.16, data.position.z);
    if (Number.isFinite(data.hour)) g.day.setHour(data.hour);
    g.sideJobs?.restore(data.sideJobs);
    return true;
  }

  loadSettings() {
    const s = storage();
    try {
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse((s && s.getItem(SETTINGS_KEY)) || '{}'));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings) {
    const s = storage();
    try { if (s) s.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  }
}
