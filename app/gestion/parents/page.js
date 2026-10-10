'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';

const fmtCode = (c) => (c ? c.slice(0, 5) + '-' + c.slice(5) : '');
const fmtDate = (s) => {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
};

export default function ParentsEtAnnonces() {
  const { user, ready } = useAuth();
  const [ctx, setCtx] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [inscriptions, setInscriptions] = useState([]);
  const [codes, setCodes] = useState([]);
  const [liens, setLiens] = useState([]);
  const [annonces, setAnnonces] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [dernier, setDernier] = useState(null);
  const [an, setAn] = useState({ titre: '', contenu: '', classe: '' });
  const [msg, setMsg] = useState({ texte: '', erreur: false });

  const ok = (texte) => setMsg({ texte, erreur: false });
  const ko = (texte) => setMsg({ texte, erreur: true });

  async function charger(id) {
    const [e, c, i, co, l, a] = await Promise.all([
      supabase.from('eleves').select('id, nom, prenom, matricule').eq('etablissement_id', id).order('nom'),
      supabase.from('classes').select('id, nom').eq('etablissement_id', id).order('nom'),
      supabase.from('inscriptions').select('eleve_id, classe_id'),
      supabase
        .from('codes_invitation')
        .select('id, code, expire_le, eleves(nom, prenom)')
        .eq('etablissement_id', id)
        .is('utilise_par', null)
        .gt('expire_le', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('liens_parent_eleve').select('eleve_id'),
      supabase
        .from('annonces')
        .select('id, titre, contenu, classe_id, created_at')
        .eq('etablissement_id', id)
        .order('created_at', { ascending: false }),
    ]);
    setEleves(e.data || []);
    setClasses(c.data || []);
    setInscriptions(i.data || []);
    setCodes(co.data || []);
    setLiens(l.data || []);
    setAnnonces(a.data || []);
  }

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: m } = await supabase
        .from('membres_etablissement')
        .select('role, etablissements(id, nom)')
        .eq('profil_id', user.id)
        .limit(1);
      if (m && m.length > 0) {
        setCtx({ role: m[0].role, etab: m[0].etablissements });
        if (m[0].role === 'admin') await charger(m[0].etablissements.id);
      }
      setChargement(false);
    })();
    // eslint-disable-next-line
  }, [ready]);

  const nomClasse = (id) => (classes.find((c) => c.id === id) || {}).nom || '—';
  const classeDe = (eid) => {
    const ins = inscriptions.find((i) => i.eleve_id === eid);
    return ins ? nomClasse(ins.classe_id) : 'Sans classe';
  };
  const nbParents = (eid) => liens.filter((l) => l.eleve_id === eid).length;

  async function generer(el) {
    setMsg({ texte: '', erreur: false });
    const { data, error } = await supabase.rpc('generer_code', { p_eleve: el.id });
    if (error) { ko('Erreur : ' + error.message); return; }
    setDernier({ code: data, eleve: el.prenom + ' ' + el.nom });
    ok('Code créé pour ' + el.prenom + ' ' + el.nom + '.');
    await charger(ctx.etab.id);
  }

  function lienWhatsApp(code, eleve) {
    const url = window.location.origin;
    const texte =
      'Bonjour, voici votre code pour suivre la scolarité de ' + eleve + ' sur Suivi École.\n\n' +
      'Code : ' + fmtCode(code) + ' (valable 14 jours)\n\n' +
      '1) Ouvrez ' + url + '\n' +
      '2) Touchez « Parent : créer un compte »\n' +
      '3) Saisissez ce code dans « Ajouter un enfant ».';
    return 'https://wa.me/?text=' + encodeURIComponent(texte);
  }

  async function copier(code) {
    try {
      await navigator.clipboard.writeText(fmtCode(code));
      ok('Code copié.');
    } catch (e) {
      ko('Copie impossible : recopiez le code à la main.');
    }
  }

  async function supprimerCode(c) {
    if (!window.confirm('Annuler ce code ? Il ne pourra plus être utilisé.')) return;
    const { error } = await supabase.from('codes_invitation').delete().eq('id', c.id);
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Code annulé.');
    await charger(ctx.etab.id);
  }

  async function publierAnnonce(e) {
    e.preventDefault();
    if (!an.titre.trim() || !an.contenu.trim()) { ko('Titre et message obligatoires.'); return; }
    const { error } = await supabase.from('annonces').insert({
      etablissement_id: ctx.etab.id,
      classe_id: an.classe || null,
      titre: an.titre.trim(),
      contenu: an.contenu.trim(),
      auteur_id: user.id,
    });
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Annonce publiée.');
    setAn({ titre: '', contenu: '', classe: '' });
    await charger(ctx.etab.id);
  }

  async function supprimerAnnonce(a) {
    if (!window.confirm('Supprimer l’annonce « ' + a.titre + ' » ?')) return;
    const { error } = await supabase.from('annonces').delete().eq('id', a.id);
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Annonce supprimée.');
    await charger(ctx.etab.id);
  }

  if (chargement) {
    return <div className="page"><p className="muted">Chargement…</p></div>;
  }

  if (!ctx || ctx.role !== 'admin') {
    return (
      <div className="page">
        <Link href="/" className="btn secondaire">← Accueil</Link>
        <div className="card" style={{ marginTop: 12 }}>
          <p>Cette page est réservée aux administrateurs de l'établissement.</p>
        </div>
      </div>
    );
  }

  const filtres = eleves.filter((el) =>
    (el.nom + ' ' + el.prenom).toLowerCase().includes(recherche.trim().toLowerCase())
  );

  return (
    <div className="page">
      <Link href="/" className="btn secondaire">← Accueil</Link>

      <div className="card" style={{ marginTop: 12 }}>
        <h1>Parents et annonces — {ctx.etab.nom}</h1>
        {msg.texte && <p className={msg.erreur ? 'erreur' : 'ok'}>{msg.texte}</p>}
      </div>

      {dernier && (
        <div className="card">
          <h2>Code pour {dernier.eleve}</h2>
          <div style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: 2, color: '#4f46e5' }}>
            {fmtCode(dernier.code)}
          </div>
          <p className="muted">Valable 14 jours, utilisable une seule fois.</p>
          <button type="button" onClick={() => copier(dernier.code)}>Copier</button>{' '}
          <a className="btn" href={lienWhatsApp(dernier.code, dernier.eleve)} target="_blank" rel="noreferrer">
            Envoyer par WhatsApp
          </a>
        </div>
      )}

      <div className="card">
        <h2>Codes d'invitation des parents</h2>
        <p className="muted">
          Choisissez un élève et créez son code. Le parent le saisit dans son espace pour voir la scolarité de son enfant.
        </p>
        <input placeholder="Rechercher un élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <table style={{ marginTop: 8 }}>
          <tbody>
            {filtres.map((el) => (
              <tr key={el.id}>
                <td>
                  {el.nom} {el.prenom}
                  <div className="muted">{classeDe(el.id)} · {nbParents(el.id)} parent(s) lié(s)</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" style={{ marginTop: 0, padding: '6px 12px', fontSize: '.85rem' }}
                    onClick={() => generer(el)}>
                    Code parent
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Codes en cours ({codes.length})</h2>
        {codes.length === 0 && <p className="muted">Aucun code en attente.</p>}
        <table>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{fmtCode(c.code)}</strong>
                  <div className="muted">
                    {c.eleves ? c.eleves.prenom + ' ' + c.eleves.nom : ''} · expire le {fmtDate(c.expire_le)}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button"
                    style={{ marginTop: 0, padding: '6px 12px', fontSize: '.85rem', background: '#fee2e2', color: '#b91c1c', boxShadow: 'none' }}
                    onClick={() => supprimerCode(c)}>
                    Annuler
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Nouvelle annonce</h2>
        <form onSubmit={publierAnnonce}>
          <label>Titre</label>
          <input value={an.titre} onChange={(e) => setAn({ ...an, titre: e.target.value })} />
          <label>Message</label>
          <textarea rows={4} value={an.contenu} onChange={(e) => setAn({ ...an, contenu: e.target.value })} />
          <label>Destinataires</label>
          <select value={an.classe} onChange={(e) => setAn({ ...an, classe: e.target.value })}>
            <option value="">Toute l'école</option>
            {classes.map((c) => <option key={c.id} value={c.id}>Classe {c.nom}</option>)}
          </select>
          <button type="submit">Publier</button>
        </form>
      </div>

      <div className="card">
        <h2>Annonces publiées ({annonces.length})</h2>
        {annonces.length === 0 && <p className="muted">Aucune annonce.</p>}
        {annonces.map((a) => (
          <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div className="ligne">
              <strong>{a.titre}</strong>
              <button type="button"
                style={{ marginTop: 0, padding: '6px 12px', fontSize: '.85rem', background: '#fee2e2', color: '#b91c1c', boxShadow: 'none' }}
                onClick={() => supprimerAnnonce(a)}>
                Supprimer
              </button>
            </div>
            <div className="muted">
              {fmtDate(a.created_at)} · {a.classe_id ? 'Classe ' + nomClasse(a.classe_id) : 'Toute l’école'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{a.contenu}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
// FIN DU FICHIER
