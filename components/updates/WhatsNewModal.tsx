import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';

const WHATS_NEW_STORAGE_PREFIX = 'sat-mobile:whats-new-seen:';

export const WHATS_NEW = {
  version: __APP_VERSION__,
  title: 'What\'s new in SAT Mobile',
  changes: [
    {
      title: 'Monthly Tithe Excel export',
      description: 'Exports now include a Tithe worksheet with only paid members, their payment month, and their amount.'
    },
    {
      title: 'Month-based reporting',
      description: 'Choose a date range to report on July, August, September, or any previous month. Edits made later stay in the original payment month.'
    },
    {
      title: 'Where to find it',
      description: 'Open Export Excel Report, select your date range, export the file, then open the Tithe tab in Excel.'
    }
  ]
} as const;

const WhatsNewModal: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      const key = `${WHATS_NEW_STORAGE_PREFIX}${WHATS_NEW.version}`;
      if (!window.localStorage.getItem(key)) {
        setIsOpen(true);
      }
    } catch {
      // Show the update summary even when browser storage is unavailable.
      setIsOpen(true);
    }
  }, [enabled]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(`${WHATS_NEW_STORAGE_PREFIX}${WHATS_NEW.version}`, 'true');
    } catch {
      // The modal can still be dismissed for this session.
    }
    setIsOpen(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={dismiss} title={WHATS_NEW.title} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Version {WHATS_NEW.version} has been installed. Here is what changed and where to find it.
        </p>
        <div className="space-y-3">
          {WHATS_NEW.changes.map((change, index) => (
            <div key={change.title} className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{change.title}</h4>
                <p className="mt-1 text-sm text-slate-600">{change.description}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
};

export default WhatsNewModal;
