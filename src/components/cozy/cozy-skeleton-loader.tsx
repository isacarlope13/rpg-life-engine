"use client";

import React from "react";

export function CozySkeletonLoader() {
  return (
    <div className="min-h-screen bg-[#F7F4EB] text-[#3A2E2B] font-sans antialiased p-4 sm:p-6 lg:p-8 animate-pulse">
      <div className="mx-auto max-w-[1550px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* SKELETON SIDEBAR */}
          <aside className="lg:col-span-3 xl:col-span-3 space-y-6">
            <div className="h-44 rounded-3xl border-4 border-[#5C4033]/30 bg-[#E8DFCF]/50 p-5 shadow-sm" />
            <div className="h-72 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-3 shadow-sm space-y-3">
              <div className="h-8 bg-[#EBE5D8] rounded-xl" />
              <div className="h-10 bg-[#EBE5D8] rounded-2xl" />
              <div className="h-10 bg-[#EBE5D8] rounded-2xl" />
              <div className="h-10 bg-[#EBE5D8] rounded-2xl" />
              <div className="h-10 bg-[#EBE5D8] rounded-2xl" />
            </div>
            <div className="h-24 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-4 shadow-sm" />
          </aside>

          {/* SKELETON MAIN CONTENT */}
          <main className="lg:col-span-9 xl:col-span-9 space-y-6">
            <div className="h-20 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-5 shadow-sm flex items-center justify-between">
              <div className="h-10 w-48 bg-[#EBE5D8] rounded-2xl" />
              <div className="h-10 w-64 bg-[#EBE5D8] rounded-2xl" />
              <div className="h-10 w-36 bg-[#EBE5D8] rounded-2xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 h-80 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-5" />
              <div className="lg:col-span-5 h-80 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-5" />
              <div className="lg:col-span-6 h-72 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-5" />
              <div className="lg:col-span-6 h-72 rounded-3xl border-4 border-[#5C4033]/30 bg-[#FFFDF8]/50 p-5" />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
