"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  CreditCard,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  PlugZap,
  Radio,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: {
    icon: Crown,
    labelKey: "roleOwner",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    labelKey: "roleAdmin",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    labelKey: "roleAgent",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    labelKey: "roleViewer",
    className: "border-border bg-card text-muted-foreground",
  },
};

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey?: string;
  label?: string;
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Live Inbox", icon: MessageSquare },
  { href: "/smart-inbox", label: "Smart Inbox", icon: Sparkles },
  { href: "/notifications", labelKey: "notifications", icon: Bell },
  { href: "/contacts", labelKey: "contacts", icon: Users },
  { href: "/crm", label: "CRM 2.0", icon: BriefcaseBusiness },
  { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
  { href: "/automations", labelKey: "automations", icon: Zap },
  { href: "/flows", labelKey: "flows", icon: Workflow, beta: true },
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/commerce", label: "Commerce", icon: ShoppingBag },
];

type BottomNavItem = {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey?: string;
  label?: string;
};

const bottomNavItems: BottomNavItem[] = [
  { href: "/integrations", label: "Channels & integrations", icon: PlugZap },
  { href: "/enterprise", label: "Enterprise", icon: ShieldCheck },
  { href: "/onboarding", label: "Setup", icon: Rocket },
  { href: "/billing", label: "Plan & usage", icon: CreditCard },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();

  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-indigo-400 via-primary to-teal-400 text-primary-foreground shadow-sm shadow-primary/20">
              <span className="text-[11px] font-black tracking-[-0.08em] text-white">S</span>
            </div>
            <div className="min-w-0 leading-none">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-extrabold tracking-[0.08em] text-foreground">SBYT</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">CRM</span>
              </div>
              <span className="mt-1 block truncate text-[9px] font-medium tracking-[0.04em] text-muted-foreground">Customer Intelligence</span>
            </div>
          </Link>
          <button type="button" onClick={onClose} aria-label={t("closeMenu")} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const showUnreadDot = item.href === "/inbox" && totalUnread > 0 && !isActive;
              const showNotificationBadge = item.href === "/notifications" && unreadNotifications > 0;
              const label = item.label ?? (item.labelKey ? t(item.labelKey) : "");

              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground") }>
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{label}</span>
                    {item.beta && <span aria-label={t("beta")} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">{t("beta")}</span>}
                    {showUnreadDot && <span aria-label={t("unreadConversations", { count: totalUnread })} className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>}
                    {showNotificationBadge && <span aria-label={t("unreadNotifications", { count: unreadNotifications })} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-border" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground") }>
                    <item.icon className="h-4 w-4" />
                    {item.label ?? (item.labelKey ? t(item.labelKey) : "")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          {showAccountStrip && account?.name ? (
            <div className="mb-2 flex items-center gap-2 px-3 text-xs text-muted-foreground">
              <UsersRound className="size-3.5 shrink-0" />
              <span className="truncate" title={account.name}>{account.name}</span>
              {accountRole
                ? (() => {
                    const meta = ROLE_CHIP[accountRole];
                    const Icon = meta.icon;
                    return <span className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}><Icon className="size-3" />{t(meta.labelKey as string)}</span>;
                  })()
                : null}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none data-popup-open:bg-muted/60">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? t("defaultAvatar")} /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{profile?.full_name?.charAt(0)?.toUpperCase() ?? profile?.email?.charAt(0)?.toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{profile?.full_name ?? t("defaultUser")}</p><p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p></div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={6} className="min-w-56 bg-popover text-popover-foreground ring-border">
              <DropdownMenuItem render={<Link href="/settings?tab=profile" onClick={onClose} className="text-popover-foreground focus:bg-accent focus:text-accent-foreground" />}><User className="size-4" />{t("menuProfile")}</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=whatsapp" onClick={onClose} className="text-popover-foreground focus:bg-accent focus:text-accent-foreground" />}><Settings className="size-4" />{t("menuSettings")}</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={signOut} className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"><LogOut className="size-4" />{t("menuSignOut")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
