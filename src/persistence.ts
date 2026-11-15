import Dexie, { type Table } from "dexie";
import { initial, validate, type State } from "./engine";
class SaveDB extends Dexie {
  saves!: Table<{ id: string; data: State }, string>;
  constructor() {
    super("TiemTraMay");
    this.version(1).stores({ saves: "id" });
    this.version(2)
      .stores({ saves: "id" })
      .upgrade((tx) =>
        tx
          .table("saves")
          .toCollection()
          .modify((row) => {
            if (row.data?.version === 1) {
              row.data.version = 2;
              row.data.debt ??= 0;
              row.data.creditDay ??= 0;
              row.data.feedback ??= null;
              if (row.data.cup) row.data.cup.pourAt ??= -99;
            }
          }),
      );
  }
}
export const db = new SaveDB();
let pending = Promise.resolve();
export function save(s: State) {
  if (!validate(s))
    return Promise.reject(new Error("Dữ liệu lưu không hợp lệ"));
  const snapshot = structuredClone(s);
  pending = pending
    .catch(() => {})
    .then(async () => {
      await db.saves.put({ id: "main", data: snapshot });
    });
  return pending;
}
export async function load() {
  const row = await db.saves.get("main");
  if (!row) return initial();
  if (!validate(row.data))
    throw Error("Bản lưu không hợp lệ. Hãy nhập một bản JSON dự phòng.");
  return row.data;
}
export function parseSave(text: string) {
  const value: unknown = JSON.parse(text);
  if (!validate(value))
    throw Error("File save sai cấu trúc hoặc chứa dữ liệu không hợp lệ.");
  return value;
}
