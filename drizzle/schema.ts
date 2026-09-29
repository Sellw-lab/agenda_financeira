import {
  boolean,
  date,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const financialProfiles = mysqlTable("financial_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  monthlyIncomeCents: int("monthlyIncomeCents").default(0).notNull(),
  savingsGoalCents: int("savingsGoalCents").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#416A5A"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  kind: mysqlEnum("kind", ["pix", "cash", "debit", "credit", "other"])
    .default("other")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const financialItems = mysqlTable("financial_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: mysqlEnum("kind", ["income", "expense", "bill"]).notNull(),
  amountCents: int("amountCents").notNull(),
  merchant: varchar("merchant", { length: 160 }),
  category: varchar("category", { length: 64 }).notNull().default("Outros"),
  entryDate: date("entryDate", { mode: "string" }).notNull(),
  dueDate: date("dueDate", { mode: "string" }),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  note: text("note"),
  isFixed: boolean("isFixed").default(false).notNull(),
  status: mysqlEnum("status", ["planned", "confirmed", "paid"])
    .default("confirmed")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chatConversations = mysqlTable("chat_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 120 }).default("Minha conversa").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  intent: varchar("intent", { length: 64 }),
  financialItemId: int("financialItemId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FinancialItem = typeof financialItems.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
