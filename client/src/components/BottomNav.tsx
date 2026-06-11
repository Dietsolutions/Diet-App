import { s2 } from '../theme/tokens';
import { TabId } from '../types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'meals',    label: 'DIET PLAN' },
  { id: 'tracker',  label: 'TRACK'     },
  { id: 'recipes',  label: 'RECIPES'   },
  { id: 'shopping', label: 'SHOP'      },
  { id: 'recipes',  label: 'RECIPES'   },
  { id: 'tips',     label: 'LEARN'     },
  { id: 'profile',  label: 'PROFILE'   },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        // 28 px base + safe-area on iPhone X+ (home indicator ~34 px)
        paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
        paddingTop: 10,
        background: 'rgba(12,9,7,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${s2.line}`,
        display: 'flex',
        justifyContent: 'space-around',
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
              background: 'transparent',
              border: 'none',
              padding: '6px 8px',
              fontFamily: s2.mono,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: isActive ? s2.accent : s2.textDimmer,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {tab.label}
            {/* Active indicator — 16 px wide 2 px accent line at the very top */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 16,
                height: 2,
                background: s2.accent,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
