import { redirect } from "next/navigation";
import { requireContext } from "@/platform/context";
import { AuthenticationError } from "@/platform/errors";
import { canPerform, ROLE_LABELS } from "@/platform/authz/policy";
import NavLinks from "./nav-links";
import LogoutButton from "./logout-button";
import NotificationBell from "./notification-bell";
import ThemeToggle from "../theme-toggle";
import { countUnread } from "@/modules/dataio/notification-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await requireContext();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <b>Film Acquisition</b>
          <span>Dashboard</span>
        </div>
        <NavLinks
          canManageUsers={canPerform(ctx.role, "user:manage")}
          canGenerateReports={canPerform(ctx.role, "report:generate")}
        />
        <div className="railfoot">
          AI-DLC로 설계된 프로토타입입니다. 실제 인수 업무에 사용하려면 보안·복원력 확장을
          활성화한 재설계가 필요합니다.
        </div>
      </aside>

      <div className="main">
        <div className="top">
          <span className="lbl">현재 역할</span>
          <span className="pill p-acc">{ROLE_LABELS[ctx.role]}</span>
          <div className="topspacer" />
          <ThemeToggle />
          <NotificationBell initialUnread={await countUnread(ctx)} />
          <div className="who">
            <b>{ctx.userName}</b>
            <span>{ROLE_LABELS[ctx.role]}</span>
          </div>
          <LogoutButton />
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
