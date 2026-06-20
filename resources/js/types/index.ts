import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
    roles: string[];
    permissions: string[];
}

export interface FileEntry {
    name: string;
    path: string;
    type: 'dir' | 'file';
    size: number | null;
    modified: number; // unix timestamp (seconds)
    extension: string | null;
}

export interface Breadcrumb {
    name: string;
    path: string;
}

export interface FileListing {
    path: string;
    breadcrumbs: Breadcrumb[];
    entries: FileEntry[];
}

export interface FilePermissions {
    upload: boolean;
    delete: boolean;
    createFolders: boolean;
    share: boolean;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    flash: { success: string | null; error: string | null };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
