/**
 * Object-pool helper for regularly spaced props (streetlights, reflectors, gantries…).
 * Slot i always holds the item with index n where n ≡ i (mod count). When an item falls behind the
 * player it is re-placed `count` spacings further ahead, so placement is O(1) per recycled item.
 */
export class RecyclingRow {
  private indices: number[];

  constructor(
    private count: number,
    private spacing: number,
    private offset: number,
    private behind: number,
    private place: (slot: number, s: number, n: number) => void,
  ) {
    this.indices = new Array(count).fill(-1);
  }

  reset(playerS: number) {
    const first = Math.floor((playerS - this.behind - this.offset) / this.spacing);
    for (let k = 0; k < this.count; k++) {
      const n = first + k;
      const slot = ((n % this.count) + this.count) % this.count;
      this.indices[slot] = n;
      this.place(slot, this.offset + n * this.spacing, n);
    }
  }

  /** Returns true if anything moved. */
  update(playerS: number) {
    let moved = false;
    const limit = playerS - this.behind;
    for (let slot = 0; slot < this.count; slot++) {
      let n = this.indices[slot];
      while (this.offset + n * this.spacing < limit) {
        n += this.count;
        moved = true;
      }
      if (n !== this.indices[slot]) {
        this.indices[slot] = n;
        this.place(slot, this.offset + n * this.spacing, n);
      }
    }
    return moved;
  }
}
