import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '@iconify/react';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Clock3, Coins, Copy, FileText, Goal, LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, Settings2, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import { formatPEN, progressPercent } from './core/treasury';
import { INITIAL_CASH_CENTS } from './demo/fixtures';
import { supabase } from './utils/supabase';
import './landing.css';
import './mascot.css';
import './admin.css';
import './interactions.css';
import './dashboard-visuals.css';
import './admin-navigation.css';
import './invite.css';
import './responsive-fixes.css';
import './member-controls.css';
import './member-approve.css';
import './contributions.css';
import './group-onboarding.css';
import './operational-ledger.css';

type Tab = 'inicio'|'compañeros'|'detalle-aportes'|'abonos'|'calendario'|'caja'|'reportes'|'meta'|'configuracion'|'misaportes';
type Role = 'treasurer'|'delegate'|'member';
type Student = { participant_id: string; full_name: string; avatar_url: string|null };
type GroupMember = Student & { phone:string|null; linked_user_id:string|null; linked_email:string|null; total_cents:number; last_payment_on:string|null };
type LinkableAccount = { user_id:string; full_name:string; email:string; status:'active'|'pending' };
type CashMovement = { id:string; movement_type:'opening'|'contribution'|'expense'|'adjustment_in'|'adjustment_out'; amount_cents:number; reason:string; occurred_on:string };
type ContributionHistory = { contribution_id:string; received_on:string; amount_cents:number; note:string|null; due_date:string; applied_cents:number };
const INITIAL_SUPERADMIN_EMAIL = 'arielxdo163@gmail.com';
const modules: {key: Tab; label: string; icon: typeof LayoutDashboard}[] = [
  { key:'inicio',label:'Resumen',icon:LayoutDashboard },
  { key:'compañeros',label:'Compañeros',icon:Users },
  { key:'abonos',label:'Registrar aporte',icon:Coins },
  { key:'calendario',label:'Semanas',icon:CalendarDays },
  { key:'caja',label:'Movimientos de caja',icon:Wallet },
  { key:'reportes',label:'Reportes',icon:FileText },
  { key:'meta',label:'Meta anual',icon:Goal },
  { key:'configuracion',label:'Administración',icon:Settings2 }
];
const money = (n:number) => formatPEN(n);
const formatDate = (value:string) => {
  const [year,month,day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(year, month - 1, day));
};
const plusDays = (value:string, days:number) => {
  const [year,month,day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
export default function App() {
  const [role,setRole] = useState<Role>('treasurer');
  const [user,setUser] = useState<User|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authError,setAuthError] = useState<string|null>(null);
  const [accessLoading,setAccessLoading] = useState(false);
  const [accessRole,setAccessRole] = useState<Role|null>(null);
  const [accessMessage,setAccessMessage] = useState<string|null>(null);
  const [groupId,setGroupId] = useState<string|null>(null);
  const [groupCode,setGroupCode] = useState<string|null>(null);
  const [groupName,setGroupName] = useState('Mi salón');
  const [firstFriday,setFirstFriday] = useState('2026-11-06');
  const [weeklyDueCents,setWeeklyDueCents] = useState(500);
  const [requireApproval,setRequireApproval] = useState(false);
  const [joinPolicySaving,setJoinPolicySaving] = useState(false);
  const [joinPolicyMessage,setJoinPolicyMessage] = useState<string|null>(null);
  const [groupMembers,setGroupMembers] = useState<GroupMember[]>([]);
  const [linkableAccounts,setLinkableAccounts] = useState<LinkableAccount[]>([]);
  const [participantName,setParticipantName] = useState('');
  const [participantPhone,setParticipantPhone] = useState('');
  const [participantSaving,setParticipantSaving] = useState(false);
  const [participantMessage,setParticipantMessage] = useState<string|null>(null);
  const [selectedMember,setSelectedMember] = useState<GroupMember|null>(null);
  const [contributionHistory,setContributionHistory] = useState<ContributionHistory[]>([]);
  const [myContributionHistory,setMyContributionHistory] = useState<ContributionHistory[]>([]);
  const [historyLoading,setHistoryLoading] = useState(false);
  const [paymentDate,setPaymentDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [paymentNote,setPaymentNote] = useState('');
  const [paymentSaving,setPaymentSaving] = useState(false);
  const [paymentMessage,setPaymentMessage] = useState<string|null>(null);
  const [scheduleSaving,setScheduleSaving] = useState(false);
  const [scheduleMessage,setScheduleMessage] = useState<string|null>(null);
  const [inviteCopied,setInviteCopied] = useState(false);
  const [students,setStudents] = useState<Student[]>([]);
  const [selectedStudent,setSelectedStudent] = useState('');
  const [tab,setTab] = useState<Tab>('inicio');
  const [open,setOpen] = useState(false);
  const [goal,setGoal] = useState('');
  const [goalName,setGoalName] = useState('Fondo de fin de año');
  const [goalDate,setGoalDate] = useState('2026-12-31');
  const [goalSaved,setGoalSaved] = useState(false);
  const [goalMessage,setGoalMessage] = useState<string|null>(null);
  const [cashBalance,setCashBalance] = useState(INITIAL_CASH_CENTS);
  const [participantCount,setParticipantCount] = useState(0);
  const [paymentTotal,setPaymentTotal] = useState(0);
  const [cashMovements,setCashMovements] = useState<CashMovement[]>([]);
  const [cashType,setCashType] = useState<'expense'|'adjustment_in'|'adjustment_out'>('expense');
  const [cashAmount,setCashAmount] = useState('');
  const [cashReason,setCashReason] = useState('');
  const [cashDate,setCashDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [cashSaving,setCashSaving] = useState(false);
  const [cashMessage,setCashMessage] = useState<string|null>(null);
  const [amount,setAmount] = useState('10');
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError('No se pudo comprobar tu sesión. Inténtalo de nuevo.');
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function signInWithGoogle() {
    setAuthError(null);
    const redirectTo = new URL(window.location.href);
    redirectTo.hash = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) setAuthError('No se pudo iniciar sesión con Google. Revisa la configuración de Supabase.');
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError('No se pudo cerrar la sesión. Inténtalo otra vez.');
  }
  async function copyInviteLink() {
    if (!groupCode) return;
    const invite = new URL(window.location.href);
    invite.hash = '';
    invite.searchParams.set('grupo', groupCode);
    try {
      await navigator.clipboard.writeText(invite.toString());
      setInviteCopied(true);
    } catch {
      setAuthError('No pudimos copiar el enlace. Inténtalo desde un navegador con acceso al portapapeles.');
    }
  }
  async function saveGroupSchedule() {
    if (!groupId) return;
    const start = new Date(`${firstFriday}T12:00:00`);
    if (Number.isNaN(start.getTime()) || start.getDay() !== 5) {
      setScheduleMessage('Selecciona un viernes para iniciar el período.');
      return;
    }
    setScheduleMessage(null);
    setScheduleSaving(true);
    const { error } = await supabase.rpc('update_group_schedule', {
      p_group_id: groupId,
      p_first_friday: firstFriday,
      p_weekly_due_cents: weeklyDueCents,
    });
    setScheduleSaving(false);
    setScheduleMessage(error ? 'No pudimos guardar. Ejecuta la migración de configuración y vuelve a intentarlo.' : 'Período y cuota actualizados para el grupo.');
  }
  async function saveJoinPolicy(nextValue:boolean) {
    if (!groupId) return;
    setRequireApproval(nextValue);
    setJoinPolicySaving(true);
    setJoinPolicyMessage(null);
    const { error } = await supabase.rpc('update_group_join_policy', { p_group_id: groupId, p_require_approval: nextValue });
    setJoinPolicySaving(false);
    if (error) { setRequireApproval(!nextValue); setJoinPolicyMessage('No pudimos guardar la política de ingreso. Ejecuta la migración de controles de miembros.'); return; }
    setJoinPolicyMessage(nextValue ? 'Las nuevas solicitudes requerirán tu aprobación.' : 'Ingreso rápido activado: las invitaciones nuevas entrarán al grupo de inmediato.');
  }
  async function approveMember(memberId:string) {
    if (!groupId) return;
    const { error } = await supabase.rpc('approve_group_member', { p_group_id: groupId, p_user_id: memberId });
    if (!error) { setParticipantMessage('Cuenta aprobada. Ya puedes vincularla con una ficha del padrón.'); void loadLinkableAccounts(); }
  }
  async function recordContribution() {
    if (!groupId || !selectedStudent || amountCents < 1) { setPaymentMessage('Selecciona un integrante e ingresa un monto válido.'); return; }
    setPaymentSaving(true); setPaymentMessage(null);
    const { error } = await supabase.rpc('record_participant_contribution', { p_group_id:groupId, p_participant_id:selectedStudent, p_amount_cents:amountCents, p_received_on:paymentDate, p_note:paymentNote || null });
    setPaymentSaving(false);
    if (error) { setPaymentMessage('No se pudo registrar el aporte. Ejecuta la migración operativa y vuelve a intentarlo.'); return; }
    setPaymentMessage('Aporte registrado. El total y las semanas cubiertas ya se actualizaron.');
    setPaymentNote(''); void refreshFinancialSummary();
  }
  async function createParticipant() {
    if (!groupId || participantName.trim().length < 3) { setParticipantMessage('Ingresa el nombre completo del compañero.'); return; }
    setParticipantSaving(true); setParticipantMessage(null);
    const { error } = await supabase.rpc('create_group_participant', { p_group_id:groupId, p_full_name:participantName, p_phone:participantPhone || null, p_avatar_url:null });
    setParticipantSaving(false);
    if (error) { setParticipantMessage('No se pudo crear la ficha. Ejecuta la migración operativa y vuelve a intentarlo.'); return; }
    setParticipantName(''); setParticipantPhone(''); setParticipantMessage('Ficha creada. Ya puedes registrar sus aportes o vincular su cuenta cuando inicie sesión.');
    void loadParticipants(); void refreshFinancialSummary();
  }
  async function linkParticipant(participantId:string, accountId:string) {
    if (!groupId || !accountId) return;
    const { error } = await supabase.rpc('link_participant_account', { p_group_id:groupId, p_participant_id:participantId, p_user_id:accountId });
    setParticipantMessage(error ? 'No se pudo vincular la cuenta. Verifica que esté activa y no vinculada.' : 'Cuenta vinculada: ahora verá únicamente su propio historial.');
    if (!error) { void loadParticipants(); void loadLinkableAccounts(); }
  }
  async function saveGoal() {
    if (!groupId || Number(goal) <= 0) { setGoalMessage('Ingresa un monto objetivo válido.'); return; }
    const { error } = await supabase.rpc('save_group_goal', { p_group_id:groupId, p_name:goalName, p_target_cents:Math.round(Number(goal)*100), p_target_date:goalDate });
    if (error) { setGoalMessage('No se pudo guardar la meta. Ejecuta la migración operativa y vuelve a intentarlo.'); return; }
    setGoalSaved(true); setGoalMessage('Meta anual guardada para todo el grupo.');
  }
  async function saveCashMovement() {
    if (!groupId || !cashReason.trim() || Math.round(Number(cashAmount)*100) < 1) { setCashMessage('Indica un monto y el motivo del movimiento.'); return; }
    setCashSaving(true); setCashMessage(null);
    const { error } = await supabase.rpc('record_cash_movement', { p_group_id:groupId, p_movement_type:cashType, p_amount_cents:Math.round(Number(cashAmount)*100), p_reason:cashReason, p_occurred_on:cashDate });
    setCashSaving(false);
    if (error) { setCashMessage('No se pudo registrar el movimiento. Ejecuta la migración operativa y vuelve a intentarlo.'); return; }
    setCashAmount(''); setCashReason(''); setCashMessage('Movimiento registrado y visible para el grupo.');
    void refreshFinancialSummary(); void loadCashMovements();
  }
  async function refreshFinancialSummary() {
    if (!groupId) return;
    const { data } = await supabase.rpc('get_group_financial_summary', { p_group_id:groupId });
    const summary = (data?.[0] ?? null) as {balance_cents:number;participant_count:number;payment_total_cents:number}|null;
    if (summary) { setCashBalance(Number(summary.balance_cents)); setParticipantCount(Number(summary.participant_count)); setPaymentTotal(Number(summary.payment_total_cents)); }
  }
  async function loadParticipants() {
    if (!groupId) return;
    const { data, error } = await supabase.rpc('list_group_participants', { p_group_id:groupId });
    if (!error) setGroupMembers((data ?? []) as GroupMember[]);
  }
  async function loadLinkableAccounts() {
    if (!groupId) return;
    const { data, error } = await supabase.rpc('list_linkable_group_accounts', { p_group_id:groupId });
    if (!error) setLinkableAccounts((data ?? []) as LinkableAccount[]);
  }
  async function loadCashMovements() {
    if (!groupId) return;
    const { data, error } = await supabase.rpc('list_cash_movements', { p_group_id:groupId });
    if (!error) setCashMovements((data ?? []) as CashMovement[]);
  }
  useEffect(() => {
    let active = true;
    if (!user) { setAccessRole(null); setGroupId(null); setGroupCode(null); setGroupName('Mi salón'); setAccessMessage(null); return () => { active = false; }; }
    setAccessLoading(true);
    void supabase.from('group_members').select('group_id, role, status').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending:false }).limit(1).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setAccessMessage('El acceso todavía no está preparado. Un administrador debe completar la configuración inicial.');
      else if (data && ['treasurer','delegate','member'].includes(data.role)) { setAccessRole(data.role as Role); setRole(data.role as Role); setGroupId(data.group_id); }
      else setAccessMessage('Tu cuenta está pendiente de aprobación por la tesorería.');
      setAccessLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);
  async function bootstrapInitialAdmin() {
    setAccessMessage(null);
    setAccessLoading(true);
    const { data, error } = await supabase.rpc('bootstrap_ariel_superadmin');
    if (error) {
      setAccessMessage('No se pudo activar el administrador. Primero ejecuta la migración de Supabase y vuelve a intentarlo.');
      setAccessLoading(false);
      return;
    }
    setAccessRole('treasurer');
    setGroupId(data);
    setAccessMessage('Acceso activado: superadministrador y tesorero principal.');
    setAccessLoading(false);
  }
  async function requestGroupMembership(input:{groupCode:string;fullName:string;phone:string;avatarUrl:string|null}) {
    setAccessMessage(null);
    const { error } = await supabase.rpc('request_group_membership', {
      p_group_code: input.groupCode,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_avatar_url: input.avatarUrl,
    });
    if (error) { setAccessMessage('No pudimos enviar tu solicitud. Revisa el código de grupo e inténtalo otra vez.'); return; }
    const { data: membership } = await supabase.from('group_members').select('group_id, role, status').eq('user_id', user?.id ?? '').order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (membership?.status === 'active' && ['treasurer','delegate','member'].includes(membership.role)) {
      setAccessRole(membership.role as Role); setRole(membership.role as Role); setGroupId(membership.group_id);
      setAccessMessage('Ingreso confirmado. Ya puedes consultar la información del salón.');
    } else setAccessMessage('Solicitud enviada. El grupo revisará tu ingreso antes de mostrar información del salón.');
  }
  async function createGroup(input:{groupName:string;fullName:string;phone:string;firstFriday:string;weeklyDueCents:number;requireApproval:boolean;avatarUrl:string|null}) {
    setAccessMessage(null);
    const { data, error } = await supabase.rpc('create_group_as_treasurer', {
      p_group_name: input.groupName,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_first_friday: input.firstFriday,
      p_weekly_due_cents: input.weeklyDueCents,
      p_require_membership_approval: input.requireApproval,
      p_avatar_url: input.avatarUrl,
    });
    if (error || !data) { setAccessMessage('No pudimos crear tu grupo. Ejecuta la migración de creación de grupos y vuelve a intentarlo.'); return; }
    setAccessRole('treasurer'); setRole('treasurer'); setGroupId(data); setGroupName(input.groupName.trim());
    setAccessMessage('Grupo creado. Ya eres su tesorero principal.');
  }
  useEffect(() => {
    if (!groupId) return;
    void supabase.from('groups').select('name, join_code, first_friday, weekly_due_cents, require_membership_approval').eq('id', groupId).maybeSingle().then(({ data }) => {
      setGroupCode(data?.join_code ?? null);
      setGroupName(data?.name ?? 'Mi salón');
      if (data?.first_friday) setFirstFriday(data.first_friday);
      if (data?.weekly_due_cents) setWeeklyDueCents(data.weekly_due_cents);
      setRequireApproval(data?.require_membership_approval ?? false);
    });
  }, [groupId]);
  useEffect(() => {
    if (!groupId || tab !== 'abonos' || (accessRole !== 'treasurer' && accessRole !== 'delegate')) { setStudents([]); return; }
    void supabase.rpc('list_group_participants', { p_group_id: groupId }).then(({ data, error }) => {
      if (!error) setStudents((data ?? []) as Student[]);
    });
  }, [groupId, accessRole, tab]);
  useEffect(() => {
    if (!groupId || accessRole !== 'treasurer' || tab !== 'compañeros') { setGroupMembers([]); return; }
    void loadParticipants(); void loadLinkableAccounts();
  }, [groupId, accessRole, tab]);
  useEffect(() => {
    if (!groupId || !selectedMember || tab !== 'detalle-aportes') { setContributionHistory([]); return; }
    setHistoryLoading(true);
    void supabase.rpc('list_participant_contribution_history', { p_group_id: groupId, p_participant_id: selectedMember.participant_id }).then(({ data, error }) => {
      if (!error) setContributionHistory((data ?? []) as ContributionHistory[]);
      setHistoryLoading(false);
    });
  }, [groupId, selectedMember, tab]);
  useEffect(() => {
    if (!groupId || tab !== 'misaportes') { setMyContributionHistory([]); return; }
    void supabase.rpc('list_my_contribution_history', { p_group_id:groupId }).then(({ data, error }) => {
      if (!error) setMyContributionHistory((data ?? []) as ContributionHistory[]);
    });
  }, [groupId, tab]);
  useEffect(() => {
    if (!groupId) return;
    void refreshFinancialSummary();
    void supabase.from('group_goals').select('name,target_cents,target_date').eq('group_id',groupId).maybeSingle().then(({ data }) => {
      if (data) { setGoalName(data.name); setGoal((Number(data.target_cents)/100).toFixed(2)); setGoalDate(data.target_date); setGoalSaved(true); }
      else { setGoalSaved(false); setGoal(''); }
    });
  }, [groupId]);
  useEffect(() => { if (groupId && tab === 'caja') void loadCashMovements(); }, [groupId, tab]);
  const publicGoal = Number(goal)>0 ? Math.round(Number(goal)*100):null;
  const progress = publicGoal ? progressPercent(cashBalance,publicGoal) : null;
  const isAdmin = accessRole !== 'member';
  const nav = isAdmin?modules.filter(m => accessRole === 'treasurer'||(m.key !== 'configuracion' && m.key !== 'meta')):[{key:'inicio' as Tab,label:'Mi inicio',icon:LayoutDashboard},{key:'misaportes' as Tab,label:'Mis aportes',icon:BookOpen},{key:'caja' as Tab,label:'Caja del grupo',icon:Wallet}];
  const selectTab=(next:Tab)=>{setTab(next);setOpen(false);};
  const numericAmount = Number(amount);
  const amountCents = Number.isFinite(numericAmount)?Math.round(numericAmount*100):0;
  const spare = Math.max(0,amountCents%weeklyDueCents);
  const upcomingDates = [0,7,14].map(offset => plusDays(firstFriday, offset));

  if (!user) return <Landing onSignIn={signInWithGoogle} loading={authLoading} error={authError}/>;
  if (accessLoading || !accessRole) return <PendingAccess email={user.email ?? ''} message={accessMessage} loading={accessLoading} canBootstrap={user.email?.toLowerCase() === INITIAL_SUPERADMIN_EMAIL} onBootstrap={bootstrapInitialAdmin} onJoin={requestGroupMembership} onCreateGroup={createGroup} onSignOut={signOut}/>;

  return <div className="app-shell">
    <aside className={'sidebar '+(open?'sidebar-open':'')}>
      <div className="brand"><div className="brand-icon"><Coins size={25}/></div><div><strong>Tesorería</strong><span>del Salón</span></div><button className="close-menu" aria-label="Cerrar menú" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <div className="side-label">NAVEGACIÓN</div>
      <nav aria-label="Navegación principal">{nav.map(({key,label,icon:Icon})=><button key={key} onClick={()=>selectTab(key)} className={'nav-button '+(tab===key?'selected':'')}><Icon size={19}/>{label}{tab===key&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="side-group-card"><div className="side-group-icon"><Icon icon="solar:users-group-rounded-linear"/></div><div><span>GRUPO ACTIVO</span><strong>{groupName}</strong></div>{groupCode&&<b title="Código para que se unan tus compañeros">{groupCode}</b>}</div><div className="who"><div className="avatar">{role==='member'?'C':role==='delegate'?'D':'T'}</div><div><strong>{user?.user_metadata.full_name ?? user?.email ?? 'Cuenta conectada'}</strong><span>{role==='treasurer'?'Tesorero principal':role==='delegate'?'Delegado del salón':'Integrante aprobado'}</span></div></div></div>
    </aside>
    {open&&<button className="mobile-backdrop" aria-label="Cerrar menú" onClick={()=>setOpen(false)}/>}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Abrir menú" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="breadcrumbs">Mi salón <span>/</span> {tab==='inicio'?'Resumen':nav.find(x=>x.key===tab)?.label??'Tesorería'}</div><div className="topbar-right">{authLoading?<span className="auth-status">Verificando sesión…</span>:user?<><span className="account-chip" title={user.email??undefined}><span>{(user.user_metadata.full_name ?? user.email ?? 'C').slice(0,1).toUpperCase()}</span>{user.user_metadata.full_name ?? user.email ?? 'Cuenta conectada'}</span><button className="auth-button" onClick={()=>void signOut()}><LogOut size={15}/> Salir</button></>:<button className="auth-button" onClick={()=>void signInWithGoogle()}><Icon icon="logos:google-icon"/> Entrar con Google</button>}</div></header>
      <main className="content">
        {authError&&<div className="auth-error" role="alert">{authError}</div>}
        {tab==='inicio'&&<>
          <div className="page-heading dashboard-heading"><div><div className="eyebrow">{groupName.toUpperCase()} · PERIODO {firstFriday.slice(0,4)}</div><h1>{role==='member'?'Resumen de mi salón':'Panel general'}</h1><p>Saldo, aportes y movimientos registrados para el grupo.</p></div>{isAdmin&&<div className="admin-actions">{groupCode&&<button className="group-code group-code-action" onClick={()=>void copyInviteLink()} title="Copiar enlace de invitación"><Icon icon="solar:users-group-rounded-linear"/><span>Código del grupo</span><strong>{groupCode}</strong><em>{inviteCopied?'Enlace copiado':'Copiar enlace'}<Copy size={13}/></em></button>}<button className="primary" onClick={()=>selectTab('abonos')}><Plus size={18}/> Registrar aporte</button></div>}</div>
          <div className="stat-grid"><button className="stat-card major cash-card stat-card-button" onClick={()=>selectTab('caja')}><img className="cash-illustration" src="/dashboard-optimized/cash-jar.webp" alt="Frasco con monedas que representa la caja del salón"/><div className="stat-top"><span>Dinero actual en caja</span><Wallet size={22}/></div><div className="stat-value">{money(cashBalance)}</div><div className="stat-detail"><CheckCircle2 size={15}/> Ver movimientos y motivos</div></button><button className="stat-card goal-card stat-card-button" onClick={()=>isAdmin?selectTab('meta'):undefined}><img className="goal-illustration" src="/dashboard-optimized/goal-mountain.webp" alt="Montaña con bandera que representa la meta del salón"/><div className="stat-top"><span>Meta de fin de año</span><Goal size={22}/></div><div className="stat-value small">{publicGoal===null?'Por configurar':money(publicGoal)}</div><div className="stat-detail muted">{progress===null?'El tesorero aún no ha establecido una meta.':`${progress}% del objetivo alcanzado · ${goalName}`}</div>{progress!==null&&<div className="progress-track"><div style={{width:progress+'%'}}/></div>}</button></div>
          {isAdmin?<div className="stat-grid four"><button className="mini-stat mini-stat-action" onClick={()=>selectTab('configuracion')}><span>Cuota semanal</span><strong>{money(weeklyDueCents)}</strong><small>Configurar período</small></button><button className="mini-stat mini-stat-action" onClick={()=>selectTab('calendario')}><span>Primer vencimiento</span><strong>{formatDate(firstFriday)}</strong><small>Ver calendario</small></button><button className="mini-stat mini-stat-action" onClick={()=>selectTab('compañeros')}><span>Participantes</span><strong>{participantCount}</strong><small>Ver padrón</small></button><button className="mini-stat mini-stat-action" onClick={()=>selectTab('abonos')}><span>Aportes registrados</span><strong>{money(paymentTotal)}</strong><small>Registrar aporte</small></button></div>:<div className="stat-grid"><button className="stat-card stat-card-button" onClick={()=>selectTab('misaportes')}><div className="stat-top"><span>Mi historial</span><BookOpen size={21}/></div><div className="stat-value small">Ver mis aportes</div><div className="stat-detail muted">Tus registros aparecen al vincular tu cuenta.</div></button><button className="stat-card stat-card-button" onClick={()=>selectTab('caja')}><div className="stat-top"><span>Caja del grupo</span><Wallet size={21}/></div><div className="stat-value small">{money(cashBalance)}</div><div className="stat-detail muted">Consulta los movimientos y sus motivos.</div></button></div>}
          <section className="panel-grid"><div className="panel"><div className="panel-title"><div><h2>{isAdmin?'Próximos cobros':'Calendario de aportes'}</h2><p>Viernes del período activo</p></div><CalendarDays size={21}/></div>{upcomingDates.map((date,i)=><div className="week-row" key={date}><span className="week-index">{i+1}</span><div><strong>Viernes {formatDate(date)}</strong><small>Cuota prevista: {money(weeklyDueCents)}</small></div><span className="muted-pill">Programado</span></div>)}</div><div className="panel"><div className="panel-title"><div><h2>Transparencia</h2><p>Información general y privacidad</p></div><LockKeyhole size={20}/></div><div className="feature-item"><CheckCircle2 size={20}/><span>Todos los compañeros podrán ver el saldo de caja.</span></div><div className="feature-item"><CheckCircle2 size={20}/><span>La meta anual se actualizará con los ingresos y gastos.</span></div><div className="feature-item"><CheckCircle2 size={20}/><span>El historial personal solo lo verá su titular y los administradores.</span></div><div className="note">Los S/ 94 son saldo de apertura, no pagos nuevos de compañeros.</div></div></section>
        </>}
        {tab==='compañeros'&&<Page heading="Padrón y cuentas" desc="Crea las fichas primero; vincula cada cuenta Google cuando tu compañero se registre." icon={<Users size={27}/>}><section className="member-directory"><div className="directory-heading"><div><p className="settings-overline">PADRÓN DEL GRUPO</p><h2>{groupMembers.length} participante{groupMembers.length===1?'':'s'} creado{groupMembers.length===1?'':'s'}</h2></div><span className="directory-policy">{requireApproval?'Revisión manual activa':'Ingreso rápido activo'}</span></div><div className="participant-create"><input value={participantName} onChange={event=>setParticipantName(event.target.value)} placeholder="Nombre completo del compañero" maxLength={100}/><input value={participantPhone} onChange={event=>setParticipantPhone(event.target.value)} placeholder="Celular (opcional)" maxLength={24}/><button className="primary" disabled={participantSaving} onClick={()=>void createParticipant()}><Plus size={16}/>{participantSaving?'Creando…':'Crear ficha'}</button></div>{participantMessage&&<p className="payment-message">{participantMessage}</p>}{linkableAccounts.length>0&&<section className="linkable-accounts"><h3>Cuentas por gestionar</h3>{linkableAccounts.map(account=><div key={account.user_id}><span><b>{account.full_name}</b><small>{account.email}</small></span>{account.status==='pending'?<button className="member-approve" onClick={()=>void approveMember(account.user_id)}>Aprobar ingreso</button>:<em>Lista para vincular</em>}</div>)}</section>}{groupMembers.length?<div className="member-list">{groupMembers.map(member=><article className="member-row" key={member.participant_id}><div className="member-avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.full_name.slice(0,1).toUpperCase()}</div><button className="member-name member-open" onClick={()=>{setSelectedMember(member);selectTab('detalle-aportes')}}><strong>{member.full_name}</strong><span>{member.linked_email?`Cuenta vinculada: ${member.linked_email}`:'Sin cuenta vinculada'} · Total: {money(Number(member.total_cents))}</span></button>{member.linked_user_id?<span className="member-role active">Vinculado</span>:<select className="participant-link" defaultValue="" onChange={event=>{void linkParticipant(member.participant_id,event.target.value); event.currentTarget.value='';}}><option value="">Vincular cuenta…</option>{linkableAccounts.filter(account=>account.status==='active').map(account=><option key={account.user_id} value={account.user_id}>{account.full_name} · {account.email}</option>)}</select>}<div className="member-actions"><button className="member-open-action" onClick={()=>{setSelectedMember(member);setSelectedStudent(member.participant_id);selectTab('detalle-aportes')}}>Ver aportes</button><button className="member-open-action" onClick={()=>{setSelectedStudent(member.participant_id);selectTab('abonos')}}>Añadir aporte</button></div></article>)}</div>:<Empty title="Aún no hay fichas en el padrón" message="Crea la ficha de cada compañero, incluso antes de que tenga cuenta Google."/>}</section></Page>}
        {tab==='detalle-aportes'&&selectedMember&&<Page heading={selectedMember.full_name} desc="Historial de aportes aplicado a las semanas del salón." icon={<Coins size={27}/>}><section className="contribution-detail"><header><div className="detail-total"><span>Total aportado</span><strong>{money(Number(selectedMember.total_cents))}</strong></div><div className="detail-actions"><button className="member-open-action" onClick={()=>selectTab('compañeros')}>Volver al padrón</button>{isAdmin&&<button className="primary" onClick={()=>{setSelectedStudent(selectedMember.participant_id);selectTab('abonos')}}><Plus size={16}/> Registrar aporte</button>}</div></header><div className="detail-history"><h2>Aportes por viernes</h2>{historyLoading?<p>Cargando historial…</p>:contributionHistory.length?<div>{contributionHistory.map(item=><article key={`${item.contribution_id}-${item.due_date}`}><div><strong>Viernes {formatDate(item.due_date)}</strong><span>Recibido el {formatDate(item.received_on)}{item.note?` · ${item.note}`:''}</span></div><b>{money(item.applied_cents)}</b></article>)}</div>:<p>Aún no registra aportes. Usa “Registrar aporte” para añadir el primero.</p>}</div></section></Page>}
        {tab==='abonos'&&<Page heading="Registrar aporte" desc="El pago se guarda en caja y cubre primero las semanas pendientes más antiguas." icon={<Coins size={27}/>}><div className="form-grid"><div className="form-card"><label htmlFor="student">Participante que aporta</label><select id="student" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} disabled={!students.length}><option value="">{students.length?'Selecciona un participante':'Crea primero una ficha en el padrón'}</option>{students.map(student=><option key={student.participant_id} value={student.participant_id}>{student.full_name}</option>)}</select><label htmlFor="amount">Cantidad recibida (S/)</label><input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/><label htmlFor="payment-date">Fecha recibida</label><input id="payment-date" type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/><label htmlFor="payment-note">Nota <small>(opcional)</small></label><input id="payment-note" value={paymentNote} maxLength={300} placeholder="Por ejemplo: efectivo" onChange={e=>setPaymentNote(e.target.value)}/><button className="primary" disabled={paymentSaving||!selectedStudent||amountCents<1} onClick={()=>void recordContribution()}><CheckCircle2 size={16}/>{paymentSaving?'Registrando…':'Registrar aporte'}</button>{paymentMessage&&<p className="payment-message" role="status">{paymentMessage}</p>}</div><div className="form-card highlight"><div className="preview-hero"><img src="/dashboard-optimized/cash-jar.webp" alt="Frasco de monedas"/><h3>Aplicación del aporte</h3><p>El servidor asignará primero las semanas con deuda pendiente.</p></div>{amountCents>=weeklyDueCents?<><div className="preview-line"><span>Importe entregado</span><strong>{money(amountCents)}</strong></div><div className="preview-line"><span>Semanas completas posibles</span><strong>{Math.floor(amountCents/weeklyDueCents)}</strong></div><div className="preview-line"><span>Aplicado a semanas</span><strong>{money(amountCents-spare)}</strong></div><div className="preview-line"><span>Saldo a favor</span><strong>{money(amountCents%weeklyDueCents)}</strong></div><div className="preview-line grand"><span>Total</span><strong>{money(amountCents)}</strong></div></>:<p className="warn">El aporte puede ser parcial; se aplicará a la semana más antigua pendiente.</p>}<p className="mini">Cada registro queda guardado con su fecha, monto y semanas cubiertas.</p></div></div></Page>}
        {tab==='calendario'&&<Page heading="Calendario semanal" desc={`El período actual comienza el viernes ${formatDate(firstFriday)}.`} icon={<CalendarDays size={27}/>}><Empty title="Cobros programados" message={`Cada viernes corresponde a ${money(weeklyDueCents)} por integrante activo. Las semanas cubiertas por anticipado no se cobran dos veces.`}/></Page>}
        {tab==='caja'&&<Page heading="Caja y movimientos" desc="Cada ingreso, gasto o ajuste queda registrado con su motivo para todo el grupo." icon={<Wallet size={27}/>}><div className="form-grid"><div><div className="stat-card major compact"><div className="stat-top">Saldo actual en caja <Wallet size={19}/></div><div className="stat-value">{money(cashBalance)}</div><div className="stat-detail">Aportes, gastos y ajustes registrados</div></div>{isAdmin&&<div className="form-card"><h3>Registrar salida o ajuste</h3><label>Tipo de movimiento<select value={cashType} onChange={event=>setCashType(event.target.value as typeof cashType)}><option value="expense">Gasto</option><option value="adjustment_in">Ajuste a favor</option><option value="adjustment_out">Ajuste en contra</option></select></label><label>Monto (S/)<input type="number" min="0.01" step="0.01" value={cashAmount} onChange={event=>setCashAmount(event.target.value)}/></label><label>Motivo<input value={cashReason} maxLength={300} placeholder="Ej. Compra de materiales" onChange={event=>setCashReason(event.target.value)}/></label><label>Fecha<input type="date" value={cashDate} onChange={event=>setCashDate(event.target.value)}/></label><button className="primary" disabled={cashSaving} onClick={()=>void saveCashMovement()}>{cashSaving?'Guardando…':'Guardar movimiento'}</button>{cashMessage&&<p className="payment-message">{cashMessage}</p>}</div>}</div><div className="form-card cash-history"><h3>Movimientos del grupo</h3>{cashMovements.length?<div>{cashMovements.map(movement=><article className="cash-movement" key={movement.id}><div><strong>{movement.movement_type==='contribution'?'Aporte':movement.movement_type==='expense'?'Gasto':movement.movement_type==='adjustment_in'?'Ajuste a favor':'Ajuste en contra'}</strong><span>{formatDate(movement.occurred_on)} · {movement.reason}</span></div><b className={movement.movement_type==='expense'||movement.movement_type==='adjustment_out'?'negative':'positive'}>{movement.movement_type==='expense'||movement.movement_type==='adjustment_out'?'-':'+'}{money(Number(movement.amount_cents))}</b></article>)}</div>:<p className="mini">Aún no hay movimientos registrados.</p>}</div></div></Page>}
        {tab==='reportes'&&<Page heading="Reportes" desc="Resumen de caja, cobros, gastos, deudas y exportación." icon={<FileText size={27}/>}><Empty title="No hay información contable todavía" message="Una vez activada la app real, aparecerán reportes por semana, persona y periodo. Los exportables respetarán los permisos del usuario."/></Page>}
        {tab==='misaportes'&&<Page heading="Mis aportes" desc="Tu historial es privado: solo tú y la tesorería pueden consultarlo." icon={<BookOpen size={27}/>}><section className="contribution-detail"><div className="detail-history"><h2>Semanas y aportes registrados</h2>{myContributionHistory.length?<div>{myContributionHistory.map(item=><article key={`${item.contribution_id}-${item.due_date}`}><div><strong>Viernes {formatDate(item.due_date)}</strong><span>Recibido el {formatDate(item.received_on)}{item.note?` · ${item.note}`:''}</span></div><b>{money(item.applied_cents)}</b></article>)}</div>:<p>Tu cuenta aún no está vinculada a una ficha del padrón, o todavía no hay aportes registrados. Pide al tesorero que la relacione con tu ficha.</p>}</div></section></Page>}
        {tab==='meta'&&role==='treasurer'&&<Page heading="Meta anual" desc="Define un objetivo real y guarda la meta para que el grupo vea el avance." icon={<Goal size={27}/>}><div className="form-grid"><div className="form-card"><label htmlFor="goalname">Nombre de la meta</label><input id="goalname" value={goalName} onChange={e=>{setGoalName(e.target.value);setGoalSaved(false);}}/><label htmlFor="target">Monto objetivo (S/)</label><input type="number" min="1" step="0.01" id="target" placeholder="Por ejemplo, 1500" value={goal} onChange={e=>{setGoal(e.target.value);setGoalSaved(false);}}/><label htmlFor="goaldate">Fecha objetivo</label><input type="date" id="goaldate" value={goalDate} onChange={e=>{setGoalDate(e.target.value);setGoalSaved(false);}}/><button className="primary" disabled={!(Number(goal)>0)} onClick={()=>void saveGoal()}><CheckCircle2 size={16}/>{goalSaved?'Guardar cambios':'Guardar meta anual'}</button>{goalMessage&&<p className="payment-message">{goalMessage}</p>}</div><div className="form-card highlight"><h3>Proyección visual</h3><div className="preview-line"><span>Saldo en caja</span><strong>{money(cashBalance)}</strong></div><div className="preview-line"><span>Meta ingresada</span><strong>{Number(goal)>0?money(Math.round(Number(goal)*100)):'Sin configurar'}</strong></div><div className="preview-line"><span>Porcentaje</span><strong>{progress===null?'—':`${progress}%`}</strong></div><div className="preview-line"><span>Fecha</span><strong>{goalDate}</strong></div><p className="mini">El avance usa el saldo actual de caja y se actualiza con cada movimiento.</p></div></div></Page>}
        {tab==='configuracion'&&role==='treasurer'&&<Page heading="Administración del salón" desc="Gestiona el acceso, período y controles del grupo." icon={<Settings2 size={27}/>}><section className="admin-settings-grid"><article className="admin-settings-card featured"><div className="settings-card-icon"><Icon icon="solar:users-group-rounded-linear"/></div><div><p className="settings-overline">GRUPO ACTIVO</p><h2>{groupName}</h2><p>Comparte un enlace: el código viaja ya configurado y cada cuenta nueva se incorpora según la política que elijas.</p></div><button className="settings-code settings-share" onClick={()=>void copyInviteLink()} disabled={!groupCode}><span>{inviteCopied?'ENLACE COPIADO':'COPIAR ENLACE DE INVITACIÓN'}</span><strong>{groupCode ?? 'Cargando…'}</strong></button></article><article className="admin-settings-card join-policy-card"><div className="settings-card-icon"><Icon icon="solar:user-check-rounded-linear"/></div><div><p className="settings-overline">ACCESOS</p><h2>Ingreso rápido</h2><p>{requireApproval?'Las nuevas cuentas quedarán pendientes para que las revises.':'Los compañeros que usen tu enlace entrarán de inmediato como integrantes.'}</p></div><label className="policy-switch"><input type="checkbox" checked={requireApproval} onChange={event=>void saveJoinPolicy(event.target.checked)} disabled={joinPolicySaving}/><span aria-hidden="true"/><b>Revisar cada ingreso</b></label>{joinPolicyMessage&&<p className="join-policy-message" role="status">{joinPolicyMessage}</p>}</article><article className="admin-settings-card schedule-card"><div className="settings-card-icon"><Icon icon="solar:calendar-linear"/></div><div><p className="settings-overline">PERÍODO ACTIVO</p><h2>Cuota y calendario</h2><p>Elige el primer viernes y define la cuota semanal del grupo.</p></div><div className="schedule-form"><label>Primer viernes<input type="date" value={firstFriday} onChange={event=>setFirstFriday(event.target.value)}/></label><label>Cuota semanal (S/)<input type="number" min="1" step="0.01" value={(weeklyDueCents / 100).toFixed(2)} onChange={event=>setWeeklyDueCents(Math.max(100,Math.round(Number(event.target.value || 0)*100)))} /></label><button className="primary" onClick={()=>void saveGroupSchedule()} disabled={scheduleSaving}>{scheduleSaving?'Guardando…':'Guardar período'}</button></div>{scheduleMessage&&<p className="schedule-message" role="status">{scheduleMessage}</p>}</article><article className="admin-settings-card"><div className="settings-card-icon"><Icon icon="solar:shield-keyhole-linear"/></div><div><p className="settings-overline">SEGURIDAD</p><h2>Roles y trazabilidad</h2><p>Solo los tesoreros gestionan caja; los cambios importantes quedarán registrados.</p></div><span className="settings-status">Protegido</span></article></section></Page>}
      </main>
    </div>
  </div>;
}
function Page({heading,desc,icon,children}:{heading:string,desc:string,icon:React.ReactNode,children:React.ReactNode}) {return <><div className="page-heading"><div><div className="eyebrow">TESORERÍA DEL SALÓN</div><h1>{heading}</h1><p>{desc}</p></div><div className="page-icon">{icon}</div></div>{children}</>}
function Empty({title,message}:{title:string,message:string}) {return <div className="empty"><img className="empty-illustration" src="/dashboard-optimized/members-empty.webp" alt="Portapapeles con el registro de integrantes"/><h3>{title}</h3><p>{message}</p><div className="empty-caption"><Clock3 size={16}/> Pendiente de implementación segura con Supabase</div></div>}

function Landing({onSignIn,loading,error}:{onSignIn:()=>Promise<void>;loading:boolean;error:string|null}) {
  return <div className="landing">
    <header className="landing-nav">
      <a className="landing-brand" href="#inicio" aria-label="Tesorería del Salón, inicio"><span><Coins size={19}/></span><strong>Tesorería</strong><em>del Salón</em></a>
      <nav aria-label="Navegación de presentación"><a href="#como-funciona">Cómo funciona</a><a href="#principios">Principios</a></nav>
      <button className="landing-access" onClick={()=>void onSignIn()} disabled={loading}><Icon icon="logos:google-icon" aria-hidden="true"/>{loading?'Comprobando…':'Ingresar con Google'}</button>
    </header>

    <main id="inicio">
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="landing-kicker"><span/> CONTROL COMPARTIDO · PRIVACIDAD PERSONAL</p>
          <h1>La caja del salón,<br/><i>clara para todos.</i></h1>
          <p className="hero-lede">Una forma ordenada de registrar aportes, cuidar cada sol y seguir la meta que el grupo decide alcanzar.</p>
          <div className="hero-actions"><button className="landing-primary" onClick={()=>void onSignIn()} disabled={loading}><Icon icon="logos:google-icon" aria-hidden="true"/>{loading?'Comprobando acceso…':'Ingresar con Google'}</button><a className="landing-secondary" href="#como-funciona">Conocer el sistema <ArrowRight size={16}/></a></div>
          {error&&<p className="landing-error" role="alert">{error}</p>}
          <p className="hero-note"><ShieldCheck size={15}/> El acceso se aprueba antes de mostrar información del salón.</p>
        </div>
        <div className="hero-visual">
          <img className="hero-mascot hero-mascot-reading" src="/mascot-optimized/leyendo.webp" alt="Mascota revisando el resumen de la caja"/>
          <div className="hero-ledger" aria-label="Resumen ilustrativo de caja">
            <div className="ledger-top"><span>RESUMEN DE CAJA</span><span>DEMO</span></div>
            <div className="ledger-main"><p>Saldo inicial</p><strong>S/ 94.00</strong><small>Apertura de caja · no es un aporte nuevo</small></div>
            <div className="ledger-line"/><div className="ledger-row"><span>Cuota semanal</span><b>S/ 5.00</b></div><div className="ledger-row"><span>Próximo viernes</span><b>06 nov</b></div>
            <div className="ledger-tag"><CheckCircle2 size={15}/> Todo movimiento tendrá respaldo</div>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Principios del sistema"><div><b>S/ 94.00</b><span>saldo de apertura</span></div><div><b>S/ 5.00</b><span>cuota cada viernes</span></div><div><b>1 solo</b><span>libro de movimientos</span></div><div><b>0 datos</b><span>personales expuestos</span></div></section>

      <section className="landing-section" id="como-funciona"><div className="section-intro"><p className="landing-kicker"><span/> UNA RUTINA SIMPLE</p><h2>De la entrega al reporte,<br/>sin perder el hilo.</h2></div><ol className="landing-steps"><li><span>01</span><div><h3>Se recibe el aporte</h3><p>Se registra su monto, fecha real y método de pago.</p></div></li><li><span>02</span><div><h3>Se cubren las semanas</h3><p>Primero se atienden las cuotas pendientes más antiguas.</p></div></li><li><span>03</span><div><h3>El grupo ve lo esencial</h3><p>Caja y meta comunes; cada persona ve solamente su historial.</p></div></li></ol></section>

      <section className="landing-principles" id="principios"><div className="principle-quote"><img className="principle-mascot" src="/mascot-optimized/señalando.webp" alt="Mascota señalando los principios del sistema"/><p>“La confianza no se promete: se registra.”</p><span>Tesorería del Salón</span></div><div className="principle-list"><article><LockKeyhole size={19}/><div><h3>Privado por diseño</h3><p>Los aportes de cada compañero no se convierten en información pública.</p></div></article><article><ClipboardList size={19}/><div><h3>Historial, no borrados</h3><p>Los errores se corrigen con reversas y quedan explicados.</p></div></article><article><Goal size={19}/><div><h3>Una meta visible</h3><p>El avance se calcula desde la caja real, sin contar el mismo dinero dos veces.</p></div></article></div></section>

      <section className="landing-closing"><img className="closing-mascot" src="/mascot-optimized/like.webp" alt="Mascota celebrando una tesorería organizada"/><p className="landing-kicker"><span/> EMPEZAR CON ORDEN</p><h2>Una cuenta para cada integrante.<br/>Una caja que todos entienden.</h2><button className="landing-primary" onClick={()=>void onSignIn()} disabled={loading}><Icon icon="logos:google-icon" aria-hidden="true"/>Ingresar con Google</button></section>
    </main>
    <footer className="landing-footer"><div className="landing-brand"><span><Coins size={17}/></span><strong>Tesorería</strong><em>del Salón</em></div><p>Demo de producto · El registro de dinero real se habilitará solo tras completar las validaciones de seguridad.</p></footer>
  </div>;
}

function PendingAccess({email,message,loading,canBootstrap,onBootstrap,onJoin,onCreateGroup,onSignOut}:{email:string;message:string|null;loading:boolean;canBootstrap:boolean;onBootstrap:()=>Promise<void>;onJoin:(input:{groupCode:string;fullName:string;phone:string;avatarUrl:string|null})=>Promise<void>;onCreateGroup:(input:{groupName:string;fullName:string;phone:string;firstFriday:string;weeklyDueCents:number;requireApproval:boolean;avatarUrl:string|null})=>Promise<void>;onSignOut:()=>Promise<void>}) {
  const [fullName,setFullName] = useState('');
  const [phone,setPhone] = useState('');
  const inviteGroupCode = new URLSearchParams(window.location.search).get('grupo')?.trim().toUpperCase().slice(0,12) ?? '';
  const [groupCode,setGroupCode] = useState(inviteGroupCode);
  const [mode,setMode] = useState<'choice'|'join'|'create'>(inviteGroupCode ? 'join' : 'choice');
  const [newGroupName,setNewGroupName] = useState('');
  const [newGroupDue,setNewGroupDue] = useState('5.00');
  const [newGroupFirstFriday,setNewGroupFirstFriday] = useState('2026-11-06');
  const [newGroupApproval,setNewGroupApproval] = useState(false);
  const [photo,setPhoto] = useState<File|null>(null);
  const [submitting,setSubmitting] = useState(false);
  const [formError,setFormError] = useState<string|null>(null);
  async function uploadAvatar() {
    if (!photo) return null;
    if (!photo.type.startsWith('image/') || photo.size > 2 * 1024 * 1024) throw new Error('La foto debe ser una imagen de hasta 2 MB.');
    const form = new FormData(); form.append('file', photo);
    const { data, error } = await supabase.functions.invoke<{url:string}>('upload-profile-image', { body: form });
    if (error || !data?.url) throw new Error('No pudimos subir la foto. Puedes continuar sin ella o revisar la configuración de imágenes.');
    return data.url;
  }
  async function submitJoin(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(null); setSubmitting(true);
    try { await onJoin({groupCode,fullName,phone,avatarUrl:await uploadAvatar()}); } catch (error) { setFormError(error instanceof Error ? error.message : 'No se pudo enviar tu solicitud.'); }
    setSubmitting(false);
  }
  async function submitCreate(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(null);
    const dueCents = Math.round(Number(newGroupDue) * 100);
    if (!newGroupName.trim() || !Number.isFinite(dueCents) || dueCents < 100) { setFormError('Ingresa un nombre de grupo y una cuota válida de al menos S/ 1.00.'); return; }
    const date = new Date(`${newGroupFirstFriday}T12:00:00`);
    if (Number.isNaN(date.getTime()) || date.getDay() !== 5) { setFormError('El primer vencimiento debe ser un viernes.'); return; }
    setSubmitting(true);
    try { await onCreateGroup({groupName:newGroupName,fullName,phone,firstFriday:newGroupFirstFriday,weeklyDueCents:dueCents,requireApproval:newGroupApproval,avatarUrl:await uploadAvatar()}); } catch (error) { setFormError(error instanceof Error ? error.message : 'No se pudo crear el grupo.'); }
    setSubmitting(false);
  }
  const personalFields = <><label htmlFor="full-name">Nombre completo</label><input id="full-name" value={fullName} onChange={event=>setFullName(event.target.value)} maxLength={100} required/><label htmlFor="phone">Número de celular</label><input id="phone" type="tel" value={phone} onChange={event=>setPhone(event.target.value)} maxLength={24} required/><label htmlFor="profile-photo">Foto de perfil <small>(opcional, hasta 2 MB)</small></label><input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setPhoto(event.target.files?.[0] ?? null)}/></>;
  return <main className="pending-access"><div className="pending-card onboarding-card"><img src="/mascot-optimized/leyendo.webp" alt="Mascota revisando la configuración del grupo"/><p className="landing-kicker"><span/> ACCESO PROTEGIDO</p><h1>{loading?'Comprobando tu acceso…':mode==='create'?'Crea la tesorería de tu salón':mode==='join'?'Únete al grupo de tu salón':'¿Cómo quieres empezar?'}</h1><p>Entraste como <strong>{email}</strong>. {mode==='choice'?'Elige si deseas administrar un grupo nuevo o unirte al de tu salón.':'Tus datos se protegen y solo el grupo tendrá acceso a su información.'}</p>{message&&<p className="pending-message">{message}</p>}{canBootstrap?<button className="landing-primary" onClick={()=>void onBootstrap()} disabled={loading}><ShieldCheck size={17}/>Activar superadministrador</button>:mode==='choice'?<div className="onboarding-choices"><button className="onboarding-choice primary" onClick={()=>setMode('create')}><Icon icon="solar:users-group-rounded-linear"/><span><b>Crear mi grupo</b><small>Seré tesorero y podré invitar compañeros.</small></span><ArrowRight size={17}/></button><button className="onboarding-choice secondary" onClick={()=>setMode('join')}><Icon icon="solar:user-plus-linear"/><span><b>Unirme a un grupo</b><small>Tengo un código o enlace de invitación.</small></span><ArrowRight size={17}/></button></div>:mode==='join'?<form className="join-form" onSubmit={event=>void submitJoin(event)}>{inviteGroupCode?<div className="invite-group-notice"><Icon icon="solar:users-group-rounded-linear"/><div><span>INVITACIÓN PARA EL GRUPO</span><strong>{groupCode}</strong></div></div>:<><label htmlFor="group-code"><Icon icon="solar:password-minimalistic-input-linear"/> Código del grupo</label><input id="group-code" value={groupCode} onChange={event=>setGroupCode(event.target.value.toUpperCase())} maxLength={12} required/></>}{personalFields}{formError&&<p className="form-error" role="alert">{formError}</p>}<button className="landing-primary" disabled={submitting||loading||!groupCode}><Icon icon="solar:user-plus-linear"/>{submitting?'Enviando…':'Confirmar ingreso'}</button>{!inviteGroupCode&&<button type="button" className="onboarding-back" onClick={()=>setMode('choice')}>← Elegir otra opción</button>}</form>:<form className="join-form create-group-form" onSubmit={event=>void submitCreate(event)}><label htmlFor="new-group-name">Nombre de tu salón o grupo</label><input id="new-group-name" value={newGroupName} onChange={event=>setNewGroupName(event.target.value)} placeholder="Ej. 5.º B — Promoción 2026" maxLength={80} required/>{personalFields}<div className="onboarding-grid"><label>Cuota semanal (S/)<input type="number" min="1" step="0.01" value={newGroupDue} onChange={event=>setNewGroupDue(event.target.value)} required/></label><label>Primer viernes<input type="date" value={newGroupFirstFriday} onChange={event=>setNewGroupFirstFriday(event.target.value)} required/></label></div><label className="onboarding-switch"><input type="checkbox" checked={newGroupApproval} onChange={event=>setNewGroupApproval(event.target.checked)}/><span aria-hidden="true"/><div><b>Revisar cada ingreso</b><small>{newGroupApproval?'Los compañeros quedarán pendientes hasta que los apruebes.':'Ingreso rápido: los invitados activos entran sin revisión.'}</small></div></label>{formError&&<p className="form-error" role="alert">{formError}</p>}<button className="landing-primary" disabled={submitting||loading}><ShieldCheck size={17}/>{submitting?'Creando grupo…':'Crear grupo y ser tesorero'}</button><button type="button" className="onboarding-back" onClick={()=>setMode('choice')}>← Elegir otra opción</button></form>}<button className="pending-signout" onClick={()=>void onSignOut()}><LogOut size={15}/>Cerrar sesión</button></div></main>;
}
