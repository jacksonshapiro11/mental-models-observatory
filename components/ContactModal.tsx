'use client';

import { useState } from 'react';
import { X, Mail, Twitter } from 'lucide-react';

export default function ContactModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Contact Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="bg-black dark:bg-black text-white dark:text-white px-4 py-2 rounded-lg hover:bg-gray-900 dark:hover:bg-gray-900 transition-colors font-semibold shadow-md dark:shadow-lg"
      >
        Contact
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="rounded-lg shadow-2xl border-2 max-w-md w-full p-6 relative bg-blue-50 dark:bg-[rgb(26,20,16)] border-blue-300 dark:border-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-blue-600 dark:text-neutral-400 hover:text-blue-800 dark:hover:text-[#D4AF37] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <h2 className="text-2xl font-bold text-blue-800 dark:text-white mb-6">
              Get in Touch
            </h2>

            {/* Contact Info */}
            <div className="space-y-4">
              {/* Twitter */}
              <a
                href="https://twitter.com/Cosmic_t_rex"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-[rgb(15,12,10)] hover:bg-blue-100 dark:hover:bg-[rgb(42,31,20)] transition-colors group border border-blue-200 dark:border-[rgba(212,175,55,0.3)]"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white">
                  <Twitter className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-neutral-400">
                    Twitter
                  </p>
                  <p className="font-medium text-blue-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-[#D4AF37] transition-colors">
                    @Cosmic_t_rex
                  </p>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:cosmictrex11@gmail.com"
                className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-[rgb(15,12,10)] hover:bg-blue-100 dark:hover:bg-[rgb(42,31,20)] transition-colors group border border-blue-200 dark:border-[rgba(212,175,55,0.3)]"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-neutral-400">
                    Email
                  </p>
                  <p className="font-medium text-blue-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-[#D4AF37] transition-colors">
                    cosmictrex11@gmail.com
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
