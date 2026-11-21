// The wanted level: one to five stars earned by crimes seen by the police or reported by witnesses,
// kept while officers can see you, and lost by staying out of sight long enough (stars flash while
// they search).
const CRIMES = {
  shots: { min: 1, add: 0, needWitness: true },
  assault: { min: 1, add: 0, needWitness: true },
  carjack: { min: 1, add: 0, needWitness: true, copOnly: true },
  copcar: { min: 2, add: 0, needWitness: false },
  hitcop: { min: 2, add: 0, needWitness: false },
  shootcop: { min: 2, add: 0, needWitness: false },
  killcivilian: { min: 2, add: 1, needWitness: true },
  killcop: { min: 3, add: 1, needWitness: false },
  ramcop: { min: 1, add: 0, needWitness: false },
};

export class Wanted {
  constructor(game) {
    this.game = game;
    this.level = 0;
    this.unseenT = 0;
    this.searching = false;
    this.lastKnown = { x: 0, z: 0 };
    this.cooldown = 0;
  }

  setLevel(n) {
    const before = this.level;
    this.level = Math.max(0, Math.min(5, n));
    this.unseenT = 0;
    this.searching = false;
    const p = this.game.player.position;
    this.lastKnown = { x: p.x, z: p.z };
    if (this.level > before && this.game.hud) this.game.hud.pulseStars();
    if (this.level === 0 && before > 0 && this.game.onWantedCleared) this.game.onWantedCleared();
  }

  /** A crime at (x,z): raise the level if police saw it or a witness will phone it in. */
  report(crime, x, z) {
    const c = CRIMES[crime];
    if (!c) return;
    const g = this.game;
    const copSees = g.police && g.police.copNear(x, z, 60);
    const witness = g.pedestrians && g.pedestrians.witnessNear(x, z, 30);
    if (c.copOnly && !copSees) return;
    if (c.needWitness && !copSees && !witness) return;
    if (this.cooldown > 0 && c.add) return;
    let n = Math.max(this.level, c.min);
    if (c.add && this.level >= c.min) n = this.level + c.add;
    if (c.add) this.cooldown = 4;
    this.setLevel(n);
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.level === 0) return;
    const g = this.game;
    const p = g.player.position;
    const seen = g.police ? g.police.canSeePlayer() : false;
    if (seen) {
      this.unseenT = 0;
      this.searching = false;
      this.lastKnown = { x: p.x, z: p.z };
    } else {
      this.unseenT += dt;
      this.searching = this.unseenT > 2;
      const outside = Math.hypot(p.x - this.lastKnown.x, p.z - this.lastKnown.z) > this.searchRadius;
      if (this.unseenT > 8 + this.level * 3.5 || outside && this.unseenT > 5 + this.level) this.setLevel(0);
    }
  }

  get searchRadius() { return 48 + this.level * 9; }

  get evadeProgress() {
    return this.level ? Math.min(1, this.unseenT / (8 + this.level * 3.5)) : 0;
  }
}
