import { useState } from 'react';
import { Price, TopBar, useFlash } from '../common/common';
import { useProfile } from '../../stores/profileStore';
import { useUi } from '../../stores/uiStore';
import { goTo, previewCar, sfx } from '../../stores/gameActions';
import { STAT_KEYS, VEHICLES, type StatKey } from '../../data/vehicles';
import { effectiveStats, formatStat, MAX_UPGRADE_LEVEL, statValue, UPGRADE_INFO, upgradeCost } from '../../data/upgrades';
import { handlePurchase } from '../Garage/Garage';
import { useKeys } from '../../hooks/hooks';

export function UpgradeShop() {
  const profile = useProfile((s) => s.profile);
  const upgrade = useProfile((s) => s.upgrade);
  const carId = useUi((s) => s.garageCar) ?? profile.selectedCar;
  const idx = Math.max(0, VEHICLES.findIndex((v) => v.id === carId));
  const v = VEHICLES[idx];
  const owned = profile.ownedCars.includes(v.id);
  const levels = profile.upgrades[v.id];
  const stats = effectiveStats(v, levels);
  const [msg, flash] = useFlash();
  const [justUpgraded, setJustUpgraded] = useState<StatKey | null>(null);

  const go = (d: number) => {
    sfx.click();
    previewCar(VEHICLES[(idx + d + VEHICLES.length) % VEHICLES.length].id);
  };
  useKeys(['Escape'], () => goTo('garage'));

  return (
    <div className="layer">
      <TopBar back="garage" title="UPGRADES" />
      <div className="screen">
        <div className="upgrades screen-enter">
          <div className="panel upgrade-list scroll">
            <div className="car-nav">
              <button className="icon-btn" aria-label="Previous car" onClick={() => go(-1)}>‹</button>
              <div style={{ flex: 1 }}>
                <div className="car-name">{v.name}</div>
                <div className="muted" style={{ fontSize: 14 }}>{owned ? 'Performance tuning' : 'Not owned — buy it in the garage to tune it'}</div>
              </div>
              <button className="icon-btn" aria-label="Next car" onClick={() => go(1)}>›</button>
            </div>
            {STAT_KEYS.map((k) => {
              const lv = levels[k];
              const maxed = lv >= MAX_UPGRADE_LEVEL;
              const cost = upgradeCost(v, lv);
              const next = effectiveStats(v, { ...levels, [k]: lv + 1 });
              const info = UPGRADE_INFO[k];
              return (
                <div key={k} className="upgrade-card">
                  <div>
                    <h4>{info.label.toUpperCase()}</h4>
                    <p>{info.description}</p>
                    <div className="pips">
                      {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                        <i key={i} className={`${i < lv ? 'on' : ''} ${justUpgraded === k && i === lv - 1 ? 'flash' : ''}`} />
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <div className="upgrade-delta">
                      {formatStat(k, statValue(stats, k))} {info.unit}
                      {!maxed && <> → <b>{formatStat(k, statValue(next, k))}</b></>}
                    </div>
                    <button
                      className="btn small gold primary"
                      disabled={!owned || maxed}
                      onClick={() => {
                        const r = upgrade(v.id, k);
                        handlePurchase(r, flash);
                        if (r.ok) {
                          setJustUpgraded(k);
                          window.setTimeout(() => setJustUpgraded(null), 700);
                        }
                      }}
                    >
                      {maxed ? 'MAX' : <>Lv {lv + 1} · <Price value={cost} /></>}
                    </button>
                  </div>
                </div>
              );
            })}
            {msg && <div className="lock-note">{msg}</div>}
          </div>
          <div className="spacer" />
        </div>
      </div>
    </div>
  );
}
