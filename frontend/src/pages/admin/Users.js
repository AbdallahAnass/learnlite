// admin/Users.js — User management page for administrators.

import { useEffect, useState } from "react";
import { Trash2, Users } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import {
  listStudents,
  listInstructors,
  deleteStudent,
  deleteInstructor,
} from "@/api/admin";

// Modal confirmation dialog shown before a destructive delete action.
// Renders over a semi-transparent backdrop so the user cannot accidentally miss it.
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-border p-6 w-full max-w-sm mx-4">
        <p className="text-sm text-foreground mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable table component for both students and instructors.
// users=null → skeleton loading; users=[] → empty state; otherwise renders rows.
// onDelete: async (userId) => void — parent handles the actual API call.
function UserTable({ users, onDelete }) {
  // confirm: the user object awaiting deletion confirmation (null = dialog closed)
  const [confirm, setConfirm] = useState(null);
  // deleting: the id of the row currently being deleted (shows spinner, disables button)
  const [deleting, setDeleting] = useState(null);

  // Dismiss the dialog, call the parent's onDelete, wait for it to complete
  async function handleDelete(user) {
    setConfirm(null);
    setDeleting(user.id);
    try {
      await onDelete(user.id);
    } finally {
      setDeleting(null);
    }
  }

  // Skeleton state while the API call is in-flight
  if (users === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No users found.</p>
      </div>
    );
  }

  return (
    <>
      {/* Confirmation dialog — only rendered when a delete is pending */}
      {confirm && (
        <ConfirmDialog
          message={`Delete ${confirm.first_name} ${confirm.last_name}? This cannot be undone.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3" />{" "}
              {/* Actions column — no header label */}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-secondary/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground capitalize">
                  {user.first_name} {user.last_name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Clicking opens the confirm dialog — not the delete action directly */}
                  <button
                    onClick={() => setConfirm(user)}
                    disabled={deleting === user.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminUsers() {
  // tab: which user type is currently displayed ("students" | "instructors")
  const [tab, setTab] = useState("students");
  // Both lists fetched in parallel on mount; null while loading
  const [students, setStudents] = useState(null);
  const [instructors, setInstructors] = useState(null);
  const [error, setError] = useState("");

  // Fetch both lists in parallel on mount
  useEffect(() => {
    listStudents()
      .then(setStudents)
      .catch((e) => setError(e.message));
    listInstructors()
      .then(setInstructors)
      .catch((e) => setError(e.message));
  }, []);

  // Remove the deleted student from local state to avoid a full re-fetch
  async function handleDeleteStudent(id) {
    await deleteStudent(id);
    setStudents((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleDeleteInstructor(id) {
    await deleteInstructor(id);
    setInstructors((prev) => prev.filter((u) => u.id !== id));
  }

  // Tab configuration with live count badges
  const tabs = [
    { key: "students", label: "Students", count: students?.length },
    { key: "instructors", label: "Instructors", count: instructors?.length },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage platform users
          </p>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {/* Tab bar — underline style; -mb-px makes the active border connect to the table */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {/* Show count badge once the data has loaded */}
              {count !== undefined && (
                <span className="ml-2 text-xs bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Render the correct table based on the active tab */}
        {tab === "students" && (
          <UserTable users={students} onDelete={handleDeleteStudent} />
        )}
        {tab === "instructors" && (
          <UserTable users={instructors} onDelete={handleDeleteInstructor} />
        )}
      </div>
    </AdminLayout>
  );
}
