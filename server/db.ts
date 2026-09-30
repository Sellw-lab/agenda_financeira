import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  chatConversations,
  chatMessages,
  financialItems,
  financialProfiles,
  paymentMethods,
  InsertUser,
  User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateLocalUser() {
  const localOpenId = "local-host-owner";
  const existing = await getUserByOpenId(localOpenId);
  if (existing) return existing;
  await upsertUser({ openId: localOpenId, name: "Minha conta", email: "local@localhost", loginMethod: "local" });
  return getUserByOpenId(localOpenId);
}

export async function getOrCreateProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(financialProfiles).values({ userId });
  const created = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
  return created[0];
}

export async function getOrCreateConversation(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(chatConversations).where(eq(chatConversations.userId, userId)).orderBy(desc(chatConversations.updatedAt)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(chatConversations).values({ userId });
  const created = await db.select().from(chatConversations).where(eq(chatConversations.userId, userId)).orderBy(desc(chatConversations.id)).limit(1);
  return created[0];
}

export async function getMonthlySummary(userId: number, startDate: string, nextMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db
    .select({ kind: financialItems.kind, total: sql<number>`COALESCE(SUM(${financialItems.amountCents}), 0)`, isFixed: financialItems.isFixed })
    .from(financialItems)
    .where(and(eq(financialItems.userId, userId), gte(financialItems.entryDate, startDate), lt(financialItems.entryDate, nextMonth)))
    .groupBy(financialItems.kind, financialItems.isFixed);
  const byCategory = await db
    .select({ category: financialItems.category, total: sql<number>`COALESCE(SUM(${financialItems.amountCents}), 0)` })
    .from(financialItems)
    .where(and(eq(financialItems.userId, userId), eq(financialItems.kind, "expense"), gte(financialItems.entryDate, startDate), lt(financialItems.entryDate, nextMonth)))
    .groupBy(financialItems.category)
    .orderBy(desc(sql`SUM(${financialItems.amountCents})`))
    .limit(8);
  const latest = await db
    .select()
    .from(financialItems)
    .where(and(eq(financialItems.userId, userId), gte(financialItems.entryDate, startDate), lt(financialItems.entryDate, nextMonth)))
    .orderBy(desc(financialItems.entryDate), desc(financialItems.createdAt))
    .limit(12);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = await db
    .select()
    .from(financialItems)
    .where(and(eq(financialItems.userId, userId), eq(financialItems.kind, "bill"), gte(financialItems.dueDate, today), lt(financialItems.dueDate, nextMonth)))
    .orderBy(financialItems.dueDate)
    .limit(6);
  return { rows, byCategory, latest, upcoming };
}

export async function getRecentItems(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(financialItems).where(eq(financialItems.userId, userId)).orderBy(desc(financialItems.entryDate), desc(financialItems.createdAt)).limit(limit);
}

export async function getChatMessages(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversationId))).orderBy(chatMessages.createdAt).limit(60);
}

export async function getUserScopedItem(userId: number, itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(financialItems).where(and(eq(financialItems.id, itemId), eq(financialItems.userId, userId))).limit(1);
  return result[0];
}

export { and, chatConversations, chatMessages, desc, eq, financialItems, financialProfiles, gte, lt, paymentMethods, sql };
