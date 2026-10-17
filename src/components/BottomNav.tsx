/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home, MessageSquare, PhoneCall, CheckSquare, ScanLine, Settings } from 'lucide-react';
import { ActiveTab } from '../types/assistant';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    { id: 'home' as ActiveTab, label: 'Home', icon: Home },
    { id: 'chat' as ActiveTab, label: 'Angel Chat', icon: MessageSquare },
    { id: 'phone' as ActiveTab, label: 'Phone Tools', icon: PhoneCall },
    { id: 'tasks' as ActiveTab, label: 'Tasks', icon: CheckSquare },
    { id: 'screen' as ActiveTab, label: 'Screen', icon: ScanLine },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      aria-label="App Navigation"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={`${tab.label} tab`}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 relative ${
              isActive
                ? 'text-violet-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200 active:scale-95'
            }`}
          >
            {isActive && (
              <span className="absolute -top-1 w-5 h-1 bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
            )}
            <div
              className={`p-1.5 rounded-xl transition-all ${
                isActive ? 'bg-violet-500/15 text-violet-300' : 'bg-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
