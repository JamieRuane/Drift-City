import { useState } from 'react';
import { Price, StatBar, TopBar, useFlash } from '../common/common';
import { useProfile, type PurchaseResult } from '../../stores/profileStore';
import { useUi } from '../../stores/uiStore';
import { goTo, previewCar, sfx, toastAchievement, appearanceFor, getEngine } from '../../stores/gameActions';
import { VEHICLES, STAT_KEYS } from '../../data/vehicles';
import { effectiveStats, formatStat, statRating, statValue, UPGRADE_INFO } from '../../data/upgrades';
import { PAINTS, SMOKES, UNDERGLOWS } from '../../data/cosmetics';
import { useKeys } from '../../hooks/hooks';

type Tab = 'paint' | 'glow' | 'smoke';

export function handlePurchase(r: PurchaseResult, flash: (m: string) => void) {
  if (r.ok) {
    sfx.purchase();
    r.achievements.forEach(toastAchievement);
  } else {
    sfx.denied();
    flash(r.reason);
  }
}

export function Garage() {
  const profile = useProfile((s) => s.profile);
  const { buyCar, selectCar, buyPaint, setPaint, buyGlow, selectGlow, buySmoke, selectSmoke } = useProfile.getState();
  const garageCar = useUi((s) => s.garageCar) ?? profile.selectedCar;
  const idx = Math.max(0, VEHICLES.findIndex((v) => v.id === garageCar));
  const v = VEHICLES[idx];
  const owned = profile.ownedCars.includes(v.id);
  const selected = profile.selectedCar === v.id;
  const stats = effectiveStats(v, profile.upgrades[v.id]);
  const [tab, setTab] = useState<Tab>('paint');
  const [msg, flash] = useFlash();
  const levelLocked = profile.level < v.levelRequired;

  const go = (d: number) => {
    sfx.click();
    previewCar(VEHICLES[(idx + d + VEHICLES.length) % VEHICLES.length].id);
  };
  useKeys(['ArrowLeft', 'KeyA'], () => go(-1));
  useKeys(['ArrowRight', 'KeyD'], () => go(1));
  useKeys(['Escape'], () => goTo('menu'));

  const refresh = () => getEngine()?.setAppearance(appearanceFor(v.id));

  const paintId = profile.carPaint[v.id];
  return (
    <div className="layer">
      <TopBar back="menu" title="GARAGE" />
      <div className="screen">
        <div className="garage screen-enter">
          <div className="panel garage-side">
            <div className="car-nav">
              <button className="icon-btn" aria-label="Previous car" onClick={() => go(-1)}>‹</button>
              <div style={{ flex: 1 }}>
                <div className="car-name">{v.name}</div>
                <div className="car-dots" style={{ marginTop: 6 }}>
                  {VEHICLES.map((c, i) => <i key={c.id} className={i === idx ? 'on' : profile.ownedCars.includes(c.id) ? 'owned' : ''} />)}
                </div>
              </div>
              <button className="icon-btn" aria-label="Next car" onClick={() => go(1)}>›</button>
            </div>
            <div className="car-tag">{v.tagline}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {STAT_KEYS.map((k) => (
                <StatBar key={k} label={UPGRADE_INFO[k].label} rating={statRating(stats, k)} display={formatStat(k, statValue(stats, k))} />
              ))}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Upgrades installed: {Object.values(profile.upgrades[v.id]).reduce((a, b) => a + b, 0)} / 25
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {owned ? (
                <>
                  <button className="btn primary" disabled={selected} onClick={() => { sfx.click(); selectCar(v.id); }}>
                    {selected ? '✓ Selected' : 'Select vehicle'}
                  </button>
                  <button className="btn" onClick={() => { sfx.click(); goTo('upgrades'); }}>Upgrade ›</button>
                </>
              ) : (
                <>
                  {levelLocked && <div className="lock-note">🔒 Unlocks at level {v.levelRequired}</div>}
                  <button className="btn gold primary" disabled={levelLocked} onClick={() => handlePurchase(buyCar(v.id), flash)}>
                    Buy · <Price value={v.price} />
                  </button>
                </>
              )}
              {msg && <div className="lock-note">{msg}</div>}
            </div>
          </div>

          <div className="center">
            <div className="drag-hint">◂ drag to rotate ▸</div>
          </div>

          <div className="panel garage-side">
            <div className="tabs">
              {(['paint', 'glow', 'smoke'] as Tab[]).map((t) => (
                <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { sfx.click(); setTab(t); }}>
                  {t === 'paint' ? 'Paint' : t === 'glow' ? 'Underglow' : 'Tyre smoke'}
                </button>
              ))}
            </div>
            <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
              {tab === 'paint' && (
                <>
                  <div className="swatches">
                    {PAINTS.map((p) => {
                      const have = profile.ownedPaints.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          className={`swatch ${paintId === p.id ? 'sel' : ''}`}
                          style={{ background: p.finish === 'chrome' ? `linear-gradient(135deg, #fff, ${p.color} 40%, #333 60%, ${p.color})` : p.finish === 'pearl' ? `linear-gradient(135deg, ${p.color}, #c9b6ff, #9ff4ff)` : p.color }}
                          title={`${p.name}${have ? '' : ` — ${p.price} coins`}`}
                          aria-label={p.name}
                          onClick={() => {
                            if (!have) {
                              const r = buyPaint(p.id);
                              handlePurchase(r, flash);
                              if (!r.ok) return;
                            } else sfx.click();
                            setPaint(v.id, p.id);
                            refresh();
                          }}
                        >
                          {!have && <span className="lock">{profile.level < p.levelRequired ? '🔒' : '🪙'}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <PaintInfo paintId={paintId} />
                </>
              )}
              {tab === 'glow' && (
                <div className="item-list">
                  {UNDERGLOWS.map((g) => {
                    const have = profile.ownedGlows.includes(g.id);
                    return (
                      <div key={g.id} className={`item-row ${profile.selectedGlow === g.id ? 'sel' : ''}`} onClick={() => {
                        if (have) { sfx.click(); selectGlow(g.id); } else handlePurchase(buyGlow(g.id), flash);
                        refresh();
                      }}>
                        <span className="dot" style={{ background: g.color ?? 'transparent', boxShadow: g.color ? `0 0 10px ${g.color}` : 'none', border: g.color ? 'none' : '1px dashed var(--muted)' }} />
                        <span className="name">{g.name}</span>
                        {have ? (profile.selectedGlow === g.id ? <span className="chip ok">On</span> : null) : profile.level < g.levelRequired ? <span className="lock-note">Lv {g.levelRequired}</span> : <Price value={g.price} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {tab === 'smoke' && (
                <div className="item-list">
                  {SMOKES.map((g) => {
                    const have = profile.ownedSmokes.includes(g.id);
                    const bg = g.color === 'rainbow' ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : g.color ?? '#fff';
                    return (
                      <div key={g.id} className={`item-row ${profile.selectedSmoke === g.id ? 'sel' : ''}`} onClick={() => {
                        if (have) { sfx.click(); selectSmoke(g.id); } else handlePurchase(buySmoke(g.id), flash);
                      }}>
                        <span className="dot" style={{ background: bg }} />
                        <span className="name">{g.name}</span>
                        {have ? (profile.selectedSmoke === g.id ? <span className="chip ok">On</span> : null) : profile.level < g.levelRequired ? <span className="lock-note">Lv {g.levelRequired}</span> : <Price value={g.price} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaintInfo({ paintId }: { paintId: string }) {
  const p = PAINTS.find((x) => x.id === paintId);
  if (!p) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      <div className="muted" style={{ fontSize: 14, textTransform: 'capitalize' }}>{p.finish} finish · tap a locked swatch to buy it</div>
    </div>
  );
}
