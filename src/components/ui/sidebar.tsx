import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/* ================= CONSTANTS ================= */

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"

/* ================= CONTEXT ================= */

type SidebarContextType = {
  open: boolean
  setOpen: (v: boolean) => void
  isMobile: boolean
  playerVisible: boolean
}

const SidebarContext = React.createContext<SidebarContextType | null>(null)

export const useSidebar = () => {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be inside SidebarProvider")
  return ctx
}

/* ================= PROVIDER ================= */

export function SidebarProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(true)
  const [playerVisible, setPlayerVisible] = React.useState(true)

  /* 🔥 AUTO COLLAPSE ON SCROLL (DESKTOP ONLY) */
  React.useEffect(() => {
    if (isMobile) return

    let lastY = window.scrollY

    const onScroll = () => {
      const y = window.scrollY
      if (y > lastY + 20) setOpen(false)
      if (y < lastY - 20) setOpen(true)
      lastY = y
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [isMobile])

  /* 🎧 PLAYER AWARE */
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const player = document.getElementById("player-root")
      setPlayerVisible(!!player)
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile, playerVisible }}>
      <TooltipProvider delayDuration={0}>
        {children}
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

/* ================= SIDEBAR ================= */

export function Sidebar({ children }: { children: React.ReactNode }) {
  const { open, isMobile, playerVisible } = useSidebar()

  const sidebarHeight = playerVisible
    ? "calc(100svh - var(--player-height) - var(--safe-bottom, 0px))"
    : "100svh"

  if (isMobile) {
    return (
      <Sheet open={open}>
        <SheetContent
          side="left"
          className="p-0 bg-sidebar text-sidebar-foreground"
          style={{ height: sidebarHeight }}
        >
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AnimatePresence>
      <motion.aside
        key="sidebar"
        initial={{ x: -240, opacity: 0 }}
        animate={{ x: open ? 0 : -180, opacity: 1 }}
        exit={{ x: -240, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        style={{
          width: open ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON,
          height: sidebarHeight,
        }}
        className="fixed left-0 top-0 z-20 bg-sidebar border-r border-sidebar-border overflow-hidden"
      >
        {children}
      </motion.aside>
    </AnimatePresence>
  )
}

/* ================= CONTENT ================= */

export function SidebarContent({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="
        flex flex-col h-full overflow-y-auto
        pb-[calc(var(--player-height)+var(--safe-bottom,0px))]
      "
    >
      {children}
    </div>
  )
}

/* ================= HEADER / FOOTER ================= */

export function SidebarHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return <div className="p-4 mt-auto">{children}</div>
}

/* ================= MENU ================= */

const sidebarMenuButtonVariants = cva(
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-sidebar-accent",
  {
    variants: {
      active: {
        true: "bg-sidebar-accent font-medium",
        false: "",
      },
    },
  }
)

export function SidebarMenuButton({
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof sidebarMenuButtonVariants>) {
  return (
    <button
      {...props}
      className={cn(sidebarMenuButtonVariants({ active }))}
    >
      {children}
    </button>
  )
}

/* ================= TRIGGER ================= */

export function SidebarTrigger() {
  const { open, setOpen } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpen(!open)}
      className="h-8 w-8"
    >
      <PanelLeft />
    </Button>
  )
}
