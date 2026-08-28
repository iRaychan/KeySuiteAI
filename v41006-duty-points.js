/* KeySuite V4.10.06 — Shared sequential duty-point state for ES flows.
   This mirrors the established CHC convention: D1 is the primary duty,
   optional duties follow contiguously, and the total is limited to six. */
(() => {
  'use strict';
  if (window.KeySuiteDutyPointManager) return;

  const copyPoint = point => ({ ...(point || {}) });

  class DutyPointManager {
    constructor(options = {}) {
      this.max = Math.max(1, Math.min(6, Number(options.max) || 6));
      this.points = [copyPoint(options.primary)];
      (options.points || []).slice(1, this.max).forEach(point => this.points.push(copyPoint(point)));
    }

    get length() { return this.points.length; }

    setPrimary(point) {
      this.points[0] = { ...copyPoint(this.points[0]), ...copyPoint(point) };
      return this.all()[0];
    }

    add(point = {}) {
      if (this.points.length >= this.max) return false;
      this.points.push(copyPoint(point));
      return true;
    }

    update(index, point = {}) {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0 || i >= this.points.length) return false;
      this.points[i] = { ...copyPoint(this.points[i]), ...copyPoint(point) };
      return true;
    }

    remove(index) {
      const i = Number(index);
      if (!Number.isInteger(i) || i <= 0 || i >= this.points.length) return false;
      this.points.splice(i, 1);
      return true;
    }

    all() {
      return this.points.map((point, index) => ({ ...copyPoint(point), label: `D${index + 1}` }));
    }
  }

  window.KeySuiteDutyPointManager = DutyPointManager;
})();
