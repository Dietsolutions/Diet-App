import { s2 } from '../theme/tokens';
import { TabId } from '../types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'meals',    label: 'DIET PLAN' },
  { id: 'tracker',  label: 'TRACK'     },
  { id: 'recipes',  label: 'RECIPES'   },
  { id: 'shopping', label: 'SHOP'      },
  { id: 'tips',     label: 'LEARN'     },
  { id: 'profile',  label: 'PROFILE'   },
];

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
              borderRadius: s2.rPill,
              padding: '11px 2px',
              background: isActive ? s2.accentFill : 'transparent',
              color: isActive ? s2.ink : s2.onDarkDim,
              fontFamily: s2.sans,
              fontSize: 8.5,
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
