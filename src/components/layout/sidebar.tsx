"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { modal } from "@reown/appkit/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  Plus,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronLeft,
  Menu,
  X,
  Coins,
  Wallet,
  LogOut,
} from "lucide-react";
import { WalletModal } from "./WalletModal";

const primaryNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Agents", href: "/dashboard/agents", icon: Bot },
  { name: "Verify", href: "/dashboard/verify", icon: ShieldCheck },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const secondaryNavItems = [
  { name: "Create Agent", href: "/dashboard/agents/new", icon: Plus },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [menuActive, setMenuActive] = React.useState(false);
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const isCollapsed = collapsed;
  const isMobileMenuOpen = menuActive;

  const openWallet = () => {
    if (isConnected) {
      setWalletModalOpen(true);
    } else {
      modal?.open({ view: "Connect" });
    }
  };

  const toggleCollapse = () => setCollapsed((c) => !c);
  const toggleMobileMenu = () => {
    setMenuActive((m) => !m);
  };

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Show image when: desktop expanded OR mobile menu open
  const showImage = isMobile ? isMobileMenuOpen : !isCollapsed;

  // Close mobile menu on resize to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 1024) {
        setMenuActive(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <aside
        className={cn(
          "fixed left-4 top-4 z-50 flex flex-col rounded-2xl bg-forest transition-all duration-400 ease-out",
          "border border-forest-light/20 shadow-lg",
          // Desktop: width + height
          "w-[270px] h-[calc(100vh-32px)]",
          "lg:overflow-y-auto",
          isCollapsed && "lg:w-[85px]",
          // Mobile: horizontal bar
          "max-lg:w-[calc(100%-32px)] max-lg:left-4 max-lg:right-4 max-lg:h-14 max-lg:overflow-y-hidden",
          isMobileMenuOpen && "max-lg:!h-auto max-lg:!overflow-y-auto"
        )}
      >
        {/* Header: image + overlay (top 20%), hidden when collapsed */}
        <header
          className={cn(
            "sticky top-0 z-20 flex shrink-0 items-end justify-between overflow-hidden rounded-t-2xl",
            isCollapsed ? "min-h-0 lg:pt-4" : "h-[20%] min-h-[140px]",
            "max-lg:h-14 max-lg:min-h-14",
            isMobileMenuOpen && "max-lg:!h-[20%] max-lg:!min-h-[120px]"
          )}
        >
          {/* Image - hidden when collapsed (desktop) or menu closed (mobile) */}
          {showImage && (
            <Link href="/dashboard" className="absolute inset-0 block">
              <Image
                src="/images/01-Landing_Page_Hero-Option_A-Central_Bot_with_Dashboard.png"
                alt="Agent Haus"
                fill
                className="object-cover object-center"
                sizes="270px"
              />
              {/* White transparent overlay + text */}
              <div className="absolute inset-0 bg-white/20" />
              <div className="absolute inset-0 flex items-end p-4">
                <span className="text-lg font-bold tracking-tight text-forest-light drop-shadow-lg">
                  Agent Haus
                </span>
              </div>
            </Link>
          )}

          {/* Desktop: collapse toggle - always top right, green */}
          <button
            onClick={toggleCollapse}
            className="absolute right-4 top-4 z-10 hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-forest-light transition-all duration-300 hover:text-forest hover:bg-forest-light/20 lg:flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn("h-5 w-5 transition-transform duration-300", isCollapsed && "rotate-180")}
            />
          </button>

          {/* Mobile: menu toggle */}
          <button
            onClick={toggleMobileMenu}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-gypsum text-forest transition-colors hover:bg-gypsum-dark lg:hidden"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col px-4 pb-4 pt-2">
          {/* Primary nav */}
          <ul
            className={cn(
              "flex flex-col gap-1 transition-transform duration-300",
              isCollapsed && "translate-y-2"
            )}
          >
            {primaryNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    onClick={() => setMenuActive(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-300",
                      isActive
                        ? "bg-gypsum text-forest"
                        : "text-forest-faint hover:bg-forest-light/20 hover:text-forest-light"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span
                      className={cn(
                        "transition-opacity duration-300",
                        isCollapsed && "opacity-0 lg:pointer-events-none"
                      )}
                    >
                      {item.name}
                    </span>
                  </Link>
                  {/* Tooltip when collapsed (desktop only) */}
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 hidden -translate-y-1/2 translate-x-6 whitespace-nowrap rounded-lg bg-gypsum px-3 py-1.5 text-sm font-medium text-forest opacity-0 shadow-lg transition-all duration-300 group-hover:translate-x-7 group-hover:opacity-100 lg:block">
                      {item.name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Secondary nav (bottom) */}
          <ul
            className={cn(
              "mt-auto flex flex-col gap-1 pt-4",
              "max-lg:relative max-lg:bottom-0 max-lg:mb-8 max-lg:mt-8"
            )}
          >
            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    onClick={() => setMenuActive(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-300",
                      isActive
                        ? "bg-celo/25 text-celo border border-celo/30"
                        : "bg-celo/10 text-celo hover:bg-celo/20 border border-celo/15"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span
                      className={cn(
                        "transition-opacity duration-300",
                        isCollapsed && "opacity-0 lg:pointer-events-none"
                      )}
                    >
                      {item.name}
                    </span>
                  </Link>
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-50 hidden -translate-y-1/2 translate-x-6 whitespace-nowrap rounded-lg bg-gypsum px-3 py-1.5 text-sm font-medium text-forest opacity-0 shadow-lg transition-all duration-300 group-hover:translate-x-7 group-hover:opacity-100 lg:block">
                      {item.name}
                    </span>
                  )}
                </li>
              );
            })}

            {/* Profile card */}
            <li
              className={cn(
                "mt-2 rounded-xl border border-forest/20 bg-forest/10 p-3",
                isCollapsed && "lg:px-2 lg:py-2"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3",
                  !isCollapsed && "mb-3"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest/20 text-forest-light">
                  <Coins className="h-4 w-4" />
                </div>
                {!isCollapsed && (
                  <span className="text-sm font-medium text-forest-light">Profile</span>
                )}
              </div>
              <div className={cn("flex gap-2", isCollapsed && "lg:flex-col")}>
                <button
                  onClick={() => {
                    openWallet();
                    setMenuActive(false);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#AB9FF2]/30 bg-[#AB9FF2]/10 px-3 py-2 text-sm font-medium text-[#AB9FF2] transition-colors hover:bg-[#AB9FF2]/20 hover:text-[#8B7ED9]",
                    isCollapsed && "lg:justify-center lg:px-2"
                  )}
                  title="Wallet"
                >
                  <Wallet className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>Wallet</span>}
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setMenuActive(false);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border border-forest/20 bg-gypsum/50 px-3 py-2 text-sm font-medium text-forest transition-colors hover:bg-gypsum hover:text-forest",
                    isCollapsed && "lg:justify-center lg:px-2"
                  )}
                  title="Logout"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>Logout</span>}
                </button>
              </div>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Spacer for layout - main content needs left margin */}
      <div
        className={cn(
          "hidden shrink-0 transition-all duration-400 lg:block",
          isCollapsed ? "w-[85px]" : "w-[270px]"
        )}
      />

      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
}
