'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function PrintModal({ isOpen, onClose, title, children }: Props) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 print:hidden">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>Ҳужжатни кўриш ва чоп этиш:</span>
            <span className="text-blue-600 font-semibold">{title}</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Printer className="h-4 w-4" />
              <span>Чоп этиш (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-8 text-slate-900 bg-white font-sans print:p-0 print:m-0 print:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
}
