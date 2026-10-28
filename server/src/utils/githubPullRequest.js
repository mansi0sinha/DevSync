const OWNER_PATTERN = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?";
const REPOSITORY_PATTERN = "[A-Za-z0-9_.-]{1,100}";
const REPOSITORY_FULL_NAME = new RegExp(`^(${OWNER_PATTERN})/(${REPOSITORY_PATTERN})$`);

function normalizeRepositoryFullName(value) {
  if (typeof value !== "string" || value.length > 140) return null;
  const match = value.match(REPOSITORY_FULL_NAME);
  if (!match || match[2] === "." || match[2] === "..") return null;
  return { owner: match[1], repository: match[2], repositoryKey: `${match[1]}/${match[2]}`.toLowerCase() };
}

function parsePullRequestUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || !/^https:\/\/github\.com\//i.test(value) || /[\\%?#]/.test(value)) return null;
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com" || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;
  const match = parsed.pathname.match(new RegExp(`^/(${OWNER_PATTERN})/(${REPOSITORY_PATTERN})/pull/([1-9]\\d*)$`));
  if (!match || match[2] === "." || match[2] === "..") return null;
  const number = Number(match[3]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const owner = match[1];
  const repository = match[2];
  return { owner, repository, repositoryKey: `${owner}/${repository}`.toLowerCase(), number, url: `https://github.com/${owner}/${repository}/pull/${number}` };
}

module.exports = { normalizeRepositoryFullName, parsePullRequestUrl };
