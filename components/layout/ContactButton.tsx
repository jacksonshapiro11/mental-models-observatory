'use client';

import { useState } from 'react';
import { X, Mail, Twitter } from 'lucide-react';

export default function ContactButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Contact Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 bg-foundational-500 dark:bg-black text-white rounded-lg hover:bg-foundational-600 dark:hover:bg-gray-900 transition-colors font-medium shadow-md dark:shadow-lg"
      >
        <Mail className="w-4 h-4" />
        <span className="hidden sm:block">Contact</span>
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
            className="rounded-lg shadow-2xl border-2 max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'rgb(26, 20, 16)',
              borderColor: '#D4AF37'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-[#D4AF37] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <h2 className="text-2xl font-bold text-white mb-6">
              Get in Touch
            </h2>

            {/* Contact Info */}
            <div className="space-y-4">
              {/* Twitter */}
              <a
                href="https://twitter.com/Cosmic_t_rex"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg transition-colors group border"
                style={{
                  backgroundColor: 'rgb(15, 12, 10)',
                  borderColor: 'rgba(212, 175, 55, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(42, 31, 20)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(15, 12, 10)';
                }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white">
                  <Twitter className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">
                    Twitter
                  </p>
                  <p className="font-medium text-white group-hover:text-[#D4AF37] transition-colors">
                    @Cosmic_t_rex
                  </p>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:cosmictrex11@gmail.com"
                className="flex items-center gap-3 p-4 rounded-lg transition-colors group border"
                style={{
                  backgroundColor: 'rgb(15, 12, 10)',
                  borderColor: 'rgba(212, 175, 55, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(42, 31, 20)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(15, 12, 10)';
                }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-neutral-400">
                    Email
                  </p>
                  <p className="font-medium text-white group-hover:text-[#D4AF37] transition-colors">
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

