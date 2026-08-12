import { s2 } from '../theme/tokens';
import { TabId } from '../types';

// Single words only. Six tabs on a 375px screen leave ~52px of text width per
// button; "DIET PLAN" needs 51.5px at 9px type, which caps the whole bar at a
// barely-legible size. As one word the widest label (RECIPES) needs 49.8px at
// 11px, so every tab gets readable type instead of one long label holding the
// rest hostage.
const TABS: { id: TabId; label: string }[] = [
  { id: 'meals',    label: 'PLAN'    },
  { id: 'tracker',  label: 'TRACK'   },
  { id: 'recipes',  label: 'RECIPES' },
  { id: 'shopping', label: 'SHOP'    },
  { id: 'tips',     label: 'LEARN'   },
  { id: 'profile',  label: 'PROFILE' },
];

// Bar height, measured rather than eyeballed: the old bar came out at 46.8px
// (6px padding + a 34.8px button whose height fell out of padding + line-box).
// 58 + 6 + 6 = 70px ≈ 1.5×. Setting the button height explicitly keeps that
// ratio fixed instead of drifting with the font size.
const BUTTON_HEIGHT = 58;

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/** Fresh Light floating pill nav — dark bar, lime active pill. (ref: V3Nav) */
export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
        width: 'calc(100% - 20px)',
        maxWidth: 460,
        background: s2.ink,
        borderRadius: s2.rPill,
        padding: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 18px 40px rgba(15,20,15,0.28)',
        zIndex: 30,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              cursor: 'pointer',
              // Not rPill: the button is now taller than it is wide, so a fully
              // round radius turns the active tab into a circle rather than the
              // stadium pill the design intends.
              borderRadius: s2.rLg,
              height: BUTTON_HEIGHT,
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? s2.accentFill : 'transparent',
              color: isActive ? s2.ink : s2.onDarkDim,
              fontFamily: s2.sans,
              // 10.5, not 11: at 360px — a very common Android width — a button
              // has ~49px of text room, and RECIPES/PROFILE need 49.8/49.2 at
              // 11px, so they would ellipsise. 10.5 clears it on both 360 and
              // 375 while still being ~24% larger than the old 8.5.
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'background 200ms ease-out, color 200ms ease-out',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
