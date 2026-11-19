import { useMemo } from "react";

export function usePermissions(workspace, user) {
  return useMemo(() => {
    const userId = String(user?._id || user?.id || "");
    const membership = workspace?.members?.find((member) => String(member.user?._id || member.user || "") === userId);
    return { isAdmin: String(membership?.role || "").toLowerCase() === "admin" };
  }, [workspace, user]);
}
