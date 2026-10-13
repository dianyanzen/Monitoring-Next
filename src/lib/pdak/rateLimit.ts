// Per-process guard. Multi-instance deployments should enforce the same quota at the proxy.
const windows = new Map<string, { start: number; count: number }>();
export function allowPdakRequest(user: string, now = Date.now()) {
  for (const [key, w] of windows)
    if (now - w.start >= 60000) windows.delete(key);
  const w = windows.get(user) || { start: now, count: 0 };
  if (w.count >= 12 || (!windows.has(user) && windows.size >= 1000))
    return false;
  w.count++;
  windows.set(user, w);
  return true;
}
