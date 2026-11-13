import { NavLink, Outlet } from 'react-router-dom'
import {
  Building2Icon,
  CalendarDaysIcon,
  LayoutPanelLeftIcon,
  PlusCircleIcon,
} from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { BUSINESS_NAME, ENVIRONMENT } from '@/lib/api'

const nav = [
  { to: '/venues', label: 'Salonlar', icon: Building2Icon, end: false },
  { to: '/sessions', label: 'Seanslar', icon: CalendarDaysIcon, end: true },
  { to: '/sessions/new', label: 'Yeni seans', icon: PlusCircleIcon, end: true },
] as const

export function PanelShell() {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="pointer-events-none">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <LayoutPanelLeftIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Seatview panel</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {BUSINESS_NAME}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>İşletme</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<NavLink to={item.to} end={item.end} />}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Badge variant="outline" className="w-full justify-center">
            Ortam: {ENVIRONMENT}
          </Badge>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-muted-foreground text-sm">Operatör paneli</span>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
