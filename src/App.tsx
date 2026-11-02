import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowRight, BookOpen, CalendarDays, CheckCircle2, CircleHelp, ClipboardList, Clock3, Coins, FileText, Goal, LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, Plus, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import { formatPEN, progressPercent } from './core/treasury';
import { INITIAL_CASH_CENTS, CONTRIBUTION_CENTS, DEMO } from './demo/fixtures';
import { supabase } from './utils/supabase';
import './landing.css';

type Tab = 'inicio'|'compañeros'|'abonos'|'calendario'|'caja'|'reportes'|'configuracion'|'misaportes';
type Role = 'treasurer'|'delegate'|'member';
const modules: {key: Tab; label: string; icon: typeof LayoutDashboard}[] = [
  { key:'inicio',label:'Resumen',icon:LayoutDashboard },
  { key:'compañeros',label:'Compañeros',icon:Users },
  { key:'abonos',label:'Registrar aporte',icon:Coins },
  { key:'calendario',label:'Semanas',icon:CalendarDays },
  { key:'caja',label:'Movimientos de caja',icon:Wallet },
  { key:'reportes',label:'Reportes',icon:FileText },
  { key:'configuracion',label:'Configuración',icon:Goal }
];
const money = (n:number) => formatPEN(n);
export default function App() {
  const [role,setRole] = useState<Role>('treasurer');
  const [user,setUser] = useState<User|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authError,setAuthError] = useState<string|null>(null);
  const [tab,setTab] = useState<Tab>('inicio');
  const [open,setOpen] = useState(false);
  const [goal,setGoal] = useState('');
  const [goalName,setGoalName] = useState('Fondo de fin de año');
  const [goalDate,setGoalDate] = useState('2026-12-31');
  const [goalSaved,setGoalSaved] = useState(false);
  const [amount,setAmount] = useState('10');
  const [futureWeeks,setFutureWeeks] = useState('1');
  const [remainder,setRemainder] = useState<'credit'|'donation'>('credit');
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError('No se pudo iniciar sesión con Google. Revisa la configuración de Supabase.');
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError('No se pudo cerrar la sesión. Inténtalo otra vez.');
  }
  const publicGoal = goalSaved && Number(goal)>0 ? Math.round(Number(goal)*100):DEMO.goalCents;
  const progress = progressPercent(INITIAL_CASH_CENTS,publicGoal);
  const isAdmin = role !== 'member';
  const nav = isAdmin?modules.filter(m => role === 'treasurer'||m.key!=='configuracion'):[{key:'inicio' as Tab,label:'Mi inicio',icon:LayoutDashboard},{key:'misaportes' as Tab,label:'Mis aportes',icon:BookOpen}];
  const selectTab=(next:Tab)=>{setTab(next);setOpen(false);};
  function switchRole(r:Role){setRole(r);setTab('inicio');setOpen(false);}
  const numericAmount = Number(amount);
  const amountCents = Number.isFinite(numericAmount)?Math.round(numericAmount*100):0;
  const allocation = Number.isInteger(amountCents)&&amountCents>=500 ? Math.min(Number(futureWeeks),Math.floor(amountCents/500)):0;
  const spare = Math.max(0,amountCents-allocation*500);

  if (!user) return <Landing onSignIn={signInWithGoogle} loading={authLoading} error={authError}/>;

  return <div className="app-shell">
    <aside className={'sidebar '+(open?'sidebar-open':'')}>
      <div className="brand"><div className="brand-icon"><Coins size={25}/></div><div><strong>Tesorería</strong><span>del Salón</span></div><button className="close-menu" aria-label="Cerrar menú" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <div className="side-label">NAVEGACIÓN</div>
      <nav aria-label="Navegación principal">{nav.map(({key,label,icon:Icon})=><button key={key} onClick={()=>selectTab(key)} className={'nav-button '+(tab===key?'selected':'')}><Icon size={19}/>{label}{tab===key&&<span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="demo-flag"><CircleHelp size={17}/><span>Interfaz de demostración.<br/>Sin datos reales ni pagos activos.</span></div><div className="who"><div className="avatar">{role==='member'?'C':role==='delegate'?'D':'T'}</div><div><strong>Vista {role==='treasurer'?'Tesorero':role==='delegate'?'Delegado':'Compañero'}</strong><span>Solo para revisar el diseño</span></div></div></div>
    </aside>
    {open&&<button className="mobile-backdrop" aria-label="Cerrar menú" onClick={()=>setOpen(false)}/>}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Abrir menú" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="breadcrumbs">Mi salón <span>/</span> {tab==='inicio'?'Resumen':nav.find(x=>x.key===tab)?.label??'Tesorería'}</div><div className="topbar-right"><span className="badge demo-badge"><Activity size={14}/> DEMO</span>{authLoading?<span className="auth-status">Verificando sesión…</span>:user?<><span className="auth-status" title={user.email??undefined}>{user.user_metadata.full_name ?? user.email ?? 'Cuenta conectada'}</span><button className="auth-button" onClick={()=>void signOut()}><LogOut size={15}/> Salir</button></>:<button className="auth-button" onClick={()=>void signInWithGoogle()}><LogIn size={15}/> Entrar con Google</button>}<label className="role-label" htmlFor="preview-role">Vista</label><select id="preview-role" value={role} onChange={e=>switchRole(e.target.value as Role)}><option value="treasurer">Tesorero</option><option value="delegate">Delegado</option><option value="member">Compañero</option></select></div></header>
      <main className="content">
        {authError&&<div className="auth-error" role="alert">{authError}</div>}
        {tab==='inicio'&&<>
          <div className="page-heading"><div><div className="eyebrow">TESORERÍA · PERIODO 2026</div><h1>{role==='member'?'Resumen de mi salón':'Panel general'}</h1><p>Control de aportes y caja. Saldo inicial confirmado: S/ 94.00.</p></div>{isAdmin&&<button className="primary" onClick={()=>selectTab('abonos')}><Plus size={18}/> Registrar aporte</button>}</div>
          <div className="stat-grid"><div className="stat-card major"><div className="stat-top"><span>Dinero actual en caja</span><Wallet size={22}/></div><div className="stat-value">{money(INITIAL_CASH_CENTS)}</div><div className="stat-detail"><CheckCircle2 size={15}/> Saldo inicial registrado en el proyecto</div></div><div className="stat-card"><div className="stat-top"><span>Meta de fin de año</span><Goal size={22}/></div><div className="stat-value small">{publicGoal===null?'Por configurar':money(publicGoal)}</div><div className="stat-detail muted">{progress===null?'El tesorero aún no ha establecido una meta.':`${progress}% del objetivo alcanzado · ${goalName}`}</div>{progress!==null&&<div className="progress-track"><div style={{width:progress+'%'}}/></div>}</div></div>
          {isAdmin?<div className="stat-grid four"><div className="mini-stat"><span>Cuota semanal</span><strong>{money(CONTRIBUTION_CENTS)}</strong><small>Cada viernes</small></div><div className="mini-stat"><span>Primer vencimiento</span><strong>06/11/2026</strong><small>Viernes</small></div><div className="mini-stat"><span>Miembros</span><strong>{DEMO.members}</strong><small>Padrón no cargado</small></div><div className="mini-stat"><span>Pagos nuevos</span><strong>{money(DEMO.payments)}</strong><small>Sin registrar</small></div></div>:<div className="stat-grid"><div className="stat-card"><div className="stat-top"><span>Mi estado personal</span><ShieldCheck size={21}/></div><div className="stat-value small">Sin vincular</div><div className="stat-detail muted">El tesorero debe vincular tu cuenta con el padrón.</div></div><div className="stat-card"><div className="stat-top"><span>Mi historial</span><BookOpen size={21}/></div><div className="stat-value small">Sin información</div><div className="stat-detail muted">Solo podrás ver tus propios pagos cuando activen Firebase.</div></div></div>}
          <section className="panel-grid"><div className="panel"><div className="panel-title"><div><h2>{isAdmin?'Próximos cobros':'Calendario de aportes'}</h2><p>Primeros viernes del periodo</p></div><CalendarDays size={21}/></div>{['06/11/2026','13/11/2026','20/11/2026'].map((date,i)=><div className="week-row" key={date}><span className="week-index">{i+1}</span><div><strong>Viernes {date}</strong><small>Cuota prevista: {money(500)}</small></div><span className="muted-pill">Programado</span></div>)}</div><div className="panel"><div className="panel-title"><div><h2>Transparencia</h2><p>Información general y privacidad</p></div><LockKeyhole size={20}/></div><div className="feature-item"><CheckCircle2 size={20}/><span>Todos los compañeros podrán ver el saldo de caja.</span></div><div className="feature-item"><CheckCircle2 size={20}/><span>La meta anual se actualizará con los ingresos y gastos.</span></div><div className="feature-item"><CheckCircle2 size={20}/><span>El historial personal solo lo verá su titular y los administradores.</span></div><div className="note">Los S/ 94 son saldo de apertura, no pagos nuevos de compañeros.</div></div></section>
        </>}
        {tab==='compañeros'&&<Page heading="Compañeros" desc="El padrón real y los accesos estarán disponibles después de vincular Firebase." icon={<Users size={27}/>}><Empty title="Aún no hay compañeros registrados" message="No inventamos nombres ni aportes. Claude implementará altas, bajas, aprobación de cuentas, búsqueda y estado semanal."/></Page>}
        {tab==='abonos'&&<Page heading="Registrar aporte" desc="Vista previa del reparto. No guarda ni modifica caja." icon={<Coins size={27}/>}><div className="form-grid"><div className="form-card"><label>Compañero</label><div className="field muted-field">Primero debes cargar el padrón y activar Firebase.</div><label htmlFor="amount">Cantidad recibida (S/)</label><input id="amount" type="number" min="5" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/><label htmlFor="weeks">Semanas que desea cubrir (simulación)</label><select id="weeks" value={futureWeeks} onChange={e=>setFutureWeeks(e.target.value)}><option value="1">1 semana</option><option value="2">2 semanas</option><option value="3">3 semanas</option><option value="4">4 semanas</option><option value="5">5 semanas</option></select><label htmlFor="extra">Destino de excedente</label><select id="extra" value={remainder} onChange={e=>setRemainder(e.target.value as 'credit'|'donation')}><option value="credit">Saldo a favor</option><option value="donation">Aporte voluntario adicional</option></select><button className="primary disabled" disabled title="Primero implementar backend seguro"><LockKeyhole size={16}/> Guardar pago (no disponible en demo)</button></div><div className="form-card highlight"><h3>Vista previa (demostración)</h3>{amountCents>=500?<><div className="preview-line"><span>Importe entregado</span><strong>{money(amountCents)}</strong></div><div className="preview-line"><span>Semanas completas posibles</span><strong>{allocation}</strong></div><div className="preview-line"><span>Aplicado a semanas</span><strong>{money(allocation*500)}</strong></div><div className="preview-line"><span>{remainder==='credit'?'Saldo a favor':'Aporte voluntario'}</span><strong>{money(spare)}</strong></div><div className="preview-line grand"><span>Total</span><strong>{money(amountCents)}</strong></div></>:<p className="warn">El pago ordinario mínimo es S/ 5.00.</p>}<p className="mini">En producción, las deudas antiguas deben cubrirse primero y esta simulación se reemplazará por el cálculo oficial del servidor.</p></div></div></Page>}
        {tab==='calendario'&&<Page heading="Calendario semanal" desc="El sistema calculará cuotas los viernes, desde el 6 de noviembre de 2026." icon={<CalendarDays size={27}/>}><Empty title="Cobros programados" message="Cada viernes corresponde a S/ 5 por integrante activo. Las semanas cubiertas por anticipado no se cobran dos veces."/></Page>}
        {tab==='caja'&&<Page heading="Caja y movimientos" desc="Los asientos de apertura, cobro, gasto y reversa se mostrarán en esta sección." icon={<Wallet size={27}/>}><div className="stat-card major compact"><div className="stat-top">Saldo inicial registrado en el proyecto <Wallet size={19}/></div><div className="stat-value">S/ 94.00</div><div className="stat-detail">Apertura · No corresponde a un pago nuevo</div></div><Empty title="Sin movimientos posteriores" message="La apertura de la caja real se formalizará al implementar el backend seguro y anotar la fecha del arqueo."/></Page>}
        {tab==='reportes'&&<Page heading="Reportes" desc="Resumen de caja, cobros, gastos, deudas y exportación." icon={<FileText size={27}/>}><Empty title="No hay información contable todavía" message="Una vez activada la app real, aparecerán reportes por semana, persona y periodo. Los exportables respetarán los permisos del usuario."/></Page>}
        {tab==='misaportes'&&<Page heading="Mis aportes" desc="Tu historial de pagos estará protegido y solo tú podrás consultarlo." icon={<BookOpen size={27}/>}><Empty title="Historial privado aún sin vincular" message="Al iniciar sesión en producción, el tesorero deberá aprobar tu cuenta y asociarla con tu ficha de integrante."/></Page>}
        {tab==='configuracion'&&role==='treasurer'&&<Page heading="Configuración de la meta" desc="El objetivo anual es independiente del dinero realmente disponible." icon={<Goal size={27}/>}><div className="form-grid"><div className="form-card"><label htmlFor="goalname">Nombre de la meta</label><input id="goalname" value={goalName} onChange={e=>setGoalName(e.target.value)}/><label htmlFor="target">Monto objetivo (S/)</label><input type="number" min="1" step="0.01" id="target" placeholder="Por ejemplo, 1500" value={goal} onChange={e=>{setGoal(e.target.value);setGoalSaved(false);}}/><label htmlFor="goaldate">Fecha objetivo</label><input type="date" id="goaldate" value={goalDate} onChange={e=>setGoalDate(e.target.value)}/><button className="primary" disabled={!(Number(goal)>0)} onClick={()=>setGoalSaved(true)}><CheckCircle2 size={16}/> Vista previa de meta (no guarda)</button></div><div className="form-card highlight"><h3>Proyección visual</h3><div className="preview-line"><span>Saldo en caja</span><strong>S/ 94.00</strong></div><div className="preview-line"><span>Meta ingresada</span><strong>{Number(goal)>0?money(Math.round(Number(goal)*100)):'Sin configurar'}</strong></div><div className="preview-line"><span>Porcentaje</span><strong>{progress===null?'—':`${progress}%`}</strong></div><div className="preview-line"><span>Fecha</span><strong>{goalDate}</strong></div><p className="mini">Los cambios son temporales en esta demo; Claude implementará guardado auditado en Firebase.</p></div></div></Page>}
      </main>
      <footer>Starter de interfaz · No apto para registrar dinero real <span>React + Firebase (pendiente de integración) <ArrowRight size={14}/></span></footer>
    </div>
  </div>;
}
function Page({heading,desc,icon,children}:{heading:string,desc:string,icon:React.ReactNode,children:React.ReactNode}) {return <><div className="page-heading"><div><div className="eyebrow">TESORERÍA DEL SALÓN</div><h1>{heading}</h1><p>{desc}</p></div><div className="page-icon">{icon}</div></div>{children}</>}
function Empty({title,message}:{title:string,message:string}) {return <div className="empty"><div className="empty-icon"><ClipboardList size={29}/></div><h3>{title}</h3><p>{message}</p><div className="empty-caption"><Clock3 size={16}/> Pendiente de implementación segura con Supabase</div></div>}

function Landing({onSignIn,loading,error}:{onSignIn:()=>Promise<void>;loading:boolean;error:string|null}) {
  return <div className="landing">
    <header className="landing-nav">
      <a className="landing-brand" href="#inicio" aria-label="Tesorería del Salón, inicio"><span><Coins size={19}/></span><strong>Tesorería</strong><em>del Salón</em></a>
      <nav aria-label="Navegación de presentación"><a href="#como-funciona">Cómo funciona</a><a href="#principios">Principios</a></nav>
      <button className="landing-access" onClick={()=>void onSignIn()} disabled={loading}><LogIn size={16}/>{loading?'Comprobando…':'Ingresar'}</button>
    </header>

    <main id="inicio">
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="landing-kicker"><span/> CONTROL COMPARTIDO · PRIVACIDAD PERSONAL</p>
          <h1>La caja del salón,<br/><i>clara para todos.</i></h1>
          <p className="hero-lede">Una forma ordenada de registrar aportes, cuidar cada sol y seguir la meta que el grupo decide alcanzar.</p>
          <div className="hero-actions"><button className="landing-primary" onClick={()=>void onSignIn()} disabled={loading}><LogIn size={17}/>{loading?'Comprobando acceso…':'Ingresar con Google'}</button><a className="landing-secondary" href="#como-funciona">Conocer el sistema <ArrowRight size={16}/></a></div>
          {error&&<p className="landing-error" role="alert">{error}</p>}
          <p className="hero-note"><ShieldCheck size={15}/> El acceso se aprueba antes de mostrar información del salón.</p>
        </div>
        <div className="hero-ledger" aria-label="Resumen ilustrativo de caja">
          <div className="ledger-top"><span>RESUMEN DE CAJA</span><span>DEMO</span></div>
          <div className="ledger-main"><p>Saldo inicial</p><strong>S/ 94.00</strong><small>Apertura de caja · no es un aporte nuevo</small></div>
          <div className="ledger-line"/><div className="ledger-row"><span>Cuota semanal</span><b>S/ 5.00</b></div><div className="ledger-row"><span>Próximo viernes</span><b>06 nov</b></div>
          <div className="ledger-tag"><CheckCircle2 size={15}/> Todo movimiento tendrá respaldo</div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Principios del sistema"><div><b>S/ 94.00</b><span>saldo de apertura</span></div><div><b>S/ 5.00</b><span>cuota cada viernes</span></div><div><b>1 solo</b><span>libro de movimientos</span></div><div><b>0 datos</b><span>personales expuestos</span></div></section>

      <section className="landing-section" id="como-funciona"><div className="section-intro"><p className="landing-kicker"><span/> UNA RUTINA SIMPLE</p><h2>De la entrega al reporte,<br/>sin perder el hilo.</h2></div><ol className="landing-steps"><li><span>01</span><div><h3>Se recibe el aporte</h3><p>Se registra su monto, fecha real y método de pago.</p></div></li><li><span>02</span><div><h3>Se cubren las semanas</h3><p>Primero se atienden las cuotas pendientes más antiguas.</p></div></li><li><span>03</span><div><h3>El grupo ve lo esencial</h3><p>Caja y meta comunes; cada persona ve solamente su historial.</p></div></li></ol></section>

      <section className="landing-principles" id="principios"><div className="principle-quote"><p>“La confianza no se promete: se registra.”</p><span>Tesorería del Salón</span></div><div className="principle-list"><article><LockKeyhole size={19}/><div><h3>Privado por diseño</h3><p>Los aportes de cada compañero no se convierten en información pública.</p></div></article><article><ClipboardList size={19}/><div><h3>Historial, no borrados</h3><p>Los errores se corrigen con reversas y quedan explicados.</p></div></article><article><Goal size={19}/><div><h3>Una meta visible</h3><p>El avance se calcula desde la caja real, sin contar el mismo dinero dos veces.</p></div></article></div></section>

      <section className="landing-closing"><p className="landing-kicker"><span/> EMPEZAR CON ORDEN</p><h2>Una cuenta para cada integrante.<br/>Una caja que todos entienden.</h2><button className="landing-primary" onClick={()=>void onSignIn()} disabled={loading}><LogIn size={17}/>Ingresar con Google</button></section>
    </main>
    <footer className="landing-footer"><div className="landing-brand"><span><Coins size={17}/></span><strong>Tesorería</strong><em>del Salón</em></div><p>Demo de producto · El registro de dinero real se habilitará solo tras completar las validaciones de seguridad.</p></footer>
  </div>;
}
