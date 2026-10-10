'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';

const ONGLETS = ['Notes', 'Absences', 'Appréciations', 'Annonces'];

const fmt = (x) => Number(x).toFixed(2).replace('.', ',');
const fmtDate = (s) => {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
};

// Regroupe les notes par matière et calcule les moyennes (ramenées sur 20)
function grouperNotes(notes) {
  const groupes = {};
  notes.forEach((n) => {
    const ev = n.evaluations;
    if (!ev || n.valeur === null) return;
    const mat = ev.classe_matieres && ev.classe_matieres.matieres
      ? ev.classe_matieres.matieres
      : { nom: 'Matière', coefficient: 1 };
    if (!groupes[mat.nom]) {
      groupes[mat.nom] = { nom: mat.nom, coef: Number(mat.coefficient) || 1, items: [] };
    }
    groupes[mat.nom].items.push({
      titre: ev.titre,
      date: ev.date_evaluation,
      valeur: Number(n.valeur),
      bareme: Number(ev.bareme) || 20,
      periode: ev.periodes ? ev.periodes.libelle : '',
    });
  });
  const liste = Object.values(groupes).map((g) => {
    const sur20 = g.items.map((i) => (i.valeur / i.bareme) * 20);
    return { ...g, moyenne: sur20.reduce((a, b) => a + b, 0) / sur20.length };
  });
  liste.sort((a, b) => a.nom.localeCompare(b.nom));
  const totalCoef = liste.reduce((s, g) => s + g.coef, 0);
  const generale = totalCoef > 0
    ? liste.reduce((s, g) => s + g.moyenne * g.coef, 0) / totalCoef
    : null;
  return { liste, generale };
}

export default function EspaceParent() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [enfants, setEnfants] = useState([]);
  const [classes, setClasses] = useState({});
  const [estPersonnel, setEstPersonnel] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [enfant, setEnfant] = useState(null);
  const [onglet, setOnglet] = useState('Notes');
  const [detail, setDetail] = useState({ notes: [], absences: [], apprec: [], annonces: [] });
  const [chargeDetail, setChargeDetail] = useState(false);
  const [code, setCode] = useState('');
  const [relation, setRelation] = useState('Père');
  const [msg, setMsg] = useState({ texte: '', erreur: false });

  async function chargerEnfants() {
    const { data } = await supabase
      .from('liens_parent_eleve')
      .select('relation, eleves(id, nom, prenom, matricule, etablissement_id)');
    const liste = (data || []).filter((x) => x.eleves).map((x) => ({ ...x.eleves, relation: x.relation }));
    setEnfants(liste);

    const { data: ins } = await supabase.from('inscriptions').select('eleve_id, classes(nom)');
    const map = {};
    (ins || []).forEach((i) => { if (i.classes) map[i.eleve_id] = i.classes.nom; });
    setClasses(map);
  }

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: m } = await supabase
        .from('membres_etablissement').select('role').eq('profil_id', user.id).limit(1);
      setEstPersonnel(!!(m && m.length > 0));
      await chargerEnfants();
      setChargement(false);
    })();
    // eslint-disable-next-line
  }, [ready]);

  async function choisir(e) {
    setEnfant(e);
    setOnglet('Notes');
    setChargeDetail(true);
    const [n, a, ap, an] = await Promise.all([
      supabase
        .from('notes')
        .select('valeur, evaluations(titre, type, date_evaluation, bareme, periodes(libelle), classe_matieres(matieres(nom, coefficient)))')
        .eq('eleve_id', e.id)
        .eq('publiee', true),
      supabase
        .from('absences')
        .select('id, date_absence, type, duree_minutes, justifiee, motif')
        .eq('eleve_id', e.id)
        .order('date_absence', { ascending: false }),
      supabase
        .from('appreciations')
        .select('id, texte, created_at, matieres(nom), periodes(libelle)')
        .eq('eleve_id', e.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('annonces')
        .select('id, titre, contenu, created_at')
        .eq('etablissement_id', e.etablissement_id)
        .order('created_at', { ascending: false }),
    ]);
    setDetail({
      notes: n.data || [],
      absences: a.data || [],
      apprec: ap.data || [],
      annonces: an.data || [],
    });
    setChargeDetail(false);
  }

  async function ajouterEnfant(ev) {
    ev.preventDefault();
    setMsg({ texte: '', erreur: false });
    if (!code.trim()) { setMsg({ texte: 'Saisissez le code reçu de l’école.', erreur: true }); return; }
    const { data, error } = await supabase.rpc('utiliser_code', { p_code: code, p_relation: relation });
    if (error) { setMsg({ texte: error.message, erreur: true }); return; }
    setMsg({ texte: 'Enfant ajouté : ' + data, erreur: false });
    setCode('');
    await chargerEnfants();
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (chargement) {
    return <div className="page"><p className="muted" style={{ color: '#fff' }}>Chargement…</p></div>;
  }

  // ---------- Détail d'un enfant ----------
  if (enfant) {
    const { liste, generale } = grouperNotes(detail.notes);
    const nbAbsences = detail.absences.filter((a) => a.type === 'absence').length;
    const nbRetards = detail.absences.filter((a) => a.type === 'retard').length;

    return (
      <div className="page">
        <button className="secondaire" style={{ marginTop: 0 }} onClick={() => setEnfant(null)}>
          ← Mes enfants
        </button>

        <div className="card" style={{ marginTop: 12 }}>
          <h1>{enfant.prenom} {enfant.nom}</h1>
          <span className="muted">
            {classes[enfant.id] ? 'Classe ' + classes[enfant.id] : 'Sans classe'}
            {enfant.matricule ? ' · ' + enfant.matricule : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {ONGLETS.map((o) => (
              <button
                key={o}
                className={o === onglet ? '' : 'secondaire'}
                style={{ marginTop: 0, padding: '8px 14px', fontSize: '.9rem' }}
                onClick={() => setOnglet(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {chargeDetail && <div className="card"><p className="muted">Chargement…</p></div>}

        {!chargeDetail && onglet === 'Notes' && (
          <>
            {generale !== null && (
              <div className="card">
                <h2>Moyenne générale</h2>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4f46e5' }}>
                  {fmt(generale)} <span className="muted">/ 20</span>
                </div>
                <p className="muted">Calculée sur les notes publiées, pondérée par les coefficients.</p>
              </div>
            )}
            {liste.length === 0 && (
              <div className="card"><p className="muted">Aucune note publiée pour l'instant.</p></div>
            )}
            {liste.map((g) => (
              <div className="card" key={g.nom}>
                <div className="ligne">
                  <h2 style={{ margin: 0 }}>{g.nom}</h2>
                  <strong style={{ color: '#4f46e5' }}>{fmt(g.moyenne)} / 20</strong>
                </div>
                <table style={{ marginTop: 8 }}>
                  <tbody>
                    {g.items.map((i, k) => (
                      <tr key={k}>
                        <td>
                          {i.titre}
                          <div className="muted">{fmtDate(i.date)}{i.periode ? ' · ' + i.periode : ''}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {fmt(i.valeur)} / {i.bareme}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

        {!chargeDetail && onglet === 'Absences' && (
          <div className="card">
            <h2>Absences et retards</h2>
            <p className="muted">{nbAbsences} absence(s) · {nbRetards} retard(s)</p>
            {detail.absences.length === 0 && <p className="muted">Aucune absence enregistrée.</p>}
            <table>
              <tbody>
                {detail.absences.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {fmtDate(a.date_absence)}
                      <div className="muted">{a.motif || ''}</div>
                    </td>
                    <td>
                      {a.type === 'retard' ? 'Retard' : 'Absence'}
                      {a.duree_minutes ? ' (' + a.duree_minutes + ' min)' : ''}
                    </td>
                    <td className="muted">{a.justifiee ? 'justifiée' : 'non justifiée'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!chargeDetail && onglet === 'Appréciations' && (
          <div className="card">
            <h2>Appréciations des enseignants</h2>
            {detail.apprec.length === 0 && <p className="muted">Aucune appréciation pour l'instant.</p>}
            {detail.apprec.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong>{a.matieres ? a.matieres.nom : 'Appréciation générale'}</strong>
                <span className="muted">{a.periodes ? ' · ' + a.periodes.libelle : ''}</span>
                <div>{a.texte}</div>
              </div>
            ))}
          </div>
        )}

        {!chargeDetail && onglet === 'Annonces' && (
          <div className="card">
            <h2>Annonces de l'établissement</h2>
            {detail.annonces.length === 0 && <p className="muted">Aucune annonce.</p>}
            {detail.annonces.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong>{a.titre}</strong>
                <div className="muted">{fmtDate(a.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{a.contenu}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Liste des enfants ----------
  return (
    <div className="page">
      <div className="card ligne">
        <div>
          <h1>Mon espace parent</h1>
          <span className="muted">{user?.email}</span>
        </div>
        <button className="secondaire" onClick={deconnexion}>Déconnexion</button>
      </div>

      {estPersonnel && (
        <div className="card">
          <Link href="/" className="btn secondaire" style={{ marginTop: 0 }}>Espace école</Link>
        </div>
      )}

      <div className="card">
        <h2>Mes enfants</h2>
        {enfants.length === 0 && (
          <p className="muted">
            Aucun enfant pour l'instant. Ajoutez-en un avec le code remis par l'école (carte ci-dessous).
          </p>
        )}
        <div className="liste">
          {enfants.map((e) => (
            <a key={e.id} href="#" onClick={(ev) => { ev.preventDefault(); choisir(e); }}>
              <span>
                {e.prenom} {e.nom}
                <div className="muted">{classes[e.id] ? 'Classe ' + classes[e.id] : 'Sans classe'}</div>
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Ajouter un enfant</h2>
        <p className="muted">Saisissez le code d'invitation donné par l'école.</p>
        <form onSubmit={ajouterEnfant}>
          <label>Code d'invitation</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX"
            autoCapitalize="characters" />
          <label>Vous êtes</label>
          <select value={relation} onChange={(e) => setRelation(e.target.value)}>
            <option>Père</option>
            <option>Mère</option>
            <option>Tuteur</option>
          </select>
          <button type="submit">Ajouter</button>
          {msg.texte && <p className={msg.erreur ? 'erreur' : 'ok'}>{msg.texte}</p>}
        </form>
      </div>
    </div>
  );
}
// FIN DU FICHIER
