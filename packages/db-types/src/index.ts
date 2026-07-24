import type { ColumnType } from "kysely";
import type { Database as GeneratedDatabase } from "./database.types";

export type { Database as GeneratedDatabase, Json } from "./database.types";

type GeneratedTables = GeneratedDatabase["public"]["Tables"];

type TableColumn<
  TableName extends keyof GeneratedTables,
  ColumnName extends keyof GeneratedTables[TableName]["Row"],
> = ColumnType<
  GeneratedTables[TableName]["Row"][ColumnName],
  ColumnName extends keyof GeneratedTables[TableName]["Insert"]
    ? GeneratedTables[TableName]["Insert"][ColumnName]
    : never,
  ColumnName extends keyof GeneratedTables[TableName]["Update"]
    ? GeneratedTables[TableName]["Update"][ColumnName]
    : never
>;

export type Database = {
  [TableName in keyof GeneratedTables]: {
    [ColumnName in keyof GeneratedTables[TableName]["Row"]]: TableColumn<
      TableName,
      ColumnName
    >;
  };
};
