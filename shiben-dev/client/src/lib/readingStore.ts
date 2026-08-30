/** 纸上远航：阅读记录只保存书目元数据与页码在浏览器本地，不保存教材文件。 */
export type ReadingEntry = {
  filePath: string;
  directory: string;
  fileName: string;
  page: number;
  favorite: boolean;
  updatedAt: number;
};

const STORAGE_KEY = "huawen-textbook-reading-v1";

export function loadReadingEntries(): ReadingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is ReadingEntry => Boolean(entry && typeof entry === "object" && "filePath" in entry && "directory" in entry && "fileName" in entry))
      .map((entry) => ({ ...entry, page: Number(entry.page) || 1, favorite: Boolean(entry.favorite), updatedAt: Number(entry.updatedAt) || 0 }))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function saveReadingEntries(entries: ReadingEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 40)));
}
