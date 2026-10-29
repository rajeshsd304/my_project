import type { IconName } from "@/components/icons";
import type { Role } from "./roles";

export type NavItem = { href: string; label: string; icon: IconName };

export const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: "home" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/batches", label: "Batches", icon: "layers" },
    { href: "/admin/questions", label: "Question Bank", icon: "book" },
    { href: "/admin/exams", label: "Exams", icon: "clipboard" },
    { href: "/admin/results", label: "Results", icon: "chart" },
    { href: "/admin/announcements", label: "Announcements", icon: "megaphone" },
    { href: "/admin/notes", label: "Study Notes", icon: "file" },
    { href: "/admin/settings", label: "Settings", icon: "settings" },
  ],
  TEACHER: [
    { href: "/teacher", label: "Dashboard", icon: "home" },
    { href: "/teacher/questions", label: "My Questions", icon: "book" },
    { href: "/teacher/exams", label: "My Exams", icon: "clipboard" },
    { href: "/teacher/results", label: "Results", icon: "chart" },
    { href: "/teacher/notes", label: "Study Notes", icon: "file" },
  ],
  STUDENT: [
    { href: "/student", label: "Dashboard", icon: "home" },
    { href: "/student/exams", label: "Exams", icon: "clipboard" },
    { href: "/student/results", label: "My Results", icon: "file" },
    { href: "/student/leaderboard", label: "Leaderboard", icon: "trophy" },
    { href: "/student/notes", label: "Study Notes", icon: "book" },
    { href: "/student/announcements", label: "Announcements", icon: "megaphone" },
  ],
};
