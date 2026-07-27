"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const BASE: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/board", label: "파이프라인" },
  { href: "/titles", label: "작품 목록" },
];

export default function NavLinks({
  canManageUsers,
  canGenerateReports,
}: {
  canManageUsers: boolean;
  canGenerateReports: boolean;
}) {
  const pathname = usePathname();

  // 권한이 없는 메뉴는 아예 보여주지 않는다.
  // 실제 차단은 각 화면과 API가 하며, 이것은 편의일 뿐이다.
  const links: NavItem[] = [
    ...BASE,
    ...(canGenerateReports ? [{ href: "/reports", label: "리포트" }] : []),
    ...(canManageUsers ? [{ href: "/users", label: "사용자 관리" }] : []),
  ];

  return (
    <nav className="nav">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname.startsWith(l.href) ? "page" : undefined}
        >
          <i className="dot" />
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
