import React from 'react';
import RiskWizard from './components/RiskWizard';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  return (
    <div>
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0a0a0a]/70 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="text-sm sm:text-base font-semibold">Risk Wizard</div>
          <ThemeToggle />
        </div>
      </header>
      <main>
        <RiskWizard />
      </main>
    </div>
  );
}
