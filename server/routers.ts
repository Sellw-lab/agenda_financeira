import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  and,
  chatConversations,
  chatMessages,
  desc,
  eq,
  financialItems,
  financialProfiles,
  getChatMessages,
  getDb,
  getMonthlySummary,
  getOrCreateConversation,
  getOrCreateProfile,
  getRecentItems,
  getUserScopedItem,
  gte,
  lt,
  paymentMethods,
} from "./db";
import { z } from "zod";

const categoryKeywords: Record<string, string[]> = {
  Lazer: ["shopping", "cinema", "teatro", "jogo", "bar", "show", "viagem", "lazer"],
  "Farmácia": ["farmacia", "farmácia", "remedio", "remédio", "drogaria"],
  Comida: ["almoço", "almoco", "jantar", "cafe", "café", "restaurante", "comida", "lanche", "ifood", "delivery", "pizza", "padaria"],
  Mercado: ["mercado", "supermercado", "feira", "hortifruti"],
  Transporte: ["uber", "99", "gasolina", "combustivel", "combustível", "onibus", "ônibus", "metrô", "metro", "transporte", "estacionamento"],
  Moradia: ["aluguel", "luz", "energia", "água", "agua", "internet", "condominio", "condomínio", "casa", "conta"],
  Saúde: ["consulta", "médico", "medico", "dentista", "exame", "terapia", "saude", "saúde"],
  Educação: ["curso", "livro", "escola", "faculdade", "educacao", "educação"],
  Assinaturas: ["netflix", "spotify", "prime", "disney", "assinatura", "plano"],
  "Cuidados pessoais": ["academia", "barbearia", "cabeleireiro", "salão", "salao", "beleza"],
};

const knownCategories = ["Lazer", "Farmácia", "Comida", "Mercado", "Transporte", "Moradia", "Saúde", "Educação", "Assinaturas", "Cuidados pessoais", "Outros"];

function localDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const next = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start: start.toISOString().slice(0, 10), next: next.toISOString().slice(0, 10) };
}

function previousDay() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function centsFromNumber(value: number) {
  return Math.round(value * 100);
}

function parseMoney(text: string) {
  const matches = [...text.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi)];
  for (const match of matches) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 5), index).toLowerCase();
    if (/dia\s*$/.test(before)) continue;
    const raw = match[1];
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const value = Number(normalized);
    if (Number.isFinite(value) && value > 0) return centsFromNumber(value);
  }
  return null;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function detectCategory(text: string) {
  const lowered = text.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowered.includes(keyword))) return category;
  }
  return "Outros";
}

function detectMerchant(text: string, category: string) {
  const lowered = text.toLowerCase();
  const known = Object.entries(categoryKeywords).flatMap(([, keywords]) => keywords);
  const match = known.find(keyword => lowered.includes(keyword));
  if (match) return match.replace(/^./, char => char.toUpperCase());
  const cleaned = text
    .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi, "")
    .replace(/\b(gastei|gasto|paguei|pagar|recebi|receita|ganhei|no|na|em|com|de|do|da|um|uma|reais|real|fixo|fixa)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 80) : category;
}

function detectPaymentMethod(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes("pix")) return "Pix";
  if (lowered.includes("cartão") || lowered.includes("cartao")) return "Cartão";
  if (lowered.includes("dinheiro")) return "Dinheiro";
  if (lowered.includes("débito") || lowered.includes("debito")) return "Débito";
  return null;
}

function detectDueDate(text: string) {
  const match = text.match(/(?:vence|vencimento|dia)\s*(?:em\s*)?(\d{1,2})/i);
  if (!match) return null;
  const day = Math.min(28, Math.max(1, Number(match[1])));
  const date = new Date();
  date.setDate(day);
  return date.toISOString().slice(0, 10);
}

function parseTransaction(text: string) {
  const lowered = text.toLowerCase();
  const amountCents = parseMoney(text);
  if (!amountCents) return null;
  const isIncome = /\b(recebi|ganhei|salário|salario|renda|entrada|receita)\b/i.test(text);
  const isBill = /\b(conta|boleto|vence|vencimento)\b/i.test(text);
  const category = isIncome ? "Renda" : detectCategory(text);
  const dueDate = isBill ? detectDueDate(text) : null;
  const isFixed = /\b(fixo|fixa|recorrente|mensal)\b/i.test(text);
  return {
    kind: isIncome ? "income" as const : isBill ? "bill" as const : "expense" as const,
    amountCents,
    category,
    merchant: detectMerchant(text, category),
    entryDate: localDate(),
    dueDate,
    paymentMethod: detectPaymentMethod(text),
    note: text.trim(),
    isFixed,
    status: isBill ? "planned" as const : "confirmed" as const,
    confidence: lowered.includes("gastei") || isIncome || isBill ? "high" as const : "medium" as const,
  };
}

function isQuery(text: string) {
  const lowered = text.toLowerCase();
  return /\b(saldo|quanto gastei|gastos|listar|resumo|despesas|receitas|último|ultimo)\b/.test(lowered);
}

async function answerQuery(userId: number, text: string) {
  const lowered = text.toLowerCase();
  const { start, next } = monthBounds();
  const summary = await getMonthlySummary(userId, start, next);
  const totals = summary.rows.reduce((acc, row) => {
    const total = Number(row.total ?? 0);
    if (row.kind === "income") acc.income += total;
    if (row.kind === "expense" || row.kind === "bill") acc.expense += total;
    if (row.isFixed && row.kind !== "income") acc.fixed += total;
    return acc;
  }, { income: 0, expense: 0, fixed: 0 });
  if (lowered.includes("saldo")) return `Seu saldo previsto neste mês é **${formatBRL(totals.income - totals.expense)}**. Entraram ${formatBRL(totals.income)} e saíram ${formatBRL(totals.expense)}.`;
  if (lowered.includes("categoria") || lowered.includes("comida") || lowered.includes("lazer") || lowered.includes("farmácia") || lowered.includes("farmacia")) {
    const requested = knownCategories.find(category => lowered.includes(category.toLowerCase()));
    const rows = requested ? summary.byCategory.filter(row => row.category.toLowerCase() === requested.toLowerCase()) : summary.byCategory;
    if (!rows.length) return "Ainda não encontrei gastos nessa categoria neste mês.";
    return requested ? `Você gastou **${formatBRL(Number(rows[0].total))}** com ${requested} neste mês.` : `As categorias que mais pesaram neste mês foram: ${rows.slice(0, 4).map(row => `${row.category} (${formatBRL(Number(row.total))})`).join(", ")}.`;
  }
  const items = await getRecentItems(userId, 30);
  const filtered = lowered.includes("ontem") ? items.filter(item => item.entryDate === previousDay()) : items.slice(0, 5);
  if (!filtered.length) return "Ainda não há lançamentos para mostrar.";
  return `Aqui estão seus lançamentos mais recentes:\n${filtered.slice(0, 5).map(item => `• ${item.entryDate.split("-").reverse().join("/")} · ${item.merchant || item.category} · ${item.kind === "income" ? "+" : "-"}${formatBRL(item.amountCents)}`).join("\n")}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  finance: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user.id);
      const { start, next } = monthBounds();
      const summary = await getMonthlySummary(ctx.user.id, start, next);
      const totals = summary.rows.reduce((acc, row) => {
        const total = Number(row.total ?? 0);
        if (row.kind === "income") acc.income += total;
        if (row.kind === "expense" || row.kind === "bill") acc.expense += total;
        if (row.isFixed && row.kind !== "income") acc.fixed += total;
        if (!row.isFixed && row.kind !== "income") acc.variable += total;
        return acc;
      }, { income: 0, expense: 0, fixed: 0, variable: 0 });
      return { profile, totals: { ...totals, balance: totals.income - totals.expense }, categories: summary.byCategory.map(row => ({ ...row, total: Number(row.total ?? 0) })), latest: summary.latest, upcoming: summary.upcoming };
    }),
    items: router({
      list: protectedProcedure.query(({ ctx }) => getRecentItems(ctx.user.id, 60)),
      create: protectedProcedure.input(z.object({ kind: z.enum(["income", "expense", "bill"]), amountCents: z.number().int().positive(), merchant: z.string().max(160).optional(), category: z.string().max(64).default("Outros"), entryDate: z.string(), dueDate: z.string().nullable().optional(), paymentMethod: z.string().max(80).nullable().optional(), note: z.string().max(500).nullable().optional(), isFixed: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        await db.insert(financialItems).values({ ...input, userId: ctx.user.id, dueDate: input.dueDate ?? null, paymentMethod: input.paymentMethod ?? null, note: input.note ?? null, status: input.kind === "bill" ? "planned" : "confirmed" });
        return { success: true };
      }),
      update: protectedProcedure.input(z.object({ id: z.number().int(), merchant: z.string().max(160).optional(), category: z.string().max(64).optional(), amountCents: z.number().int().positive().optional(), entryDate: z.string().optional(), isFixed: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        const { id, ...changes } = input;
        await db.update(financialItems).set(changes).where(and(eq(financialItems.id, id), eq(financialItems.userId, ctx.user.id)));
        return { success: true };
      }),
      remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        await db.delete(financialItems).where(and(eq(financialItems.id, input.id), eq(financialItems.userId, ctx.user.id)));
        return { success: true };
      }),
    }),
    profile: router({
      get: protectedProcedure.query(({ ctx }) => getOrCreateProfile(ctx.user.id)),
      update: protectedProcedure.input(z.object({ monthlyIncomeCents: z.number().int().nonnegative(), savingsGoalCents: z.number().int().nonnegative() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        await getOrCreateProfile(ctx.user.id);
        await db.update(financialProfiles).set(input).where(eq(financialProfiles.userId, ctx.user.id));
        return { success: true };
      }),
    }),
    methods: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        return db.select().from(paymentMethods).where(eq(paymentMethods.userId, ctx.user.id)).orderBy(desc(paymentMethods.createdAt)).limit(20);
      }),
      add: protectedProcedure.input(z.object({ name: z.string().min(1).max(80), kind: z.enum(["pix", "cash", "debit", "credit", "other"]).default("other") })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        await db.insert(paymentMethods).values({ ...input, userId: ctx.user.id });
        return { success: true };
      }),
    }),
    chat: router({
      history: protectedProcedure.query(async ({ ctx }) => {
        const conversation = await getOrCreateConversation(ctx.user.id);
        return getChatMessages(ctx.user.id, conversation.id);
      }),
      send: protectedProcedure.input(z.object({ text: z.string().trim().min(1).max(1000) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database is not available");
        const conversation = await getOrCreateConversation(ctx.user.id);
        await db.insert(chatMessages).values({ conversationId: conversation.id, userId: ctx.user.id, role: "user", content: input.text });
        let reply = "";
        let intent = "clarify";
        let financialItemId: number | undefined;
        if (isQuery(input.text)) {
          intent = "query";
          reply = await answerQuery(ctx.user.id, input.text);
        } else if (/\b(remover|apagar|excluir)\b.*\b(último|ultimo|lançamento|lancamento)\b/i.test(input.text)) {
          intent = "delete_last";
          const items = await getRecentItems(ctx.user.id, 1);
          if (!items[0]) reply = "Você ainda não tem lançamentos para remover.";
          else {
            await db.delete(financialItems).where(and(eq(financialItems.id, items[0].id), eq(financialItems.userId, ctx.user.id)));
            reply = `Removi o lançamento de ${items[0].merchant || items[0].category} no valor de ${formatBRL(items[0].amountCents)}.`;
          }
        } else {
          const parsed = parseTransaction(input.text);
          if (!parsed) {
            reply = "Posso registrar uma receita, despesa ou conta. Tente algo como “shopping 10”, “gastei 35 no almoço” ou “recebi 2500 salário”.";
          } else if (parsed.confidence === "medium" && parsed.category === "Outros") {
            reply = `Encontrei ${formatBRL(parsed.amountCents)}, mas não consegui identificar o estabelecimento ou a categoria. Onde foi esse gasto?`;
          } else {
            intent = "create_item";
            const inserted = await db.insert(financialItems).values({ userId: ctx.user.id, kind: parsed.kind, amountCents: parsed.amountCents, merchant: parsed.merchant, category: parsed.category, entryDate: parsed.entryDate, dueDate: parsed.dueDate, paymentMethod: parsed.paymentMethod, note: parsed.note, isFixed: parsed.isFixed, status: parsed.status });
            financialItemId = Number(inserted[0]?.insertId);
            const verb = parsed.kind === "income" ? "Receita registrada" : parsed.kind === "bill" ? "Conta planejada" : "Gasto registrado";
            reply = `${verb}: **${formatBRL(parsed.amountCents)}** em ${parsed.merchant || parsed.category}, na categoria ${parsed.category}.${parsed.isFixed ? " Marquei como fixo." : ""}`;
          }
        }
        await db.insert(chatMessages).values({ conversationId: conversation.id, userId: ctx.user.id, role: "assistant", content: reply, intent, financialItemId });
        return { reply, intent, financialItemId: financialItemId ?? null };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
