import { s2 } from '../theme/tokens';
import { TabId } from '../types';

// Single words only. Six tabs on a 375px screen leave ~52px of text width per
// button; "DIET PLAN" needs 51.5px at 9px type, which caps the whole bar at a
// barely-legible size. As one word the widest label (RECIPES) needs 49.8px at
// 11px, so every tab gets readable type instead of one long label holding the
// rest hostage.
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'meals',    label: 'PLAN',    icon: 'meals'   },
  { id: 'tracker',  label: 'TRACK',   icon: 'tracker' },
  { id: 'recipes',  label: 'RECIPES', icon: 'recipes' },
  { id: 'shopping', label: 'SHOP',    icon: 'shop'    },
  { id: 'tips',     label: 'LEARN',   icon: 'learn'   },
  { id: 'profile',  label: 'PROFILE', icon: 'profile' },
];

// Glyphs from the design reference (V3_ICONS in v3-chrome.jsx), kept as raw
// path data on a 24×24 box. Each entry is one or more subpaths joined by ' M',
// split back apart at render so a single string per icon stays readable.
const ICON_PATHS = {
  meals:   'M3 11h18a9 9 0 0 1-18 0z M8 7c0-2 1-3 2-3',
  tracker: 'M4 19V9 M10 19V5 M16 19v-7 M22 19H2',
  recipes: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  shop:    'M5 8h14l-1.2 12H6.2L5 8z M9 8V6a3 3 0 0 1 6 0v2',
  learn:   'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z M9 8h7',
  profile: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4',
} as const;

type IconName = keyof typeof ICON_PATHS;

function NavIcon({ name, active }: { name: IconName; active: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      // The active glyph carries the extra weight the design gives it, so the
      // selected tab reads as selected even where the lime pill is clipped.
      strokeWidth={active ? 2.1 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name].split(' M').map((d, i) => (
        <path key={i} d={(i ? 'M' : '') + d} />
      ))}
    </svg>
  );
}

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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
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
            <NavIcon name={tab.icon} active={isActive} />
            <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
