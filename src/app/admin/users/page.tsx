import { PageHeader } from "@/components/Shell";
import { ApiButton } from "@/components/ApiButton";
import { listUsers } from "@/server/queries";
import { NewUserForm } from "./NewUserForm";
import { ResetPasswordButton } from "./ResetPasswordButton";

const ROLE = { ADMIN: "管理员", TEACHER: "老师", STUDENT: "学生" } as const;

export default async function UsersPage() {
  const us = await listUsers();
  return (
    <>
      <PageHeader title="账号" desc="平台不开放注册，所有老师和学生账号都在这里创建" />
      <NewUserForm />
      <div className="card mt-5 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>姓名</th>
              <th>账号</th>
              <th>角色</th>
              <th>状态</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {us.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="font-mono text-muted">{u.username}</td>
                <td>{ROLE[u.role]}</td>
                <td>{u.disabled ? <span className="text-amber">已停用</span> : <span className="text-muted">正常</span>}</td>
                <td className="space-x-1 text-right">
                  <ResetPasswordButton id={u.id} name={u.name} />
                  <ApiButton url={`/api/admin/users/${u.id}`} method="PATCH" body={{ disabled: !u.disabled }} className="btn btn-ghost btn-sm">
                    {u.disabled ? "启用" : "停用"}
                  </ApiButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
