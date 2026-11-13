"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Avatar,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenu,
    NavbarMenuItem,
    NavbarMenuToggle,
    addToast
} from "@heroui/react";
import { signOut } from "firebase/auth";
import WEMLogo from "@/components/common/WEMLogo";
import { useAuth } from "@/features/auth/AuthContext";
import { auth } from "@/features/firebase/config";

const navigationItems = [
    { href: "/", label: "Faktury", isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/invoice-editor") },
    { href: "/archive", label: "Archiv", isActive: (pathname: string) => pathname.startsWith("/archive") }
];

export default function AppNavbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        setIsMenuOpen(false);
        try {
            await signOut(auth);
            router.push("/auth");
        } catch (error) {
            console.error("Logout error:", error);
            addToast({ title: "Odhlášení se nezdařilo", description: "Zkuste to znovu.", color: "danger" });
        }
    };

    return (
        <Navbar
            isBlurred={false}
            isBordered
            maxWidth="2xl"
            isMenuOpen={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
            className="bg-white print:hidden"
            classNames={{ wrapper: "px-4 sm:px-6 lg:px-8" }}
        >
            <NavbarBrand className="grow-0 basis-auto">
                <Link href="/" aria-label="WEM – faktury" className="rounded-sm">
                    <WEMLogo width={77} height={24} />
                </Link>
            </NavbarBrand>

            {user && (
                <NavbarContent justify="start" className="ml-4 hidden h-full gap-6 sm:flex">
                    {navigationItems.map(item => {
                        const isActive = item.isActive(pathname);
                        return (
                            <NavbarItem key={item.href} isActive={isActive} className="relative flex h-full items-center">
                                <Link
                                    href={item.href}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`rounded-sm text-sm ${isActive ? "font-medium text-ink" : "text-neutral-600 hover:text-ink"}`}
                                >
                                    {item.label}
                                </Link>
                                {isActive && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
                            </NavbarItem>
                        );
                    })}
                </NavbarContent>
            )}

            {user && (
                <>
                    <NavbarContent justify="end" className="hidden sm:flex">
                        <Dropdown placement="bottom-end" radius="sm">
                            <DropdownTrigger>
                                <Avatar
                                    as="button"
                                    size="sm"
                                    src={user.photoURL || undefined}
                                    name={user.displayName || user.email || "Uživatel"}
                                    aria-label="Uživatelské menu"
                                    className="transition-transform hover:scale-105"
                                />
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Uživatelské menu">
                                <DropdownItem key="profile" isReadOnly className="cursor-default opacity-100">
                                    <p className="text-sm font-medium text-ink">{user.displayName || user.email}</p>
                                    {user.displayName && <p className="text-xs text-neutral-500">{user.email}</p>}
                                </DropdownItem>
                                <DropdownItem key="logout" color="danger" onPress={handleLogout}>
                                    Odhlásit se
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </NavbarContent>

                    <NavbarContent justify="end" className="sm:hidden">
                        <NavbarMenuToggle srOnlyText="Otevřít menu" aria-label={isMenuOpen ? "Zavřít menu" : "Otevřít menu"} />
                    </NavbarContent>

                    <NavbarMenu className="gap-1 bg-white pt-4">
                        <li className="mb-3 border-b border-neutral-200 pb-4">
                            <p className="text-sm font-medium text-ink">{user.displayName || user.email}</p>
                            {user.displayName && <p className="text-sm text-neutral-500">{user.email}</p>}
                        </li>
                        {navigationItems.map(item => {
                            const isActive = item.isActive(pathname);
                            return (
                                <NavbarMenuItem key={item.href} isActive={isActive}>
                                    <Link
                                        href={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        className={`flex items-center gap-3 rounded-sm py-2 text-base ${isActive ? "font-medium text-ink" : "text-neutral-600"}`}
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <span aria-hidden="true" className={`h-5 w-0.5 rounded-full ${isActive ? "bg-brand" : "bg-transparent"}`} />
                                        {item.label}
                                    </Link>
                                </NavbarMenuItem>
                            );
                        })}
                        <NavbarMenuItem>
                            <button type="button" className="flex items-center gap-3 rounded-sm py-2 text-base text-danger" onClick={handleLogout}>
                                <span aria-hidden="true" className="h-5 w-0.5" />
                                Odhlásit se
                            </button>
                        </NavbarMenuItem>
                    </NavbarMenu>
                </>
            )}
        </Navbar>
    );
}
