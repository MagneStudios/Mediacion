import type { Database as SupabaseDatabase } from "./database.types";

export type { Database as SupabaseDatabase, Json } from "./database.types";

type SupabaseTables = SupabaseDatabase["public"]["Tables"];

export type Database = {
  [TableName in keyof SupabaseTables]: SupabaseTables[TableName]["Row"];
};
