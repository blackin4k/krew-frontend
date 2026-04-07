import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { JamChat } from '@/components/jam/JamChat';
import { JamControls } from '@/components/jam/JamControls';
import { Settings2, Radio, Music } from 'lucide-react';
import { useJamStore } from '@/stores/jamStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function Jam() {
  const { connectedJam, listeners } = useJamStore();

  return (
    <div className="h-[calc(100dvh-10rem)] md:h-[calc(100vh-6rem)] relative overflow-hidden flex flex-col w-full">

      {/* DESKTOP LAYOUT (Grid) */}
      <div className="hidden md:grid md:grid-cols-12 h-full gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left Panel: Controls */}
        <div className="md:col-span-4 lg:col-span-3 space-y-4">
          <div className="text-2xl font-black tracking-tight mb-6 flex items-center gap-3 text-white">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            Sonic Galaxy
          </div>
          <JamControls />
        </div>

        {/* Right Panel: Chat */}
        <div className="md:col-span-8 lg:col-span-9 h-[600px] border border-white/10 rounded-3xl bg-black/20 backdrop-blur-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
          <JamChat />
        </div>
      </div>

      {/* MOBILE LAYOUT (Full Screen Chat + Drawer) */}
      <div className="md:hidden flex flex-col h-full relative">

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-black/20 backdrop-blur-lg border-b border-white/5 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Music className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-none">Sonic Galaxy</h1>
              <p className="text-[10px] text-white/50 font-mono mt-0.5 tracking-wider uppercase">
                {connectedJam ? 'Live Session' : 'Lobby'}
              </p>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 relative">
                <Settings2 className="w-5 h-5" />
                {/* Notification dot if disconnected */}
                {!connectedJam && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-[2rem] border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl">
              <SheetHeader className="mb-6 text-left">
                <SheetTitle className="text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-primary" /> Session Command
                </SheetTitle>
              </SheetHeader>
              <JamControls />
            </SheetContent>
          </Sheet>
        </div>

        {/* Listeners Ticker (Floating) */}
        {connectedJam && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-[60px] left-0 w-full z-10 px-4 pointer-events-none"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {listeners.length} listening now
            </div>
          </motion.div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 min-h-0 relative z-0">
          {/* Background Decorations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] animate-pulse-slow delay-1000" />
          </div>

          <JamChat />
        </div>

      </div>
    </div>
  );
}
