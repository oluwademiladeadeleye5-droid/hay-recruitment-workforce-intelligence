import React from 'react';
import { Mail } from 'lucide-react';

interface CreatorCreditLinksProps {
  compact?: boolean;
}

export const CreatorCreditLinks: React.FC<CreatorCreditLinksProps> = ({ compact = false }) => {
  const iconButtonClass =
    'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E2E8F0] dark:border-[#1E3A5F] bg-[#F6F9FC] dark:bg-[#162B45]/70 text-[#425466] dark:text-slate-300 hover:text-[#533AFD] dark:hover:text-[#7C6BFF] hover:border-[#533AFD]/50 transition-colors';

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        compact ? 'justify-between' : 'justify-between'
      }`}
    >
      <p className="text-xs text-[#425466] dark:text-slate-400">
        Designed &amp; Built by{' '}
        <span className="font-semibold text-[#0A2540] dark:text-white">
          Adeleye Oluwademilade Idris
        </span>{' '}
        | Hay Recruitment Capstone (2026)
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://github.com/oluwademiladeadeleye5-droid"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub profile"
          title="GitHub"
          className={iconButtonClass}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        </a>

        <a
          href="https://www.instagram.com/adeleye.eyitayo/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram profile"
          title="Instagram"
          className={iconButtonClass}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>

        <a
          href="mailto:adeleyeheyitayo@gmail.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Send email"
          title="Email"
          className={iconButtonClass}
        >
          <Mail className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
