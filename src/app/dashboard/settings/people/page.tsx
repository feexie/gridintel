import { notFound } from "next/navigation";
import { InviteForm } from "@/components/people/InviteForm";
import { Panel } from "@/components/system/Metric";
import { accountsEnabled, people } from "@/composition/identity";
import { departmentOf, departmentsFor } from "@/constants/departments";
import { change, invite, remove } from "./actions";

/* The people of an organization, for its administrator (Phase 8A, ADR 0020): who may sign in, what
   each may open, and inviting someone. Anyone else, and the public demonstration, are answered
   "not found". */
export default async function PeoplePage() {
  if (!accountsEnabled()) notFound();
  const listed = await people.list().catch(() => null);
  if (listed === null) notFound();
  const { organization, members, me } = listed;
  const departments = departmentsFor(organization.sectors).map(({ id, label }) => ({ id, label }));

  return (
    <div className="space-y-4" data-people>
      <div>
        <h1 className="text-xl font-semibold text-ink">People</h1>
        <p className="text-sm text-ink-4">
          Who may sign in for {organization.name}, and what each may open. Everyone signs in with a password and a code from an authenticator app.
        </p>
      </div>

      <Panel title="Invite someone">
        <InviteForm action={invite} departments={departments} />
      </Panel>

      <Panel title={`Members (${members.length})`}>
        <ul className="divide-y divide-line" data-members>
          {members.map((member) => {
            const department = departmentOf(organization.sectors, member.screens);
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm" data-member={member.email}>
                <span className="min-w-48 flex-1">
                  <span className="font-medium text-ink">{member.email}</span>
                  <span className="block text-caption text-ink-4">
                    {member.role === "admin" ? "Administrator" : "Member"} · {department?.label ?? "A list of screens no department names"}
                    {member.accepted ? "" : " · invited, not yet signed in"}
                    {member.userId === me ? " · you" : ""}
                  </span>
                </span>
                {member.userId === me ? null : (
                  <>
                    <form action={change} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={member.userId} />
                      <select name="department" defaultValue={department?.id ?? departments[0]?.id} aria-label={`What ${member.email} may open`} className="rounded-tile border border-line-strong bg-app px-2 py-1 text-ink">
                        {departments.map((one) => (
                          <option key={one.id} value={one.id}>
                            {one.label}
                          </option>
                        ))}
                      </select>
                      <select name="role" defaultValue={member.role} aria-label={`Role of ${member.email}`} className="rounded-tile border border-line-strong bg-app px-2 py-1 text-ink">
                        <option value="member">Member</option>
                        <option value="admin">Administrator</option>
                      </select>
                      <button type="submit" className="gi-tap text-link hover:underline">
                        Save
                      </button>
                    </form>
                    <form action={remove}>
                      <input type="hidden" name="userId" value={member.userId} />
                      <button type="submit" className="gi-tap text-link hover:underline">
                        Remove
                      </button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
