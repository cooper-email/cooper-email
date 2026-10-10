import { constants } from "node:fs";
import { access, chmod, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const readOptional = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw cause;
  }
};

/** Backup path for a config file. Keeps the first backup; later ones get a timestamp. */
export const backupPathFor = async (path: string, now: Date = new Date()): Promise<string> => {
  const base = `${path}.cooper-email.bak`;
  if (!(await exists(base))) return base;
  return `${base}.${now.toISOString().replace(/[:.]/g, "-")}`;
};

export const backup = async (path: string): Promise<string> => {
  const target = await backupPathFor(path);
  await copyFile(path, target, constants.COPYFILE_EXCL);
  await chmod(target, 0o600);
  return target;
};

/** Write atomically: temp file in the same directory, then rename. New files are 0600. */
export const writeAtomic = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  let mode = 0o600;
  try {
    mode = (await stat(path)).mode & 0o777;
  } catch {
    // new file
  }
  const temp = `${path}.cooper-email.tmp-${process.pid}`;
  await writeFile(temp, content, { encoding: "utf8", mode });
  try {
    await rename(temp, path);
  } catch (cause) {
    await rm(temp, { force: true });
    throw cause;
  }
};

export const removeFile = (path: string): Promise<void> => rm(path, { force: true });

export const removeDir = (path: string): Promise<void> => rm(path, { recursive: true, force: true });
