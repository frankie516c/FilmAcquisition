import { requireContext } from "@/platform/context";
import { listUsers } from "@/modules/auth/service";
import { ForbiddenError } from "@/platform/errors";
import { ROLE_LABELS } from "@/platform/authz/policy";
import UserTable from "./user-table";

export default async function UsersPage() {
  const ctx = await requireContext();

  let users;
  try {
    users = await listUsers(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <>
          <div className="phead">
            <h1>사용자 관리</h1>
          </div>
          <div className="locked">
            현재 역할({ROLE_LABELS[ctx.role]})은 <b>user:manage</b> 권한이 없습니다. 이 화면의
            API를 직접 호출하면 <b>403</b>이 반환됩니다.
          </div>
        </>
      );
    }
    throw error;
  }

  const executiveCount = users.filter((u) => u.role === "EXECUTIVE").length;

  return (
    <>
      <div className="phead">
        <h1>사용자 관리</h1>
        <p>
          경영진 {executiveCount}명 · 전체 {users.length}명
        </p>
      </div>

      <UserTable
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
        }))}
        executiveCount={executiveCount}
        currentUserId={ctx.userId}
      />
    </>
  );
}
