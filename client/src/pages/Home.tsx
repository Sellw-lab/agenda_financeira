import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  CalendarDays,
  CreditCard,
  Download,
  Edit3,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Receipt,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type Kind = "income" | "expense" | "bill";
type View = "overview" | "transactions" | "tools" | "settings";
type Item = {
  id: number;
  kind: Kind;
  amountCents: number;
  merchant: string;
  category: string;
  entryDate: string;
  isFixed: boolean;
  paymentMethod?: string;
  isPlanned?: boolean;
  scheduledDay?: number;
  endOfMonth?: boolean;
};
type Message = { id: number; role: "user" | "assistant"; content: string };
type SavingsEdit = { name: string; amountCents: number } | null;
type Goal = {
  id: number;
  name: string;
  targetCents: number;
  savedCents: number;
  dueDate?: string;
};
type Budget = {
  id: number;
  category: string;
  limitCents: number;
  month: string;
};
type Card = {
  id: number;
  name: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
};
type Recurring = {
  id: number;
  name: string;
  amountCents: number;
  category: string;
  dueDay: number;
};
type Profile = {
  monthlyIncomeCents: number;
  savingsGoalCents: number;
  incomeByMonth?: Record<string, number>;
  salarySchedule?: {
    amountCents: number;
    day: number;
    nextDue: string;
    endOfMonth?: boolean;
  };
  savingsAccounts?: Record<string, number>;
  savingsEntries?: Array<{
    id: number;
    name: string;
    amountCents: number;
    entryDate: string;
  }>;
  goals?: Goal[];
  budgets?: Budget[];
  cards?: Card[];
  recurring?: Recurring[];
  theme?: "light" | "dark";
};
type EditItem = Item;

const STORAGE_KEY = "bolso-claro-local-v1";
const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const categoryColors: Record<string, string> = {
  Lazer: "#C9A06A",
  Farmácia: "#8E7BB5",
  Comida: "#E07A5F",
  Mercado: "#71A68A",
  Transporte: "#6B8FC4",
  Moradia: "#A77E66",
  Saúde: "#C77788",
  Educação: "#5C9DA1",
  Assinaturas: "#8A8AB7",
  "Cuidados pessoais": "#D68EAE",
  Outros: "#9BA5A0",
};
const categories = Object.keys(categoryColors);
const paymentMethods = ["Pix", "Crédito", "Débito", "Dinheiro"];
const logoUrl = `${import.meta.env.BASE_URL}bolso-claro-logo.svg`;

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function today() {
  return localDate();
}
function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(" de ", " ");
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addMonths(value: string, months: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
  date.setDate(Math.min(new Date(`${value}T12:00:00`).getDate(), lastDay));
  return dateKey(date);
}
function nextMonthDate(value: string, day: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
  date.setDate(Math.min(day, lastDay));
  return dateKey(date);
}
function salaryEndOfMonthDate(reference: string) {
  const referenceDate = new Date(`${reference}T12:00:00`);
  const currentLastDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
    12
  );
  if (referenceDate.getDate() <= currentLastDay.getDate())
    return dateKey(currentLastDay);
  return dateKey(
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 2, 0, 12)
  );
}
function scheduleFromText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("depois de amanhã") || lower.includes("depois de amanha"))
    return {
      entryDate: localDate(2),
      isPlanned: true,
      scheduledDay: undefined,
      endOfMonth: false,
    };
  if (lower.includes("amanhã") || lower.includes("amanha"))
    return {
      entryDate: localDate(1),
      isPlanned: true,
      scheduledDay: undefined,
      endOfMonth: false,
    };
  if (
    lower.includes("final do mês") ||
    lower.includes("final do mes") ||
    lower.includes("fim do mês") ||
    lower.includes("fim do mes") ||
    lower.includes("último dia") ||
    lower.includes("ultimo dia")
  )
    return {
      entryDate: salaryEndOfMonthDate(today()),
      isPlanned: true,
      scheduledDay: undefined,
      endOfMonth: true,
    };
  const dateMatch = lower.match(/\b(?:dia|em)\s*(\d{1,2})(?:\/(\d{1,2}))?\b/);
  if (dateMatch) {
    const now = new Date();
    const requestedDay = Math.min(31, Number(dateMatch[1]));
    const hasExplicitMonth = Boolean(dateMatch[2]);
    const month = hasExplicitMonth
      ? Number(dateMatch[2])
      : now.getMonth() + 1 + (requestedDay <= now.getDate() ? 1 : 0);
    const lastDay = new Date(now.getFullYear(), month, 0).getDate();
    const date = new Date(
      now.getFullYear(),
      month - 1,
      Math.min(requestedDay, lastDay),
      12
    );
    return {
      entryDate: dateKey(date),
      isPlanned: true,
      scheduledDay: requestedDay,
      endOfMonth: false,
    };
  }
  return {
    entryDate: today(),
    isPlanned: false,
    scheduledDay: undefined,
    endOfMonth: false,
  };
}
function money(cents = 0) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function parseMoney(value: string) {
  return (
    Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100) || 0
  );
}
function shortDate(value: string) {
  return new Date(`${value}T12:00:00`)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(" de ", " ");
}
function initials(name = "Você") {
  return name
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function monthLabel() {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}
function currentMonthKey() {
  return today().slice(0, 7);
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 6
    ? "Boa madrugada"
    : hour < 12
      ? "Bom dia"
      : hour < 18
        ? "Boa tarde"
        : "Boa noite";
}
function isMonthClosing() {
  const now = new Date();
  return (
    now.getDate() >=
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - 2
  );
}
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveStore(data: {
  items: Item[];
  messages: Message[];
  profile: Profile;
}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function parseSavingsText(text: string) {
  if (!/\b(poupança|poupanca)\b/i.test(text)) return null;
  const matches = [
    ...text.matchAll(
      /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi
    ),
  ];
  const match = matches.at(-1);
  if (!match) return null;
  const amountCents = parseMoney(match[1]);
  if (!amountCents) return null;
  const account = text
    .replace(match[0], "")
    .replace(
      /\b(poupança|poupanca|guardar|guardei|coloquei|depositei|na|no|para|conta|dinheiro|reais|real)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
  const name = account
    ? account.replace(/^./, char => char.toUpperCase())
    : "Poupança principal";
  return { name: name.slice(0, 40), amountCents };
}

function parseText(text: string): Omit<Item, "id"> | null {
  const match = text.match(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i
  );
  if (!match) return null;
  const amountCents = parseMoney(match[1]);
  if (!amountCents) return null;
  const lower = text.toLowerCase();
  const kind: Kind =
    /\b(recebi|ganhei|salário|salario|renda|entrada|receita)\b/.test(lower)
      ? "income"
      : /\b(conta|boleto|vence|vencimento)\b/.test(lower)
        ? "bill"
        : "expense";
  const keywords: Record<string, string[]> = {
    Mercado: ["mercado", "supermercado", "feira"],
    Comida: [
      "almoço",
      "almoco",
      "jantar",
      "café",
      "cafe",
      "ifood",
      "pizza",
      "lanche",
      "restaurante",
    ],
    Transporte: [
      "uber",
      "99",
      "gasolina",
      "ônibus",
      "onibus",
      "metrô",
      "metro",
    ],
    Moradia: ["aluguel", "luz", "água", "agua", "internet", "casa"],
    Farmácia: ["farmácia", "farmacia", "remédio", "remedio"],
    Lazer: ["shopping", "cinema", "viagem", "bar", "show"],
    Saúde: ["médico", "medico", "dentista", "exame"],
    Assinaturas: ["netflix", "spotify", "prime", "assinatura"],
    "Cuidados pessoais": ["academia", "barbearia", "salão", "salao"],
    Educação: ["curso", "livro", "escola"],
  };
  const category =
    kind === "income"
      ? "Renda"
      : Object.entries(keywords).find(([, words]) =>
          words.some(word => lower.includes(word))
        )?.[0] || "Outros";
  const paymentMethod = lower.includes("pix")
    ? "Pix"
    : lower.includes("crédito") ||
        lower.includes("credito") ||
        lower.includes("cartão") ||
        lower.includes("cartao")
      ? "Crédito"
      : lower.includes("débito") || lower.includes("debito")
        ? "Débito"
        : lower.includes("dinheiro") ||
            lower.includes("espécie") ||
            lower.includes("especie")
          ? "Dinheiro"
          : undefined;
  const merchant = (
    text
      .replace(match[0], "")
      .replace(
        /\b(pix|crédito|credito|cartão|cartao|débito|debito|dinheiro|espécie|especie|gastei|gasto|paguei|recebo|recebi|ganhei|salário|salario|amanhã|amanha|depois|dia|no|na|em|com|de|do|da|reais|real|fixo|fixa)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim() || category
  ).slice(0, 80);
  const schedule = scheduleFromText(text);
  return {
    kind,
    amountCents,
    merchant,
    category,
    entryDate: schedule.entryDate,
    isFixed: /\b(fixo|fixa|recorrente|mensal)\b/.test(lower),
    paymentMethod,
    isPlanned:
      schedule.isPlanned ||
      /\b(recebo|vai cair|previsto|prevista)\b/.test(lower),
    scheduledDay: schedule.scheduledDay,
    endOfMonth: schedule.endOfMonth,
  };
}

export default function Home() {
  const initial = useMemo(
    () =>
      readStore() || {
        items: [],
        messages: [],
        profile: { monthlyIncomeCents: 0, savingsGoalCents: 0 },
      },
    []
  );
  const [items, setItems] = useState<Item[]>(initial.items);
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const [view, setView] = useState<View>("overview");
  const [chatInput, setChatInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingsEdit, setSavingsEdit] = useState<SavingsEdit>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "expenses" | "income" | "future"
  >("all");
  const [lastChatItem, setLastChatItem] = useState<{
    id: number;
    merchant: string;
  } | null>(null);
  useEffect(
    () => saveStore({ items, messages, profile }),
    [items, messages, profile]
  );
  useEffect(() => {
    const schedule = profile.salarySchedule;
    if (!schedule || today() < schedule.nextDue) return;
    setProfile(current => {
      const dueMonth = schedule.nextDue.slice(0, 7);
      const incomeByMonth = { ...(current.incomeByMonth || {}) };
      if (incomeByMonth[dueMonth] === undefined)
        incomeByMonth[dueMonth] = schedule.amountCents;
      return {
        ...current,
        monthlyIncomeCents: schedule.amountCents,
        incomeByMonth,
        salarySchedule: {
          ...schedule,
          nextDue: schedule.endOfMonth
            ? nextMonthDate(schedule.nextDue, 31)
            : nextMonthDate(schedule.nextDue, schedule.day),
        },
      };
    });
  }, [profile.salarySchedule?.nextDue]);

  const actualTotals = useMemo(
    () =>
      items
        .filter(item => item.entryDate.slice(0, 7) === today().slice(0, 7))
        .reduce(
          (acc, item) => {
            if (item.kind === "income") acc.income += item.amountCents;
            else {
              acc.expense += item.amountCents;
              if (item.isFixed) acc.fixed += item.amountCents;
            }
            return acc;
          },
          { income: 0, expense: 0, fixed: 0 }
        ),
    [items]
  );
  const monthIncome = profile.incomeByMonth
    ? (profile.incomeByMonth[currentMonthKey()] ?? 0)
    : profile.monthlyIncomeCents;
  const totals = {
    ...actualTotals,
    plannedIncome: monthIncome,
    income: actualTotals.income + monthIncome,
  };
  const savingsTotal = Object.values(profile.savingsAccounts || {}).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const savingsThisMonth = (profile.savingsEntries || [])
    .filter(entry => entry.entryDate.slice(0, 7) === currentMonthKey())
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const monthBalance = totals.income - totals.expense - savingsThisMonth;
  const hasMonthActivity =
    actualTotals.expense > 0 ||
    actualTotals.income > 0 ||
    savingsThisMonth > 0 ||
    monthIncome > 0;
  const monthStatus =
    isMonthClosing() &&
    hasMonthActivity &&
    (monthIncome > 0 || actualTotals.income > 0)
      ? monthBalance >= 0
        ? `Fechamento do mês: sobrou ${money(monthBalance)} da sua renda prevista.`
        : `Atenção: o mês deve fechar ${money(Math.abs(monthBalance))} no vermelho.`
      : null;
  const categoriesTotal = useMemo(
    () =>
      Object.entries(
        items
          .filter(
            item =>
              item.entryDate.slice(0, 7) === today().slice(0, 7) &&
              item.kind !== "income"
          )
          .reduce<Record<string, number>>((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + item.amountCents;
            return acc;
          }, {})
      ).sort((a, b) => b[1] - a[1]),
    [items]
  );
  const recent = [...items].sort(
    (a, b) => b.entryDate.localeCompare(a.entryDate) || b.id - a.id
  );
  const name = "você";
  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
  }
  function updateProfile(patch: Partial<Profile>) {
    setProfile(current => ({ ...current, ...patch }));
  }
  function importData(data: {
    items?: Item[];
    messages?: Message[];
    profile?: Profile;
  }) {
    if (data.items) setItems(data.items);
    if (data.messages) setMessages(data.messages);
    if (data.profile) setProfile(data.profile);
  }
  function exportData(format: "json" | "csv") {
    const data = { items, messages, profile };
    const content =
      format === "json"
        ? JSON.stringify(data, null, 2)
        : [
            "data;tipo;nome;categoria;valor",
            ...items.map(
              item =>
                `${item.entryDate};${item.kind};${item.merchant};${item.category};${money(item.amountCents)}`
            ),
          ].join("\n");
    const blob = new Blob([content], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bolso-claro-backup.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const filteredItems = recent.filter(item =>
    `${item.merchant} ${item.category} ${item.paymentMethod || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const historyItems = recent
    .filter(item => {
      if (historyFilter === "expenses") return item.kind !== "income";
      if (historyFilter === "income") return item.kind === "income";
      if (historyFilter === "future")
        return item.entryDate > today() || Boolean(item.isPlanned);
      return true;
    })
    .sort((a, b) => {
      const aFuture = a.entryDate > today() || Boolean(a.isPlanned);
      const bFuture = b.entryDate > today() || Boolean(b.isPlanned);
      if (historyFilter === "all" && aFuture !== bFuture)
        return aFuture ? 1 : -1;
      return b.entryDate.localeCompare(a.entryDate) || b.id - a.id;
    });
  const historyFilters = [
    ["all", "todos"],
    ["expenses", "despesas"],
    ["income", "receitas"],
    ["future", "futuros"],
  ] as const;
  function addItem(item: Omit<Item, "id">) {
    const id = Date.now();
    setItems(current => [
      {
        ...item,
        isPlanned:
          item.isPlanned || item.entryDate > today() || item.kind === "bill",
        id,
      },
      ...current,
    ]);
    setAddOpen(false);
    return id;
  }
  function updateItem(changes: Omit<Item, "id">) {
    if (!editItem) return;
    setItems(current =>
      current.map(item =>
        item.id === editItem.id ? { ...changes, id: editItem.id } : item
      )
    );
    setEditItem(null);
  }
  function updateSavings(
    name: string,
    initialCents: number,
    savedCents: number,
    withdrawnCents: number,
    nextName: string
  ) {
    const trimmedName =
      nextName.trim().slice(0, 40) || name || "Poupança principal";
    const finalCents = initialCents + savedCents - withdrawnCents;
    if (finalCents < 0) return;
    setProfile(current => {
      const accounts = { ...(current.savingsAccounts || {}) };
      if (name && name !== trimmedName) delete accounts[name];
      accounts[trimmedName] = finalCents;
      const entries = [...(current.savingsEntries || [])];
      if (savedCents > 0)
        entries.push({
          id: Date.now(),
          name: trimmedName,
          amountCents: savedCents,
          entryDate: today(),
        });
      if (withdrawnCents > 0)
        entries.push({
          id: Date.now() + 1,
          name: trimmedName,
          amountCents: -withdrawnCents,
          entryDate: today(),
        });
      return { ...current, savingsAccounts: accounts, savingsEntries: entries };
    });
    setSavingsEdit(null);
  }
  function sendChat(event: FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (/\b(desfazer|desfaza|estornar|corrigir|errei)\b/i.test(text)) {
      if (lastChatItem) {
        setItems(current =>
          current.filter(item => item.id !== lastChatItem.id)
        );
        setMessages(current => [
          ...current,
          { id: Date.now(), role: "user", content: text },
          {
            id: Date.now() + 1,
            role: "assistant",
            content: `Desfiz “${lastChatItem.merchant}”. O valor voltou para o saldo previsto do mês.`,
          },
        ]);
        setLastChatItem(null);
      } else {
        setMessages(current => [
          ...current,
          { id: Date.now(), role: "user", content: text },
          {
            id: Date.now() + 1,
            role: "assistant",
            content: "Não encontrei uma despesa recente para desfazer.",
          },
        ]);
      }
      setChatInput("");
      setChatOpen(false);
      return;
    }
    const savings = parseSavingsText(text);
    const parsed = parseText(text);
    let reply =
      "Posso registrar uma receita, despesa, poupança ou conta. Tente: “Pix 10 shopping”, “poupança viagem 100” ou “salário 1654 dia 5”.";
    if (savings) {
      setProfile(current => ({
        ...current,
        savingsAccounts: {
          ...(current.savingsAccounts || {}),
          [savings.name]:
            (current.savingsAccounts?.[savings.name] || 0) +
            savings.amountCents,
        },
        savingsEntries: [
          ...(current.savingsEntries || []),
          {
            id: Date.now(),
            name: savings.name,
            amountCents: savings.amountCents,
            entryDate: today(),
          },
        ],
      }));
      reply = `Separei ${money(savings.amountCents)} na ${savings.name}. Esse valor fica separado das despesas.`;
    } else if (/\b(saldo|quanto gastei|gastos|resumo)\b/i.test(text))
      reply = `Neste mês: renda prevista ${money(totals.income)}, despesas ${money(totals.expense)}. Seu saldo previsto é ${money(monthBalance)}.`;
    else if (parsed) {
      const isSalarySchedule =
        parsed.kind === "income" &&
        (parsed.scheduledDay || parsed.endOfMonth) &&
        /\b(salário|salario)\b/i.test(text);
      if (isSalarySchedule) {
        setProfile(current => ({
          ...current,
          monthlyIncomeCents: 0,
          incomeByMonth: {
            ...(current.incomeByMonth || {}),
            [currentMonthKey()]: 0,
          },
          salarySchedule: {
            amountCents: parsed.amountCents,
            day: parsed.scheduledDay || 31,
            nextDue: parsed.entryDate,
            endOfMonth: parsed.endOfMonth,
          },
        }));
        reply = parsed.endOfMonth
          ? `Salário agendado: ${money(parsed.amountCents)} no último dia de cada mês. No dia 30 ou 31 (ou no último dia de fevereiro), ele entra automaticamente na renda e fecha o mês.`
          : `Salário agendado: ${money(parsed.amountCents)} todo dia ${parsed.scheduledDay}. O valor entra automaticamente na renda quando chegar a data prevista.`;
      } else if (/\b(salário|salario)\b/i.test(text)) {
        setProfile(current => ({
          ...current,
          monthlyIncomeCents: parsed.amountCents,
          incomeByMonth: {
            ...(current.incomeByMonth || {}),
            [currentMonthKey()]: parsed.amountCents,
          },
        }));
        reply = `Renda de ${money(parsed.amountCents)} atualizada nas configurações para ${monthLabel()}.`;
      } else {
        const addedId = addItem(parsed);
        if (parsed.kind !== "income")
          setLastChatItem({ id: addedId, merchant: parsed.merchant });
        else setLastChatItem(null);
        reply = `${parsed.kind === "income" ? (parsed.isPlanned ? "Receita prevista" : "Receita extra registrada") : parsed.kind === "bill" ? "Conta planejada" : "Gasto registrado"}: ${parsed.merchant} · ${money(parsed.amountCents)}${parsed.paymentMethod ? ` · ${parsed.paymentMethod}` : ""}${parsed.entryDate !== today() ? ` · para ${dateLabel(parsed.entryDate)}` : ""}.`;
        if (parsed.kind === "income")
          reply += ` O valor já foi somado ao saldo previsto de ${monthLabel()}.`;
        else
          reply +=
            " Se foi um erro, digite “desfazer” para devolver o valor ao saldo.";
      }
    }
    setMessages(current => [
      ...current,
      { id: Date.now(), role: "user", content: text },
      { id: Date.now() + 1, role: "assistant", content: reply },
    ]);
    setChatInput("");
    setChatOpen(false);
  }

  return (
    <div className={`app-shell ${profile.theme === "dark" ? "dark-mode" : ""}`}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <img src={logoUrl} alt="" className="brand-mark" />
          <div>
            <p className="brand-name">Bolso Claro</p>
            <p className="brand-caption">agenda financeira</p>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <NavButton
            active={view === "overview"}
            icon={<LayoutDashboard size={18} />}
            label="Visão geral"
            onClick={() => navigate("overview")}
          />
          <NavButton
            active={view === "transactions"}
            icon={<Receipt size={18} />}
            label="Lançamentos"
            onClick={() => navigate("transactions")}
          />
          <NavButton
            active={view === "tools"}
            icon={<Target size={18} />}
            label="Ferramentas"
            onClick={() => navigate("tools")}
          />
          <NavButton
            active={view === "settings"}
            icon={<Settings2 size={18} />}
            label="Configurações"
            onClick={() => navigate("settings")}
          />
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon">
            <Sparkles size={16} />
          </div>
          <p>
            <strong>Modo privado</strong>
            <br />
            Seus dados ficam apenas neste celular, sem conta e sem
            compartilhamento.
          </p>
        </div>
        <div className="sidebar-profile">
          <div className="avatar">VC</div>
          <div className="profile-copy">
            <strong>Minha agenda</strong>
            <span>armazenamento local</span>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="eyebrow">{monthLabel()}</p>
              <h1>
                {view === "overview"
                  ? `${greeting()}, ${name}`
                  : view === "transactions"
                    ? "Seus lançamentos"
                    : "Seu espaço financeiro"}
              </h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="notification-button"
              onClick={() => setChatOpen(true)}
              aria-label="Abrir copiloto"
            >
              <Bell size={18} />
            </button>
            <button className="top-avatar" onClick={() => setProfileOpen(true)}>
              VC
            </button>
          </div>
        </header>
        {view === "overview" && (
          <div className="page-grid">
            <section className="content-column">
              {monthStatus && (
                <MonthStatus
                  message={monthStatus}
                  positive={monthBalance >= 0}
                />
              )}
              <div className="balance-card">
                <div className="balance-card-top">
                  <div>
                    <p className="card-kicker">Saldo previsto no mês</p>
                    <p className="balance-value">{money(monthBalance)}</p>
                  </div>
                  <div className="balance-badge">
                    <TrendingUp size={14} /> local e privado
                  </div>
                </div>
                <div className="balance-rule" />
                <div className="balance-footer">
                  <span>
                    <ArrowUpRight size={14} /> receitas{" "}
                    <strong>{money(totals.income)}</strong>
                  </span>
                  <span>
                    <ArrowDownLeft size={14} /> despesas{" "}
                    <strong>{money(totals.expense)}</strong>
                  </span>
                </div>
              </div>
              <div className="metrics-grid">
                <Metric
                  icon={<ArrowUpRight size={17} />}
                  label="Receitas"
                  value={money(totals.income)}
                  accent="green"
                  note="neste mês"
                />
                <Metric
                  icon={<ArrowDownLeft size={17} />}
                  label="Despesas"
                  value={money(totals.expense)}
                  accent="orange"
                  note="neste mês"
                />
                <Metric
                  icon={<Receipt size={17} />}
                  label="Gastos fixos"
                  value={money(totals.fixed)}
                  accent="purple"
                  note="compromissos"
                />
                <Metric
                  icon={<WalletCards size={17} />}
                  label="Poupanças"
                  value={money(savingsTotal)}
                  accent="green"
                  note="total guardado"
                />
              </div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Visão do mês</p>
                  <h2>Para onde vai seu dinheiro</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("transactions")}
                >
                  ver lançamentos <ChevronRight size={15} />
                </button>
              </div>
              <div className="panel category-panel">
                {categoriesTotal.length ? (
                  categoriesTotal.map(([category, total]) => (
                    <div className="category-row" key={category}>
                      <div className="category-meta">
                        <span
                          className="category-dot"
                          style={{
                            backgroundColor:
                              categoryColors[category] || categoryColors.Outros,
                          }}
                        />
                        <span>{category}</span>
                        <strong>{money(total)}</strong>
                      </div>
                      <div className="category-track">
                        <span
                          style={{
                            width: `${Math.max(8, (total / categoriesTotal[0][1]) * 100)}%`,
                            backgroundColor:
                              categoryColors[category] || categoryColors.Outros,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyPanel
                    icon={<BarChart3 size={22} />}
                    title="Seu mapa financeiro começa aqui"
                    body="Registre um gasto no chat e suas categorias aparecem neste espaço."
                  />
                )}
              </div>
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Histórico</p>
                  <h2>Últimos lançamentos</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setAddOpen(true)}
                  aria-label="Adicionar lançamento"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div
                className="transaction-filters history-filters"
                aria-label="Filtrar histórico"
              >
                {historyFilters.map(([value, label]) => (
                  <button
                    key={value}
                    className={historyFilter === value ? "active" : ""}
                    onClick={() => setHistoryFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="panel transaction-panel">
                {historyItems.length ? (
                  historyItems
                    .slice(0, 5)
                    .map(item => (
                      <TransactionRow
                        key={item.id}
                        item={item}
                        onEdit={() => setEditItem(item)}
                        onDelete={() =>
                          setItems(current =>
                            current.filter(entry => entry.id !== item.id)
                          )
                        }
                      />
                    ))
                ) : (
                  <EmptyPanel
                    icon={<Receipt size={22} />}
                    title="Nenhum lançamento ainda"
                    body="Digite algo como “mercado 120” no chat ao lado."
                  />
                )}
              </div>
            </section>
            <ChatPanel
              messages={messages}
              input={chatInput}
              setInput={setChatInput}
              onSubmit={sendChat}
              open={chatOpen}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
        {view === "transactions" && (
          <TransactionsView
            items={items}
            search={search}
            onSearch={setSearch}
            onAdd={() => setAddOpen(true)}
            onEdit={setEditItem}
            onDelete={id =>
              setItems(current => current.filter(item => item.id !== id))
            }
          />
        )}
        {view === "tools" && (
          <ToolsView
            items={items}
            profile={profile}
            onAddItems={newItems =>
              setItems(current => [
                ...newItems.map(item => ({
                  ...item,
                  id: Date.now() + Math.random(),
                })),
                ...current,
              ])
            }
            onProfileChange={updateProfile}
            onImport={importData}
            onExport={exportData}
          />
        )}
        {view === "settings" && (
          <SettingsView
            profile={profile}
            onSave={(income, goal) =>
              setProfile(current => ({
                ...current,
                monthlyIncomeCents: income,
                savingsGoalCents: goal,
                incomeByMonth: {
                  ...(current.incomeByMonth || {}),
                  [currentMonthKey()]: income,
                },
              }))
            }
            onEditSavings={(name, amountCents) =>
              setSavingsEdit({ name, amountCents })
            }
          />
        )}
      </main>
      <button
        className="chat-fab"
        onClick={() => setChatOpen(true)}
        aria-label="Abrir copiloto financeiro"
      >
        <MessageCircle size={21} />
        <span>anotar gasto</span>
      </button>
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={updateItem}
        />
      )}{" "}
      {addOpen && (
        <AddItemModal onClose={() => setAddOpen(false)} onSave={addItem} />
      )}{" "}
      {savingsEdit && (
        <SavingsModal
          initial={savingsEdit}
          onClose={() => setSavingsEdit(null)}
          onSave={updateSavings}
        />
      )}{" "}
      {profileOpen && (
        <Modal title="Sua agenda" onClose={() => setProfileOpen(false)}>
          <div className="profile-modal">
            <div className="large-avatar">VC</div>
            <h3>Modo privado ativo</h3>
            <p>Seus lançamentos ficam somente neste celular.</p>
            <p className="local-mode-note">
              Não usamos login nem enviamos seus dados para outra pessoa.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {active && <span className="nav-active-dot" />}
    </button>
  );
}
function Metric({
  icon,
  label,
  value,
  accent,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  note: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${accent}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}
function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="empty-panel">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
function TransactionRow({
  item,
  onEdit,
  onDelete,
}: {
  item: Item;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const income = item.kind === "income";
  return (
    <div className="transaction-row">
      <div className={`transaction-icon ${income ? "income" : "expense"}`}>
        {income ? <ArrowUpRight size={16} /> : <Receipt size={16} />}
      </div>
      <div className="transaction-copy">
        <strong>{item.merchant || item.category}</strong>
        <span>
          {item.category} · {shortDate(item.entryDate)}
          {item.isPlanned ? " · previsto" : ""}
          {item.paymentMethod ? ` · ${item.paymentMethod}` : ""}
          {item.isFixed ? " · fixo" : ""}
        </span>
      </div>
      <strong className={`transaction-amount ${income ? "income-text" : ""}`}>
        {income ? "+" : "-"}
        {money(item.amountCents)}
      </strong>
      <button
        className="icon-button row-action"
        onClick={onEdit}
        aria-label="Editar lançamento"
      >
        <Edit3 size={15} />
      </button>
      <button
        className="icon-button row-action danger"
        onClick={onDelete}
        aria-label="Excluir lançamento"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
function ChatPanel({
  messages,
  input,
  setInput,
  onSubmit,
  open,
  onClose,
}: {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  open: boolean;
  onClose: () => void;
}) {
  const suggestions = [
    "Pix 10 shopping",
    "recebi 500",
    "desfazer",
    "salário 1654 dia 5",
    "quanto gastei esse mês?",
  ];
  return (
    <section className={`chat-panel ${open ? "chat-open" : ""}`}>
      <div className="chat-header">
        <div className="chat-title">
          <div className="chat-orb">
            <Sparkles size={17} />
          </div>
          <div>
            <strong>Seu copiloto financeiro</strong>
            <span>funciona sem sair do celular</span>
          </div>
        </div>
        <button
          className="chat-close"
          onClick={onClose}
          aria-label="Fechar copiloto"
        >
          <X size={17} />
        </button>
      </div>
      <div className="chat-body">
        {!messages.length ? (
          <div className="chat-welcome">
            <div className="welcome-mark">
              <MessageCircle size={24} />
            </div>
            <h3>Me conta, o que aconteceu?</h3>
            <p>
              Registre um gasto, uma receita ou pergunte sobre sua vida
              financeira.
            </p>
            <div className="suggestion-list">
              {suggestions.map(suggestion => (
                <button key={suggestion} onClick={() => setInput(suggestion)}>
                  {suggestion}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map(message => (
              <div
                className={`message-row ${message.role === "user" ? "user-message" : "assistant-message"}`}
                key={message.id}
              >
                <div className="message-avatar">
                  {message.role === "user" ? "VC" : <Sparkles size={13} />}
                </div>
                <div className="message-bubble">{message.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <form className="chat-composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="Ex.: mercado 120 no débito"
          rows={1}
        />
        <button type="submit" className="send-button" disabled={!input.trim()}>
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
function MonthStatus({
  message,
  positive,
}: {
  message: string;
  positive: boolean;
}) {
  return (
    <div className={`month-status ${positive ? "positive" : "negative"}`}>
      <div className="info-icon">
        {positive ? <Check size={17} /> : <CircleAlert size={17} />}
      </div>
      <div>
        <strong>{positive ? "Boa notícia" : "Atenção ao seu orçamento"}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
function TransactionsView({
  items,
  search,
  onSearch,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: Item[];
  search: string;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => void;
}) {
  const [filter, setFilter] = useState<
    "all" | "expenses" | "income" | "future"
  >("all");
  const todayValue = today();
  const visibleItems = items
    .filter(item =>
      `${item.merchant} ${item.category} ${item.paymentMethod || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .filter(item => {
      if (filter === "expenses") return item.kind !== "income";
      if (filter === "income") return item.kind === "income";
      if (filter === "future")
        return item.entryDate > todayValue || Boolean(item.isPlanned);
      return true;
    })
    .sort((a, b) => {
      const aFuture = a.entryDate > todayValue || Boolean(a.isPlanned);
      const bFuture = b.entryDate > todayValue || Boolean(b.isPlanned);
      if (filter === "all" && aFuture !== bFuture) return aFuture ? 1 : -1;
      return b.entryDate.localeCompare(a.entryDate) || b.id - a.id;
    });
  const filters = [
    ["all", "todos"],
    ["expenses", "despesas"],
    ["income", "receitas"],
    ["future", "futuros"],
  ] as const;
  return (
    <section className="full-page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Registro completo</p>
          <h2>
            {filter === "all"
              ? "Todos os lançamentos"
              : filter === "expenses"
                ? "Despesas"
                : filter === "income"
                  ? "Receitas"
                  : "Lançamentos futuros"}
          </h2>
        </div>
        <button onClick={onAdd} className="primary-button">
          <Plus size={17} /> adicionar
        </button>
      </div>
      <div className="filter-bar">
        <Receipt size={15} />
        <input
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Buscar por nome, categoria ou pagamento"
        />
      </div>
      <div className="transaction-filters" aria-label="Filtrar lançamentos">
        {filters.map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
            <span>
              {value === "all"
                ? items.length
                : value === "expenses"
                  ? items.filter(item => item.kind !== "income").length
                  : value === "income"
                    ? items.filter(item => item.kind === "income").length
                    : items.filter(
                        item =>
                          item.entryDate > todayValue || Boolean(item.isPlanned)
                      ).length}
            </span>
          </button>
        ))}
      </div>
      <div className="panel transaction-panel large-panel">
        {visibleItems.length ? (
          visibleItems.map(item => (
            <TransactionRow
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
            />
          ))
        ) : (
          <EmptyPanel
            icon={<Receipt size={22} />}
            title="Nenhum lançamento encontrado"
            body="Ajuste a busca ou registre um novo lançamento."
          />
        )}
      </div>
      <div className="info-strip">
        <div className="info-icon">
          <CircleDollarSign size={18} />
        </div>
        <div>
          <strong>Privacidade por padrão</strong>
          <p>
            Este aparelho guarda seus dados no navegador. Outra pessoa usando
            outro celular terá uma agenda separada.
          </p>
        </div>
      </div>
    </section>
  );
}
function ToolsView({
  items,
  profile,
  onAddItems,
  onProfileChange,
  onImport,
  onExport,
}: {
  items: Item[];
  profile: Profile;
  onAddItems: (items: Omit<Item, "id">[]) => void;
  onProfileChange: (patch: Partial<Profile>) => void;
  onImport: (data: {
    items?: Item[];
    messages?: Message[];
    profile?: Profile;
  }) => void;
  onExport: (format: "json" | "csv") => void;
}) {
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [budgetCategory, setBudgetCategory] = useState("Comida");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [scenario, setScenario] = useState("300");
  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardDue, setCardDue] = useState("");
  const [recurringName, setRecurringName] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringDay, setRecurringDay] = useState("");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [installmentName, setInstallmentName] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [installmentStart, setInstallmentStart] = useState(today());
  const [financeName, setFinanceName] = useState("");
  const [financeAmount, setFinanceAmount] = useState("");
  const [financeCount, setFinanceCount] = useState("");
  const [financeStart, setFinanceStart] = useState(today());
  const month = currentMonthKey();
  const expenses = items.filter(
    item => item.entryDate.slice(0, 7) === month && item.kind !== "income"
  );
  const totalExpenses = expenses.reduce(
    (sum, item) => sum + item.amountCents,
    0
  );
  const goals = profile.goals || [];
  const budgets = profile.budgets || [];
  const cards = profile.cards || [];
  const recurring = profile.recurring || [];
  const savings = Object.entries(profile.savingsAccounts || {});
  const saveGoal = (event: FormEvent) => {
    event.preventDefault();
    if (!goalName.trim() || !parseMoney(goalTarget)) return;
    onProfileChange({
      goals: [
        ...goals,
        {
          id: Date.now(),
          name: goalName.trim(),
          targetCents: parseMoney(goalTarget),
          savedCents: 0,
          dueDate: goalDate || undefined,
        },
      ],
    });
    setGoalName("");
    setGoalTarget("");
    setGoalDate("");
  };
  const saveBudget = (event: FormEvent) => {
    event.preventDefault();
    if (!parseMoney(budgetLimit)) return;
    onProfileChange({
      budgets: [
        ...budgets.filter(
          budget =>
            !(budget.category === budgetCategory && budget.month === month)
        ),
        {
          id: Date.now(),
          category: budgetCategory,
          limitCents: parseMoney(budgetLimit),
          month,
        },
      ],
    });
    setBudgetLimit("");
  };
  const saveCard = (event: FormEvent) => {
    event.preventDefault();
    if (!cardName.trim() || !parseMoney(cardLimit)) return;
    onProfileChange({
      cards: [
        ...cards,
        {
          id: Date.now(),
          name: cardName.trim(),
          limitCents: parseMoney(cardLimit),
          closingDay: 1,
          dueDay: Math.max(1, Number(cardDue) || 10),
        },
      ],
    });
    setCardName("");
    setCardLimit("");
    setCardDue("");
  };
  const saveRecurring = (event: FormEvent) => {
    event.preventDefault();
    if (!recurringName.trim() || !parseMoney(recurringAmount)) return;
    onProfileChange({
      recurring: [
        ...recurring,
        {
          id: Date.now(),
          name: recurringName.trim(),
          amountCents: parseMoney(recurringAmount),
          category: "Outros",
          dueDay: Math.max(1, Number(recurringDay) || 1),
        },
      ],
    });
    setRecurringName("");
    setRecurringAmount("");
    setRecurringDay("");
  };
  const transfer = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseMoney(transferAmount);
    const from = profile.savingsAccounts?.[transferFrom] || 0;
    if (
      !transferFrom ||
      !transferTo ||
      transferFrom === transferTo ||
      !amount ||
      amount > from
    )
      return;
    const accounts = { ...(profile.savingsAccounts || {}) };
    accounts[transferFrom] -= amount;
    accounts[transferTo] = (accounts[transferTo] || 0) + amount;
    onProfileChange({
      savingsAccounts: accounts,
      savingsEntries: [
        ...(profile.savingsEntries || []),
        {
          id: Date.now(),
          name: `${transferFrom} → ${transferTo}`,
          amountCents: 0,
          entryDate: today(),
        },
      ],
    });
    setTransferAmount("");
  };
  const generateSchedule = (
    name: string,
    amountCents: number,
    count: number,
    start: string,
    category: string,
    paymentMethod?: string
  ) =>
    Array.from({ length: count }, (_, index) => ({
      kind: "bill" as const,
      amountCents,
      merchant: `${name} · ${index + 1}/${count}`,
      category,
      entryDate: addMonths(start, index),
      isFixed: true,
      paymentMethod,
      isPlanned: addMonths(start, index) > today(),
    }));
  const saveInstallment = (event: FormEvent) => {
    event.preventDefault();
    const count = Math.max(1, Math.min(120, Number(installmentCount)));
    const total = parseMoney(installmentTotal);
    if (!installmentName.trim() || !count || !total || !installmentStart)
      return;
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    onAddItems(
      generateSchedule(
        installmentName.trim(),
        base,
        count,
        installmentStart,
        "Outros",
        "Crédito"
      ).map((item, index) => ({
        ...item,
        amountCents: index === count - 1 ? base + remainder : base,
      }))
    );
    setInstallmentName("");
    setInstallmentTotal("");
    setInstallmentCount("");
  };
  const saveFinance = (event: FormEvent) => {
    event.preventDefault();
    const count = Math.max(1, Math.min(360, Number(financeCount)));
    const amount = parseMoney(financeAmount);
    if (!financeName.trim() || !count || !amount || !financeStart) return;
    onAddItems(
      generateSchedule(
        financeName.trim(),
        amount,
        count,
        financeStart,
        "Moradia",
        "Financiamento"
      )
    );
    setFinanceName("");
    setFinanceAmount("");
    setFinanceCount("");
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(JSON.parse(String(reader.result)));
      } catch {
        window.alert("Não foi possível ler este backup.");
      }
    };
    reader.readAsText(file);
  };
  return (
    <section className="full-page tools-page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Controle sem complicação</p>
          <h2>Ferramentas financeiras</h2>
        </div>
        <button
          className="theme-button"
          onClick={() =>
            onProfileChange({
              theme: profile.theme === "dark" ? "light" : "dark",
            })
          }
        >
          {profile.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}{" "}
          {profile.theme === "dark" ? "modo claro" : "modo escuro"}
        </button>
      </div>
      <div className="tools-grid">
        <div className="panel tool-card tool-wide">
          <div className="tool-card-title">
            <Target size={18} />
            <div>
              <h3>Metas financeiras</h3>
              <p>Transforme planos em progresso visível.</p>
            </div>
          </div>
          <form className="compact-form" onSubmit={saveGoal}>
            <input
              value={goalName}
              onChange={event => setGoalName(event.target.value)}
              placeholder="Nome da meta"
            />
            <input
              value={goalTarget}
              onChange={event => setGoalTarget(event.target.value)}
              placeholder="Valor alvo (R$)"
              inputMode="decimal"
            />
            <input
              type="date"
              value={goalDate}
              onChange={event => setGoalDate(event.target.value)}
            />
            <button className="primary-button" type="submit">
              <Plus size={15} /> criar
            </button>
          </form>
          <div className="goal-list">
            {goals.length ? (
              goals.map(goal => (
                <div className="goal-row" key={goal.id}>
                  <div>
                    <strong>{goal.name}</strong>
                    <span>
                      {money(goal.savedCents)} de {money(goal.targetCents)}
                      {goal.dueDate ? ` · até ${dateLabel(goal.dueDate)}` : ""}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${Math.min(100, (goal.savedCents / goal.targetCents) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>
                    {Math.round(
                      Math.min(100, (goal.savedCents / goal.targetCents) * 100)
                    )}
                    %
                  </b>
                </div>
              ))
            ) : (
              <p className="empty-copy">
                Crie uma meta como “Reserva de emergência”.
              </p>
            )}
          </div>
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <BarChart3 size={18} />
            <div>
              <h3>Orçamento por categoria</h3>
              <p>Limites para o mês atual.</p>
            </div>
          </div>
          <form className="compact-form stacked" onSubmit={saveBudget}>
            <select
              value={budgetCategory}
              onChange={event => setBudgetCategory(event.target.value)}
            >
              {categories
                .filter(category => category !== "Outros")
                .map(category => (
                  <option key={category}>{category}</option>
                ))}
            </select>
            <input
              value={budgetLimit}
              onChange={event => setBudgetLimit(event.target.value)}
              placeholder="Limite mensal (R$)"
              inputMode="decimal"
            />
            <button className="primary-button" type="submit">
              salvar limite
            </button>
          </form>
          <div className="budget-list">
            {budgets
              .filter(budget => budget.month === month)
              .map(budget => {
                const used = expenses
                  .filter(item => item.category === budget.category)
                  .reduce((sum, item) => sum + item.amountCents, 0);
                return (
                  <div className="budget-row" key={budget.id}>
                    <span>{budget.category}</span>
                    <strong>
                      {money(used)} / {money(budget.limitCents)}
                    </strong>
                    <div className="progress-track">
                      <i
                        className={used > budget.limitCents ? "over" : ""}
                        style={{
                          width: `${Math.min(100, (used / budget.limitCents) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <CalendarDays size={18} />
            <div>
              <h3>Calendário financeiro</h3>
              <p>Próximos movimentos planejados.</p>
            </div>
          </div>
          <div className="calendar-list">
            {items
              .filter(item => item.entryDate >= today())
              .sort((a, b) => a.entryDate.localeCompare(b.entryDate))
              .slice(0, 5)
              .map(item => (
                <div key={item.id}>
                  <small>{dateLabel(item.entryDate)}</small>
                  <span>{item.merchant}</span>
                  <b>{money(item.amountCents)}</b>
                </div>
              ))}
            {!items.some(item => item.entryDate >= today()) && (
              <p className="empty-copy">
                Suas contas e receitas futuras aparecerão aqui.
              </p>
            )}
          </div>
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <CreditCard size={18} />
            <div>
              <h3>Cartões e recorrências</h3>
              <p>Planeje compromissos fixos e limites.</p>
            </div>
          </div>
          <form className="compact-form stacked" onSubmit={saveCard}>
            <input
              value={cardName}
              onChange={event => setCardName(event.target.value)}
              placeholder="Nome do cartão"
            />
            <input
              value={cardLimit}
              onChange={event => setCardLimit(event.target.value)}
              placeholder="Limite (R$)"
              inputMode="decimal"
            />
            <input
              value={cardDue}
              onChange={event => setCardDue(event.target.value)}
              placeholder="Dia do vencimento"
              inputMode="numeric"
            />
            <button className="primary-button" type="submit">
              adicionar cartão
            </button>
          </form>
          {cards.map(card => (
            <div className="mini-stat" key={card.id}>
              <span>
                {card.name} · vence dia {card.dueDay}
              </span>
              <strong>{money(card.limitCents)}</strong>
            </div>
          ))}
          <form className="compact-form stacked" onSubmit={saveRecurring}>
            <input
              value={recurringName}
              onChange={event => setRecurringName(event.target.value)}
              placeholder="Nome da cobrança recorrente"
            />
            <input
              value={recurringAmount}
              onChange={event => setRecurringAmount(event.target.value)}
              placeholder="Valor (R$)"
              inputMode="decimal"
            />
            <input
              value={recurringDay}
              onChange={event => setRecurringDay(event.target.value)}
              placeholder="Dia do mês"
              inputMode="numeric"
            />
            <button className="secondary-button" type="submit">
              adicionar recorrência
            </button>
          </form>
          {recurring.map(entry => (
            <div className="mini-stat" key={entry.id}>
              <span>
                {entry.name} · dia {entry.dueDay}
              </span>
              <strong>{money(entry.amountCents)}</strong>
            </div>
          ))}
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <WalletCards size={18} />
            <div>
              <h3>Transferir entre poupanças</h3>
              <p>
                Mova valores entre seus objetivos sem alterar o total reservado.
              </p>
            </div>
          </div>
          {savings.length > 1 ? (
            <form className="compact-form stacked" onSubmit={transfer}>
              <select
                value={transferFrom}
                onChange={event => setTransferFrom(event.target.value)}
              >
                <option value="">de qual poupança?</option>
                {savings.map(([name]) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <select
                value={transferTo}
                onChange={event => setTransferTo(event.target.value)}
              >
                <option value="">para qual poupança?</option>
                {savings.map(([name]) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <input
                value={transferAmount}
                onChange={event => setTransferAmount(event.target.value)}
                placeholder="Valor (R$)"
                inputMode="decimal"
              />
              <button className="primary-button" type="submit">
                transferir
              </button>
            </form>
          ) : (
            <p className="empty-copy">
              Crie pelo menos duas poupanças para transferir valores entre elas.
            </p>
          )}
        </div>
        <div className="panel tool-card tool-wide">
          <div className="tool-card-title">
            <Receipt size={18} />
            <div>
              <h3>Compra parcelada</h3>
              <p>
                Cadastre o presente ou compra do cartão e gere todas as
                parcelas.
              </p>
            </div>
          </div>
          <form className="compact-form" onSubmit={saveInstallment}>
            <input
              value={installmentName}
              onChange={event => setInstallmentName(event.target.value)}
              placeholder="Nome da compra"
            />
            <input
              value={installmentTotal}
              onChange={event => setInstallmentTotal(event.target.value)}
              placeholder="Valor total (R$)"
              inputMode="decimal"
            />
            <input
              value={installmentCount}
              onChange={event => setInstallmentCount(event.target.value)}
              placeholder="Nº de parcelas"
              inputMode="numeric"
            />
            <input
              type="date"
              value={installmentStart}
              onChange={event => setInstallmentStart(event.target.value)}
            />
            <button className="primary-button" type="submit">
              <Plus size={15} /> gerar parcelas
            </button>
          </form>
        </div>
        <div className="panel tool-card tool-wide">
          <div className="tool-card-title">
            <CreditCard size={18} />
            <div>
              <h3>Financiamento</h3>
              <p>
                Registre sua moto ou outro financiamento e projete as parcelas
                mensais.
              </p>
            </div>
          </div>
          <form className="compact-form" onSubmit={saveFinance}>
            <input
              value={financeName}
              onChange={event => setFinanceName(event.target.value)}
              placeholder="Nome do financiamento"
            />
            <input
              value={financeAmount}
              onChange={event => setFinanceAmount(event.target.value)}
              placeholder="Valor da parcela (R$)"
              inputMode="decimal"
            />
            <input
              value={financeCount}
              onChange={event => setFinanceCount(event.target.value)}
              placeholder="Nº de parcelas"
              inputMode="numeric"
            />
            <input
              type="date"
              value={financeStart}
              onChange={event => setFinanceStart(event.target.value)}
            />
            <button className="primary-button" type="submit">
              <Plus size={15} /> gerar financiamento
            </button>
          </form>
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <TrendingUp size={18} />
            <div>
              <h3>Relatório e simulador</h3>
              <p>Veja o mês e teste novos hábitos.</p>
            </div>
          </div>
          <div className="report-total">
            <span>Despesas em {monthLabel()}</span>
            <strong>{money(totalExpenses)}</strong>
          </div>
          <label className="scenario-label">
            <span>Se guardar por mês</span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={scenario}
                onChange={event => setScenario(event.target.value)}
              />
            </div>
          </label>
          <p className="scenario-result">
            Em 12 meses: <strong>{money(parseMoney(scenario) * 12)}</strong>
          </p>
        </div>
        <div className="panel tool-card">
          <div className="tool-card-title">
            <Download size={18} />
            <div>
              <h3>Backup dos seus dados</h3>
              <p>Exporte ou restaure sua agenda local.</p>
            </div>
          </div>
          <div className="backup-actions">
            <button
              className="secondary-button"
              onClick={() => onExport("json")}
            >
              <Download size={14} /> JSON
            </button>
            <button
              className="secondary-button"
              onClick={() => onExport("csv")}
            >
              <Download size={14} /> CSV
            </button>
            <label className="secondary-button">
              <Upload size={14} /> importar
              <input
                type="file"
                accept="application/json"
                onChange={handleImport}
                hidden
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsView({
  profile,
  onSave,
  onEditSavings,
}: {
  profile: Profile;
  onSave: (income: number, goal: number) => void;
  onEditSavings: (name: string, amountCents: number) => void;
}) {
  const currentIncome = profile.incomeByMonth
    ? (profile.incomeByMonth[currentMonthKey()] ?? 0)
    : profile.monthlyIncomeCents;
  const [income, setIncome] = useState(
    (currentIncome / 100).toFixed(2).replace(".", ",")
  );
  const [goal, setGoal] = useState(
    (profile.savingsGoalCents / 100).toFixed(2).replace(".", ",")
  );
  const accounts = Object.entries(profile.savingsAccounts || {});
  return (
    <section className="full-page settings-page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow">Seu espaço financeiro</p>
          <h2>Configurações simples</h2>
        </div>
      </div>
      <div className="settings-grid">
        <form
          className="panel settings-card"
          onSubmit={event => {
            event.preventDefault();
            onSave(parseMoney(income), parseMoney(goal));
          }}
        >
          <div className="settings-card-title">
            <div className="metric-icon green">
              <WalletCards size={18} />
            </div>
            <div>
              <h3>Renda prevista deste mês</h3>
              <p>
                Você pode alterar este valor a cada mês. Um mês não altera o
                outro.
              </p>
            </div>
          </div>
          <label>
            <span>Renda de {monthLabel()}</span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={income}
                onChange={event => setIncome(event.target.value)}
                placeholder="0,00"
              />
            </div>
          </label>
          <label>
            <span>
              Meta de economia mensal <small>(opcional)</small>
            </span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={goal}
                onChange={event => setGoal(event.target.value)}
                placeholder="0,00"
              />
            </div>
          </label>
          <button type="submit" className="primary-button">
            <Check size={16} /> salvar informações
          </button>
        </form>
        <div className="panel settings-card">
          <div className="settings-card-title">
            <div className="metric-icon purple">
              <CreditCard size={18} />
            </div>
            <div>
              <h3>Armazenamento</h3>
              <p>Sem login, sem nuvem e sem compartilhamento.</p>
            </div>
          </div>
          <div className="method-placeholder">
            <CreditCard size={17} />
            <span>
              Use “Pix 10 shopping”, “crédito 34 restaurante” ou “25 dinheiro
              gasolina”. O chat identifica a forma de pagamento e a categoria.
            </span>
          </div>
          <div className="savings-list">
            <strong>Suas poupanças</strong>
            {accounts.length ? (
              accounts.map(([name, amount]) => (
                <div className="savings-row" key={name}>
                  <span>{name}</span>
                  <strong>{money(amount)}</strong>
                  <button
                    className="icon-button"
                    onClick={() => onEditSavings(name, amount)}
                    aria-label={`Editar ${name}`}
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <span className="savings-empty">
                Registre “poupança viagem 100” no chat para começar.
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Próximos passos</p>
          <h2>Ferramentas que podem entrar no Bolso Claro</h2>
        </div>
      </div>
      <div className="tool-ideas">
        <ToolIdea
          title="Metas com prazo"
          body="Acompanhar quanto falta e sugerir um valor mensal para cada objetivo."
        />
        <ToolIdea
          title="Contas recorrentes"
          body="Avisos antes do vencimento e repetição automática de despesas fixas."
        />
        <ToolIdea
          title="Relatório mensal"
          body="Comparar meses, categorias e evolução da sua reserva em gráficos simples."
        />
        <ToolIdea
          title="Exportação e backup"
          body="Baixar seus dados em CSV ou JSON para guardar uma cópia segura."
        />
      </div>
    </section>
  );
}
function ToolIdea({ title, body }: { title: string; body: string }) {
  return (
    <div className="tool-idea">
      <Sparkles size={15} />
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}
function SavingsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: { name: string; amountCents: number };
  onClose: () => void;
  onSave: (
    name: string,
    initialCents: number,
    savedCents: number,
    withdrawnCents: number,
    nextName: string
  ) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [current, setCurrent] = useState(
    (initial.amountCents / 100).toFixed(2).replace(".", ",")
  );
  const [saved, setSaved] = useState("");
  const [withdrawn, setWithdrawn] = useState("");
  const initialCents = parseMoney(current);
  const savedCents = parseMoney(saved);
  const withdrawnCents = parseMoney(withdrawn);
  const finalCents = initialCents + savedCents - withdrawnCents;
  const invalid = !name.trim() || finalCents < 0;
  return (
    <Modal title="Editar poupança" onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={event => {
          event.preventDefault();
          if (!invalid)
            onSave(
              initial.name,
              initialCents,
              savedCents,
              withdrawnCents,
              name
            );
        }}
      >
        <p className="form-hint">
          Atualize o saldo e registre o movimento que você vai fazer agora.
        </p>
        <label>
          <span>Nome da poupança</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Ex.: Viagem"
            required
          />
        </label>
        <label>
          <span>O que você já tem</span>
          <div className="input-with-prefix">
            <small>R$</small>
            <input
              value={current}
              onChange={event => setCurrent(event.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
        </label>
        <div className="form-row">
          <label>
            <span>Vou guardar</span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={saved}
                onChange={event => setSaved(event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </label>
          <label>
            <span>Vou sacar</span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={withdrawn}
                onChange={event => setWithdrawn(event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </label>
        </div>
        <div className={`savings-preview ${invalid ? "invalid" : ""}`}>
          <span>Novo saldo</span>
          <strong>{money(finalCents)}</strong>
          {invalid && (
            <small>O saque não pode ser maior que o saldo disponível.</small>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            cancelar
          </button>
          <button type="submit" className="primary-button" disabled={invalid}>
            <Check size={16} /> salvar poupança
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: Item;
  onClose: () => void;
  onSave: (item: Omit<Item, "id">) => void;
}) {
  return (
    <ItemForm
      title="Editar lançamento"
      initial={item}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
function AddItemModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (item: Omit<Item, "id">) => void;
}) {
  return (
    <ItemForm
      title="Novo lançamento"
      initial={{
        kind: "expense",
        amountCents: 0,
        merchant: "",
        category: "Outros",
        entryDate: today(),
        isFixed: false,
        paymentMethod: undefined,
        isPlanned: false,
      }}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
function ItemForm({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: Omit<Item, "id">;
  onClose: () => void;
  onSave: (item: Omit<Item, "id">) => void;
}) {
  const [item, setItem] = useState(initial);
  const [amount, setAmount] = useState(
    initial.amountCents
      ? (initial.amountCents / 100).toFixed(2).replace(".", ",")
      : ""
  );
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={event => {
          event.preventDefault();
          if (!item.merchant.trim() || !parseMoney(amount)) return;
          onSave({
            ...item,
            amountCents: parseMoney(amount),
            isPlanned:
              item.isPlanned ||
              item.entryDate > today() ||
              item.kind === "bill",
          });
        }}
      >
        <div className="segmented-control">
          {(
            [
              ["expense", "Despesa"],
              ["income", "Receita"],
              ["bill", "Conta"],
            ] as [Kind, string][]
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={item.kind === value ? "selected" : ""}
              onClick={() => setItem({ ...item, kind: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <span>Nome</span>
          <input
            value={item.merchant}
            onChange={event =>
              setItem({ ...item, merchant: event.target.value })
            }
            placeholder="Ex.: Mercado"
            required
          />
        </label>
        <label>
          <span>Categoria</span>
          <select
            value={item.category}
            onChange={event =>
              setItem({ ...item, category: event.target.value })
            }
          >
            {categories.map(category => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Forma de pagamento</span>
          <select
            value={item.paymentMethod || ""}
            onChange={event =>
              setItem({
                ...item,
                paymentMethod: event.target.value || undefined,
              })
            }
          >
            <option value="">Não informado</option>
            {paymentMethods.map(method => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            <span>Valor</span>
            <div className="input-with-prefix">
              <small>R$</small>
              <input
                value={amount}
                onChange={event => setAmount(event.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </label>
          <label>
            <span>Data</span>
            <input
              type="date"
              value={item.entryDate}
              onChange={event =>
                setItem({ ...item, entryDate: event.target.value })
              }
              required
            />
          </label>
        </div>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={item.isFixed}
            onChange={event =>
              setItem({ ...item, isFixed: event.target.checked })
            }
          />
          <span>É fixo ou recorrente</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>
            cancelar
          </button>
          <button type="submit" className="primary-button">
            salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
