export function getDecisionCount(response) {
  const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  return rows.length;
}

export function getActivityState({ loading, error, items }) {
  if (loading) return "loading";
  if (error) return "error";
  return items?.length ? "ready" : "empty";
}
