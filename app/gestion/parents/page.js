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
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stylePetit = { marginTop: 0, padding: '6px 12px', fontSize: '.85rem' };
const styleDanger = { ...stylePetit, background: '#fee2e2', color: '#b91c1c', boxShadow: 'none' };

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
  const [classeSel, setClasseSel] = useState('');
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
        .select('id, code, eleve_id, expire_le, eleves(nom, prenom)')
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
  const codeDe = (eid) => (codes.find((c) => c.eleve_id === eid) || {}).code;

  // Élèves de la classe choisie
  const elevesClasse = classeSel
    ? inscriptions
        .filter((i) => i.classe_id === classeSel)
        .map((i) => eleves.find((e) => e.id === i.eleve_id))
        .filter(Boolean)
        .sort((a, b) => a.nom.localeCompare(b.nom))
    : [];
  const nbLies = elevesClasse.filter((e) => nbParents(e.id) > 0).length;
  const nbAttente = elevesClasse.filter((e) => nbParents(e.id) === 0 && codeDe(e.id)).length;
  const nbSans = elevesClasse.filter((e) => nbParents(e.id) === 0 && !codeDe(e.id)).length;

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

  async function copierTexte(texte, confirmation) {
    try {
      await navigator.clipboard.writeText(texte);
      ok(confirmation);
    } catch (e) {
      ko('Copie impossible : recopiez à la main.');
    }
  }

  async function generer(el) {
    setMsg({ texte: '', erreur: false });
    const { data, error } = await supabase.rpc('generer_code', { p_eleve: el.id });
    if (error) { ko('Erreur : ' + error.message); return; }
    setDernier({ code: data, eleve: el.prenom + ' ' + el.nom });
    ok('Code créé pour ' + el.prenom + ' ' + el.nom + '.');
    await charger(ctx.etab.id);
  }

  async function genererClasse() {
    if (!classeSel) { ko('Choisissez une classe.'); return; }
    setMsg({ texte: '', erreur: false });
    const { data, error } = await supabase.rpc('generer_codes_classe', { p_classe: classeSel });
    if (error) { ko('Erreur : ' + error.message); return; }
    ok(data + ' code(s) créé(s) pour la classe ' + nomClasse(classeSel) + '.');
    await charger(ctx.etab.id);
  }

  function listeTexte() {
    const lignes = elevesClasse
      .filter((e) => nbParents(e.id) === 0 && codeDe(e.id))
      .map((e) => e.nom + ' ' + e.prenom + ' : ' + fmtCode(codeDe(e.id)));
    return (
      'Codes Suivi École - classe ' + nomClasse(classeSel) + ' (valables 14 jours)\n' +
      lignes.join('\n') + '\n\nSite : ' + window.location.origin
    );
  }

  function imprimerFiches() {
    const liste = elevesClasse.filter((e) => nbParents(e.id) === 0 && codeDe(e.id));
    if (liste.length === 0) { ko('Aucun code à imprimer pour cette classe.'); return; }
    const url = window.location.origin;
    const cartes = liste
      .map((e) =>
        '<div class="carte"><h3>' + esc(ctx.etab.nom) + '</h3>' +
        '<p>Suivi de la scolarité de <b>' + esc(e.prenom + ' ' + e.nom) + '</b> (' + esc(nomClasse(classeSel)) + ')</p>' +
        '<div class="code">' + fmtCode(codeDe(e.id)) + '</div>' +
        '<p class="pt">1) Ouvrez ' + esc(url) + '<br>2) Touchez « Parent : créer un compte »<br>' +
        '3) Saisissez ce code dans « Ajouter un enfant »<br>Code valable 14 jours.</p></div>'
      )
      .join('');
    const w = window.open('', '_blank');
    if (!w) { ko('Fenêtre bloquée par le navigateur : autorisez les pop-up puis recommencez.'); return; }
    w.document.write(
      '<html><head><meta charset="utf-8"><title>Codes parents</title><style>' +
      'body{font-family:Arial,sans-serif;margin:12px}' +
      '.grille{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.carte{border:2px dashed #888;border-radius:8px;padding:10px;page-break-inside:avoid}' +
      'h3{margin:0 0 6px;font-size:14px}' +
      '.code{font-size:24px;font-weight:bold;letter-spacing:2px;margin:8px 0}' +
      '.pt{font-size:11px;color:#333}' +
      '</style></head><body><div class="grille">' + cartes + '</div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'
    );
    w.document.close();
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
          <button type="button" onClick={() => copierTexte(fmtCode(dernier.code), 'Code copié.')}>Copier</button>{' '}
          <a className="btn" href={lienWhatsApp(dernier.code, dernier.eleve)} target="_blank" rel="noreferrer">
            Envoyer par WhatsApp
          </a>
        </div>
      )}

      <div className="card">
        <h2>Codes par classe</h2>
        <p className="muted">
          Crée en une fois les codes de tous les élèves de la classe qui n'ont pas encore de parent
          rattaché ni de code valable.
        </p>
        <label>Classe</label>
        <select value={classeSel} onChange={(e) => setClasseSel(e.target.value)}>
          <option value="">— choisir —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <button type="button" onClick={genererClasse}>Générer les codes manquants</button>

        {classeSel && (
          <>
            <p className="muted" style={{ marginTop: 14 }}>
              {elevesClasse.length} élève(s) : {nbLies} avec parent rattaché, {nbAttente} avec code en attente, {nbSans} sans code.
            </p>
            <p className="erreur" style={{ marginTop: 8 }}>
              Attention : chaque code ne doit être remis qu'à la famille concernée. Ne publiez jamais cette liste dans un groupe de parents.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="secondaire" onClick={() => copierTexte(listeTexte(), 'Liste copiée.')}>
                Copier la liste
              </button>
              <button type="button" className="secondaire" onClick={imprimerFiches}>
                Imprimer les fiches
              </button>
            </div>
            <table style={{ marginTop: 12 }}>
              <tbody>
                {elevesClasse.map((el) => (
                  <tr key={el.id}>
                    <td>
                      {el.nom} {el.prenom}
                      <div className="muted">
                        {nbParents(el.id) > 0
                          ? '✓ ' + nbParents(el.id) + ' parent(s) rattaché(s)'
                          : codeDe(el.id)
                          ? 'Code : ' + fmtCode(codeDe(el.id))
                          : 'Pas de code'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {nbParents(el.id) === 0 && codeDe(el.id) && (
                        <a className="btn" style={stylePetit} target="_blank" rel="noreferrer"
                          href={lienWhatsApp(codeDe(el.id), el.prenom + ' ' + el.nom)}>
                          WhatsApp
                        </a>
                      )}
                      {nbParents(el.id) === 0 && !codeDe(el.id) && (
                        <button type="button" style={stylePetit} onClick={() => generer(el)}>Code</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h2>Code pour un seul élève</h2>
        <input placeholder="Rechercher un élève…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <table style={{ marginTop: 8 }}>
          <tbody>
            {filtres.slice(0, 30).map((el) => (
              <tr key={el.id}>
                <td>
                  {el.nom} {el.prenom}
                  <div className="muted">{classeDe(el.id)} · {nbParents(el.id)} parent(s) lié(s)</div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" style={stylePetit} onClick={() => generer(el)}>Code parent</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtres.length > 30 && <p className="muted">Affinez la recherche pour voir les autres élèves.</p>}
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
                  <button type="button" style={styleDanger} onClick={() => supprimerCode(c)}>Annuler</button>
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
              <button type="button" style={styleDanger} onClick={() => supprimerAnnonce(a)}>Supprimer</button>
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
