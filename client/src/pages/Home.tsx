import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Edit3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Receipt,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const categoryColors: Record<string, string> = {
  Lazer: "#C9A06A",
  "Farmácia": "#8E7BB5",
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

function money(cents = 0) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shortDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", " ");
}

function initials(name?: string | null) {
  return (name || "Você").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

type View = "overview" | "transactions" | "settings";

type EditItem = {
  id: number;
  merchant: string;
  category: string;
  amountCents: number;
  entryDate: string;
  isFixed: boolean;
};

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState<View>("overview");
  const [chatInput, setChatInput] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const dashboard = trpc.finance.dashboard.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: false });
  const chat = trpc.finance.chat.history.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: false });
  const sendChat = trpc.finance.chat.send.useMutation({
    onSuccess: async () => {
      setChatInput("");
      await Promise.all([chat.refetch(), dashboard.refetch()]);
    },
    onError: error => toast.error(error.message || "Não consegui processar essa mensagem."),
  });
  const updateItem = trpc.finance.items.update.useMutation({
    onSuccess: async () => {
      setEditItem(null);
      toast.success("Lançamento atualizado.");
      await dashboard.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const deleteItem = trpc.finance.items.remove.useMutation({
    onSuccess: async () => {
      toast.success("Lançamento removido.");
      await dashboard.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const createItem = trpc.finance.items.create.useMutation({
    onSuccess: async () => {
      setShowAdd(false);
      toast.success("Lançamento adicionado.");
      await dashboard.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const updateProfile = trpc.finance.profile.update.useMutation({
    onSuccess: async () => {
      setShowProfile(false);
      toast.success("Perfil financeiro atualizado.");
      await dashboard.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const monthLabel = useMemo(() => {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;

  const data = dashboard.data;
  const name = user.name?.split(" ")[0] || "você";
  const totalSpent = data?.totals.expense ?? 0;
  const categoryMax = Math.max(...(data?.categories.map(category => Number(category.total)) || [1]), 1);

  function handleChatSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || sendChat.isPending) return;
    sendChat.mutate({ text: trimmed });
  }

  function navigate(nextView: View) {
    setView(nextView);
    setShowMobileMenu(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <img src="/bolso-claro-logo.svg" alt="" className="brand-mark" />
          <div>
            <p className="brand-name">Bolso Claro</p>
            <p className="brand-caption">agenda financeira</p>
          </div>
          <button className="mobile-close" onClick={() => setShowMobileMenu(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          <NavButton active={view === "overview"} icon={<LayoutDashboard size={18} />} label="Visão geral" onClick={() => navigate("overview")} />
          <NavButton active={view === "transactions"} icon={<Receipt size={18} />} label="Lançamentos" onClick={() => navigate("transactions")} />
          <NavButton active={view === "settings"} icon={<Settings2 size={18} />} label="Configurações" onClick={() => navigate("settings")} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Sparkles size={16} /></div>
          <p><strong>Dica rápida</strong><br />Escreva no chat do jeito que você fala. Eu organizo para você.</p>
        </div>
        <div className="sidebar-profile">
          <div className="avatar">{initials(user.name)}</div>
          <div className="profile-copy"><strong>{user.name || "Minha conta"}</strong><span>{user.email || "Conta pessoal"}</span></div>
          <button className="icon-button subtle" onClick={() => void logout()} aria-label="Sair"><LogOut size={16} /></button>
        </div>
      </aside>

      {showMobileMenu && <button className="mobile-overlay" onClick={() => setShowMobileMenu(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button" onClick={() => setShowMobileMenu(true)} aria-label="Abrir menu"><Menu size={20} /></button>
            <div><p className="eyebrow">{monthLabel}</p><h1>{view === "overview" ? `Bom dia, ${name}` : view === "transactions" ? "Seus lançamentos" : "Seu espaço financeiro"}</h1></div>
          </div>
          <div className="topbar-actions"><button className="notification-button" aria-label="Notificações"><Bell size={18} /><span /></button><button className="top-avatar" onClick={() => setShowProfile(true)}>{initials(user.name)}</button></div>
        </header>

        {view === "overview" && (
          <div className="page-grid">
            <section className="content-column">
              <div className="balance-card">
                <div className="balance-card-top"><div><p className="card-kicker">Saldo previsto no mês</p><p className="balance-value">{money(data?.totals.balance ?? 0)}</p></div><div className="balance-badge"><TrendingUp size={14} /> sob controle</div></div>
                <div className="balance-rule" />
                <div className="balance-footer"><span><ArrowUpRight size={14} /> receitas <strong>{money(data?.totals.income ?? 0)}</strong></span><span><ArrowDownLeft size={14} /> despesas <strong>{money(totalSpent)}</strong></span></div>
              </div>

              <div className="metrics-grid">
                <Metric icon={<ArrowUpRight size={17} />} label="Receitas" value={money(data?.totals.income ?? 0)} accent="green" note="neste mês" />
                <Metric icon={<ArrowDownLeft size={17} />} label="Despesas" value={money(totalSpent)} accent="orange" note="neste mês" />
                <Metric icon={<Receipt size={17} />} label="Gastos fixos" value={money(data?.totals.fixed ?? 0)} accent="purple" note="compromissos" />
              </div>

              <div className="section-heading"><div><p className="eyebrow">Visão do mês</p><h2>Para onde vai seu dinheiro</h2></div><button className="text-button" onClick={() => navigate("transactions")}>ver lançamentos <ChevronRight size={15} /></button></div>
              <div className="panel category-panel">
                {data?.categories.length ? data.categories.map(category => {
                  const total = Number(category.total);
                  return <div className="category-row" key={category.category}><div className="category-meta"><span className="category-dot" style={{ backgroundColor: categoryColors[category.category] || categoryColors.Outros }} /><span>{category.category}</span><strong>{money(total)}</strong></div><div className="category-track"><span style={{ width: `${Math.max(8, (total / categoryMax) * 100)}%`, backgroundColor: categoryColors[category.category] || categoryColors.Outros }} /></div></div>;
                }) : <EmptyPanel icon={<BarChart3 size={22} />} title="Seu mapa financeiro começa aqui" body="Registre um gasto no chat e suas categorias aparecem neste espaço." />}
              </div>

              <div className="section-heading compact-heading"><div><p className="eyebrow">Histórico</p><h2>Últimos lançamentos</h2></div><button className="icon-button" onClick={() => setShowAdd(true)} aria-label="Adicionar lançamento"><Plus size={18} /></button></div>
              <div className="panel transaction-panel">{data?.latest.length ? data.latest.slice(0, 5).map(item => <TransactionRow key={item.id} item={item} onEdit={() => setEditItem({ id: item.id, merchant: item.merchant || "", category: item.category, amountCents: item.amountCents, entryDate: item.entryDate, isFixed: item.isFixed })} onDelete={() => deleteItem.mutate({ id: item.id })} />) : <EmptyPanel icon={<Receipt size={22} />} title="Nenhum lançamento ainda" body="Digite algo como “mercado 120” no chat ao lado." />}</div>
            </section>
            <ChatPanel messages={chat.data || []} input={chatInput} setInput={setChatInput} onSubmit={handleChatSubmit} isPending={sendChat.isPending} />
          </div>
        )}

        {view === "transactions" && <TransactionsView items={data?.latest || []} onAdd={() => setShowAdd(true)} onEdit={item => setEditItem({ id: item.id, merchant: item.merchant || "", category: item.category, amountCents: item.amountCents, entryDate: item.entryDate, isFixed: item.isFixed })} onDelete={id => deleteItem.mutate({ id })} />}
        {view === "settings" && <SettingsView profile={data?.profile} onSave={(monthlyIncomeCents, savingsGoalCents) => updateProfile.mutate({ monthlyIncomeCents, savingsGoalCents })} isSaving={updateProfile.isPending} />}
      </main>

      {editItem && <EditItemModal item={editItem} onClose={() => setEditItem(null)} onSave={changes => updateItem.mutate({ id: editItem.id, ...changes })} isSaving={updateItem.isPending} />}
      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSave={payload => createItem.mutate(payload)} isSaving={createItem.isPending} />}
      {showProfile && <ProfileModal name={user.name || "Você"} email={user.email || ""} onClose={() => setShowProfile(false)} onLogout={() => void logout()} />}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <span className="nav-active-dot" />}</button>;
}

function Metric({ icon, label, value, accent, note }: { icon: React.ReactNode; label: string; value: string; accent: string; note: string }) {
  return <div className="metric-card"><div className={`metric-icon ${accent}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><span>{note}</span></div></div>;
}

function EmptyPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="empty-panel"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{body}</p></div>;
}

function TransactionRow({ item, onEdit, onDelete }: { item: any; onEdit: () => void; onDelete: () => void }) {
  const isIncome = item.kind === "income";
  return <div className="transaction-row"><div className={`transaction-icon ${isIncome ? "income" : "expense"}`}>{isIncome ? <ArrowUpRight size={16} /> : <Receipt size={16} />}</div><div className="transaction-copy"><strong>{item.merchant || item.category}</strong><span>{item.category} · {shortDate(item.entryDate)}{item.isFixed ? " · fixo" : ""}</span></div><strong className={`transaction-amount ${isIncome ? "income-text" : ""}`}>{isIncome ? "+" : "-"}{money(item.amountCents)}</strong><button className="icon-button row-action" onClick={onEdit} aria-label="Editar lançamento"><Edit3 size={15} /></button><button className="icon-button row-action danger" onClick={onDelete} aria-label="Excluir lançamento"><Trash2 size={15} /></button></div>;
}

function ChatPanel({ messages, input, setInput, onSubmit, isPending }: { messages: any[]; input: string; setInput: (value: string) => void; onSubmit: (event: FormEvent) => void; isPending: boolean }) {
  const hasMessages = messages.length > 0;
  const suggestions = ["shopping 10", "recebi 2500 salário", "quanto gastei esse mês?"];
  return <section className="chat-panel"><div className="chat-header"><div className="chat-title"><div className="chat-orb"><Sparkles size={17} /></div><div><strong>Seu copiloto financeiro</strong><span>entende o jeito que você fala</span></div></div><button className="icon-button subtle"><MoreHorizontal size={18} /></button></div><div className="chat-body">{!hasMessages && <div className="chat-welcome"><div className="welcome-mark"><MessageCircle size={24} /></div><h3>Me conta, o que aconteceu?</h3><p>Registre um gasto, uma receita ou pergunte sobre sua vida financeira.</p><div className="suggestion-list">{suggestions.map(suggestion => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}<ChevronRight size={14} /></button>)}</div></div>}{hasMessages && <div className="message-list">{messages.map(message => <div className={`message-row ${message.role === "user" ? "user-message" : "assistant-message"}`} key={message.id}><div className="message-avatar">{message.role === "user" ? "Você" : <Sparkles size={13} />}</div><div className="message-bubble">{message.content}</div></div>)}{isPending && <div className="message-row assistant-message"><div className="message-avatar"><Sparkles size={13} /></div><div className="message-bubble typing"><span /><span /><span /></div></div>}</div>}</div><form className="chat-composer" onSubmit={onSubmit}><Textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Ex.: mercado 120 no débito" rows={1} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(event); } }} /><Button type="submit" size="icon" disabled={!input.trim() || isPending} className="send-button">{isPending ? <Loader2 size={17} className="spin" /> : <Send size={17} />}</Button></form></section>;
}

function TransactionsView({ items, onAdd, onEdit, onDelete }: { items: any[]; onAdd: () => void; onEdit: (item: any) => void; onDelete: (id: number) => void }) {
  return <section className="full-page"><div className="section-heading page-heading"><div><p className="eyebrow">Registro completo</p><h2>Todos os lançamentos recentes</h2></div><Button onClick={onAdd} className="primary-button"><Plus size={17} /> adicionar</Button></div><div className="panel transaction-panel large-panel">{items.length ? items.map(item => <TransactionRow key={item.id} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />) : <EmptyPanel icon={<Receipt size={22} />} title="Sua lista está vazia" body="Use o chat ou adicione seu primeiro lançamento." />}</div><div className="info-strip"><div className="info-icon"><CircleDollarSign size={18} /></div><div><strong>Uma rotina simples funciona melhor</strong><p>Não precisa esperar o fechamento do mês. Anote no momento em que acontecer e deixe o Bolso Claro cuidar da organização.</p></div></div></section>;
}

function SettingsView({ profile, onSave, isSaving }: { profile?: any; onSave: (income: number, goal: number) => void; isSaving: boolean }) {
  const [income, setIncome] = useState(((profile?.monthlyIncomeCents || 0) / 100).toFixed(2).replace(".", ","));
  const [goal, setGoal] = useState(((profile?.savingsGoalCents || 0) / 100).toFixed(2).replace(".", ","));
  const [cardName, setCardName] = useState("");
  function parse(value: string) { return Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100) || 0; }
  return <section className="full-page settings-page"><div className="section-heading page-heading"><div><p className="eyebrow">Seu espaço financeiro</p><h2>Configurações simples, sem complicação</h2></div></div><div className="settings-grid"><form className="panel settings-card" onSubmit={event => { event.preventDefault(); onSave(parse(income), parse(goal)); }}><div className="settings-card-title"><div className="metric-icon green"><WalletCards size={18} /></div><div><h3>Seu ponto de partida</h3><p>Esses valores ajudam a calcular seu saldo previsto.</p></div></div><label><span>Renda mensal</span><div className="input-with-prefix"><small>R$</small><Input value={income} onChange={event => setIncome(event.target.value)} placeholder="0,00" /></div></label><label><span>Meta de economia mensal</span><div className="input-with-prefix"><small>R$</small><Input value={goal} onChange={event => setGoal(event.target.value)} placeholder="0,00" /></div></label><Button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} salvar informações</Button></form><div className="panel settings-card"><div className="settings-card-title"><div className="metric-icon purple"><CreditCard size={18} /></div><div><h3>Meios de pagamento</h3><p>Deixe seus lançamentos mais fáceis de entender.</p></div></div><div className="method-placeholder"><CreditCard size={17} /><span>Você pode indicar “no cartão”, “Pix” ou “dinheiro” direto no chat.</span></div><label><span>Adicionar um cartão ou conta</span><div className="inline-form"><Input value={cardName} onChange={event => setCardName(event.target.value)} placeholder="Ex.: Nubank" /><Button type="button" variant="outline" onClick={() => { if (cardName.trim()) { setCardName(""); toast.success("Meio de pagamento salvo para a próxima versão."); } }}>adicionar</Button></div></label></div></div></section>;
}

function EditItemModal({ item, onClose, onSave, isSaving }: { item: EditItem; onClose: () => void; onSave: (changes: { merchant: string; category: string; amountCents: number; entryDate: string; isFixed: boolean }) => void; isSaving: boolean }) {
  const [merchant, setMerchant] = useState(item.merchant);
  const [category, setCategory] = useState(item.category);
  const [amount, setAmount] = useState((item.amountCents / 100).toFixed(2).replace(".", ","));
  const [date, setDate] = useState(item.entryDate);
  const [fixed, setFixed] = useState(item.isFixed);
  function submit(event: FormEvent) { event.preventDefault(); onSave({ merchant, category, amountCents: Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100), entryDate: date, isFixed: fixed }); }
  return <Modal title="Editar lançamento" onClose={onClose}><form className="modal-form" onSubmit={submit}><label><span>Estabelecimento</span><Input value={merchant} onChange={event => setMerchant(event.target.value)} /></label><label><span>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}>{Object.keys(categoryColors).map(option => <option key={option}>{option}</option>)}</select></label><div className="form-row"><label><span>Valor</span><div className="input-with-prefix"><small>R$</small><Input value={amount} onChange={event => setAmount(event.target.value)} /></div></label><label><span>Data</span><Input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div><label className="checkbox-line"><input type="checkbox" checked={fixed} onChange={event => setFixed(event.target.checked)} /><span>É um gasto fixo</span></label><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>cancelar</Button><Button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "salvando" : "salvar alterações"}</Button></div></form></Modal>;
}

function AddItemModal({ onClose, onSave, isSaving }: { onClose: () => void; onSave: (payload: { kind: "income" | "expense" | "bill"; amountCents: number; merchant?: string; category: string; entryDate: string; dueDate?: string | null; paymentMethod?: string | null; note?: string | null; isFixed: boolean }) => void; isSaving: boolean }) {
  const [kind, setKind] = useState<"income" | "expense" | "bill">("expense");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Outros");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fixed, setFixed] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); onSave({ kind, merchant, category, amountCents: Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100), entryDate: date, isFixed: fixed }); }
  return <Modal title="Novo lançamento" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="segmented-control">{([["expense", "Despesa"], ["income", "Receita"], ["bill", "Conta"]] as const).map(([value, label]) => <button type="button" key={value} className={kind === value ? "selected" : ""} onClick={() => setKind(value)}>{label}</button>)}</div><label><span>Nome</span><Input value={merchant} onChange={event => setMerchant(event.target.value)} placeholder="Ex.: Mercado" required /></label><label><span>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}>{Object.keys(categoryColors).map(option => <option key={option}>{option}</option>)}</select></label><div className="form-row"><label><span>Valor</span><div className="input-with-prefix"><small>R$</small><Input value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" required /></div></label><label><span>Data</span><Input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label></div><label className="checkbox-line"><input type="checkbox" checked={fixed} onChange={event => setFixed(event.target.checked)} /><span>É fixo ou recorrente</span></label><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>cancelar</Button><Button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? "salvando" : "adicionar"}</Button></div></form></Modal>;
}

function ProfileModal({ name, email, onClose, onLogout }: { name: string; email: string; onClose: () => void; onLogout: () => void }) {
  return <Modal title="Sua conta" onClose={onClose}><div className="profile-modal"><div className="large-avatar">{initials(name)}</div><h3>{name}</h3><p>{email}</p><Button variant="outline" onClick={onLogout}><LogOut size={16} /> sair da conta</Button></div></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>{children}</div></div>;
}

function LoadingScreen() { return <div className="center-screen"><Loader2 className="spin" size={28} /><span>abrindo seu espaço financeiro…</span></div>; }
function LoginScreen() { return <div className="login-screen"><div className="login-card"><img src="/bolso-claro-logo.svg" alt="Bolso Claro" className="login-logo" /><p className="eyebrow">sua agenda financeira</p><h1>Entenda seu dinheiro<br /><em>sem complicar.</em></h1><p className="login-copy">Registre seus gastos do jeito que você fala e veja tudo tomar forma.</p><Button onClick={() => startLogin()} className="primary-button login-button">entrar na minha agenda <ChevronRight size={17} /></Button><p className="login-footnote">Acesso seguro pela sua conta Manus.</p></div><div className="login-decoration"><div className="deco-card deco-one"><span>saldo previsto</span><strong>R$ 3.240,00</strong></div><div className="deco-card deco-two"><span>gasto em comida</span><strong>R$ 487,20</strong><small>este mês</small></div></div></div>; }
