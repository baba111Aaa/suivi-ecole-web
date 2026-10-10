'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';

const ONGLETS = ['Année', 'Classes', 'Matières', 'Élèves', 'Personnel'];

function BoutonSuppr({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 0, padding: '6px 12px', fontSize: '.85rem',
        background: '#fee2e2', color: '#b91c1c', boxShadow: 'none',
      }}
    >
      {children || 'Supprimer'}
    </button>
  );
}

export default function Gestion() {
  const { user, ready } = useAuth();
  const [ctx, setCtx] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('Année');
  const [msg, setMsg] = useState({ texte: '', erreur: false });
  const [mode, setMode] = useState('administration');
  const [d, setD] = useState({
    annees: [], periodes: [], classes: [], matieres: [],
    cms: [], eleves: [], inscriptions: [], membres: [],
  });
  const [f, setF] = useState({
    anneeLibelle: '', anneeDebut: '', anneeFin: '',
    perLibelle: '', perDebut: '', perFin: '',
    classeNom: '', classeNiveau: '',
    matNom: '', matCoef: '1',
    lienClasse: '', lienMatiere: '', lienEns: '',
    elNom: '', elPrenom: '', elMatricule: '', elClasse: '',
    lotClasse: '', lotTexte: '',
    persEmail: '', persRole: 'enseignant',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const etabId = ctx ? ctx.etab.id : null;
  const anneeActive = d.annees.find((a) => a.active) || d.annees[0];
  const enseignants = d.membres.filter((m) => m.role === 'enseignant');

  const ok = (texte) => setMsg({ texte, erreur: false });
  const ko = (texte) => setMsg({ texte, erreur: true });

  async function charger(id) {
    const [a, p, c, m, cm, e, i, mb] = await Promise.all([
      supabase.from('annees_scolaires').select('*').eq('etablissement_id', id).order('date_debut', { ascending: false }),
      supabase.from('periodes').select('*').eq('etablissement_id', id).order('date_debut'),
      supabase.from('classes').select('*').eq('etablissement_id', id).order('nom'),
      supabase.from('matieres').select('*').eq('etablissement_id', id).order('nom'),
      supabase.from('classe_matieres').select('id, classe_id, matiere_id, enseignant_id').eq('etablissement_id', id),
      supabase.from('eleves').select('id, nom, prenom, matricule').eq('etablissement_id', id).order('nom'),
      supabase.from('inscriptions').select('eleve_id, classe_id, annee_id'),
      supabase.from('membres_etablissement').select('profil_id, role, profils(nom)').eq('etablissement_id', id),
    ]);
    setD({
      annees: a.data || [], periodes: p.data || [], classes: c.data || [], matieres: m.data || [],
      cms: cm.data || [], eleves: e.data || [], inscriptions: i.data || [], membres: mb.data || [],
    });
  }

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: m } = await supabase
        .from('membres_etablissement')
        .select('role, etablissements(id, nom, mode_saisie)')
        .eq('profil_id', user.id)
        .limit(1);
      if (m && m.length > 0) {
        setCtx({ role: m[0].role, etab: m[0].etablissements });
        setMode(m[0].etablissements.mode_saisie || 'administration');
        if (m[0].role === 'admin') await charger(m[0].etablissements.id);
      }
      setChargement(false);
    })();
    // eslint-disable-next-line
  }, [ready]);

  async function exec(requete, texteOk) {
    const { error } = await requete;
    if (error) { ko('Erreur : ' + error.message); return false; }
    ok(texteOk);
    await charger(etabId);
    return true;
  }

  // ---------- Outils de suppression ----------
  async function compte(table, colonne, ids) {
    if (!ids || ids.length === 0) return 0;
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(colonne, ids);
    return count || 0;
  }

  async function supprimer(table, id, texteOk) {
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
    if (error) { ko('Erreur : ' + error.message); return; }
    if (!data || data.length === 0) { ko('Suppression refusée ou élément déjà supprimé.'); return; }
    ok(texteOk);
    await charger(etabId);
  }

  async function evaluationsDe(cmIds) {
    if (cmIds.length === 0) return [];
    const { data } = await supabase.from('evaluations').select('id').in('classe_matiere_id', cmIds);
    return (data || []).map((e) => e.id);
  }

  async function supprEleve(el) {
    const [nn, na, nl] = await Promise.all([
      compte('notes', 'eleve_id', [el.id]),
      compte('absences', 'eleve_id', [el.id]),
      compte('liens_parent_eleve', 'eleve_id', [el.id]),
    ]);
    const message =
      'Supprimer ' + el.prenom + ' ' + el.nom + ' ?\n\n' +
      'Seront aussi effacés : ' + nn + ' note(s), ' + na + ' absence(s), ' + nl + ' lien(s) avec un parent.\n' +
      'Cette action est définitive.';
    if (!window.confirm(message)) return;
    await supprimer('eleves', el.id, 'Élève supprimé.');
  }

  async function supprClasse(c) {
    const cmIds = d.cms.filter((x) => x.classe_id === c.id).map((x) => x.id);
    const evIds = await evaluationsDe(cmIds);
    const nn = await compte('notes', 'evaluation_id', evIds);
    const nbEleves = d.inscriptions.filter((i) => i.classe_id === c.id).length;
    const message =
      'Supprimer la classe ' + c.nom + ' ?\n\n' +
      nbEleves + ' élève(s) seront désinscrits (les élèves ne sont pas supprimés).\n' +
      'Seront effacés : ' + cmIds.length + ' matière(s) rattachée(s), ' + evIds.length + ' évaluation(s) et ' + nn + ' note(s).\n' +
      'Cette action est définitive.';
    if (!window.confirm(message)) return;
    await supprimer('classes', c.id, 'Classe supprimée.');
  }

  async function supprMatiere(m) {
    const cmIds = d.cms.filter((x) => x.matiere_id === m.id).map((x) => x.id);
    const evIds = await evaluationsDe(cmIds);
    const nn = await compte('notes', 'evaluation_id', evIds);
    const message =
      'Supprimer la matière ' + m.nom + ' ?\n\n' +
      'Elle sera retirée de ' + cmIds.length + ' classe(s). Seront effacés : ' + evIds.length + ' évaluation(s) et ' + nn + ' note(s).\n' +
      'Cette action est définitive.';
    if (!window.confirm(message)) return;
    await supprimer('matieres', m.id, 'Matière supprimée.');
  }

  async function retirerMatiereClasse(x) {
    const evIds = await evaluationsDe([x.id]);
    const nn = await compte('notes', 'evaluation_id', evIds);
    const message =
      'Retirer ' + nomMatiere(x.matiere_id) + ' de la classe ' + nomClasse(x.classe_id) + ' ?\n\n' +
      'Seront effacés : ' + evIds.length + ' évaluation(s) et ' + nn + ' note(s).\n' +
      'Cette action est définitive.';
    if (!window.confirm(message)) return;
    await supprimer('classe_matieres', x.id, 'Matière retirée de la classe.');
  }

  async function supprPeriode(p) {
    const message =
      'Supprimer la période ' + p.libelle + ' ?\n\n' +
      'Les évaluations qui y sont liées sont conservées, mais sans période.';
    if (!window.confirm(message)) return;
    await supprimer('periodes', p.id, 'Période supprimée.');
  }

  async function supprAnnee(a) {
    if (a.active) {
      ko("Impossible de supprimer l'année active. Activez d'abord une autre année.");
      return;
    }
    const nbClasses = d.classes.filter((c) => c.annee_id === a.id).length;
    const message =
      "Supprimer l'année " + a.libelle + ' ?\n\n' +
      'Seront effacés : ' + nbClasses + ' classe(s) de cette année, avec leurs matières, évaluations, notes et inscriptions, ainsi que ses périodes.\n' +
      'Cette action est définitive.';
    if (!window.confirm(message)) return;
    await supprimer('annees_scolaires', a.id, 'Année supprimée.');
  }

  async function activerAnnee(a) {
    await supabase.from('annees_scolaires').update({ active: false }).eq('etablissement_id', etabId);
    await exec(supabase.from('annees_scolaires').update({ active: true }).eq('id', a.id), 'Année activée.');
  }

  async function retirerMembre(m) {
    const nom = m.profils ? m.profils.nom : m.profil_id;
    const message =
      'Retirer ' + nom + " de l'établissement ?\n\n" +
      'Son compte n’est pas supprimé, mais il n’aura plus accès à cette école. Ses matières seront sans enseignant.';
    if (!window.confirm(message)) return;
    const { error } = await supabase.rpc('retirer_membre', { p_etab: etabId, p_profil: m.profil_id });
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Membre retiré.');
    await charger(etabId);
  }

  // ---------- Année et périodes ----------
  async function creerAnnee(e) {
    e.preventDefault();
    if (!f.anneeLibelle || !f.anneeDebut || !f.anneeFin) { ko('Remplissez tous les champs.'); return; }
    if (d.annees.length > 0) {
      const message =
        'Créer une nouvelle année scolaire désactive l’année actuelle (' +
        (anneeActive ? anneeActive.libelle : '') + ').\n\n' +
        'Les classes et élèves actuels resteront rattachés à l’ancienne année.\n' +
        'Pour ajouter un TRIMESTRE, utilisez plutôt la carte « Périodes ».\n\nContinuer ?';
      if (!window.confirm(message)) return;
    }
    await supabase.from('annees_scolaires').update({ active: false }).eq('etablissement_id', etabId);
    const r = await exec(
      supabase.from('annees_scolaires').insert({
        etablissement_id: etabId, libelle: f.anneeLibelle.trim(),
        date_debut: f.anneeDebut, date_fin: f.anneeFin, active: true,
      }),
      'Année scolaire créée et activée.'
    );
    if (r) set('anneeLibelle', '');
  }

  async function creerPeriode(e) {
    e.preventDefault();
    if (!anneeActive) { ko("Créez d'abord une année scolaire."); return; }
    if (!f.perLibelle || !f.perDebut || !f.perFin) { ko('Remplissez tous les champs.'); return; }
    const r = await exec(
      supabase.from('periodes').insert({
        etablissement_id: etabId, annee_id: anneeActive.id, libelle: f.perLibelle.trim(),
        date_debut: f.perDebut, date_fin: f.perFin,
      }),
      'Période ajoutée.'
    );
    if (r) set('perLibelle', '');
  }

  // ---------- Classes ----------
  async function creerClasse(e) {
    e.preventDefault();
    if (!anneeActive) { ko("Créez d'abord une année scolaire."); return; }
    if (!f.classeNom.trim()) { ko('Donnez un nom à la classe.'); return; }
    const r = await exec(
      supabase.from('classes').insert({
        etablissement_id: etabId, annee_id: anneeActive.id,
        nom: f.classeNom.trim(), niveau: f.classeNiveau.trim() || null,
      }),
      'Classe créée.'
    );
    if (r) { set('classeNom', ''); set('classeNiveau', ''); }
  }

  // ---------- Matières ----------
  async function creerMatiere(e) {
    e.preventDefault();
    if (!f.matNom.trim()) { ko('Donnez un nom à la matière.'); return; }
    const r = await exec(
      supabase.from('matieres').insert({
        etablissement_id: etabId, nom: f.matNom.trim(),
        coefficient: Number(String(f.matCoef).replace(',', '.')) || 1,
      }),
      'Matière créée.'
    );
    if (r) set('matNom', '');
  }

  async function lierMatiere(e) {
    e.preventDefault();
    if (!f.lienClasse || !f.lienMatiere) { ko('Choisissez une classe et une matière.'); return; }
    await exec(
      supabase.from('classe_matieres').insert({
        etablissement_id: etabId, classe_id: f.lienClasse, matiere_id: f.lienMatiere,
        enseignant_id: f.lienEns || null,
      }),
      'Matière rattachée à la classe.'
    );
  }

  async function changerEns(cmId, profilId) {
    await exec(
      supabase.from('classe_matieres').update({ enseignant_id: profilId || null }).eq('id', cmId),
      'Enseignant mis à jour.'
    );
  }

  // ---------- Élèves ----------
  async function ajouterEleve(e) {
    e.preventDefault();
    if (!f.elNom.trim() || !f.elPrenom.trim()) { ko('Nom et prénom obligatoires.'); return; }
    const { data, error } = await supabase
      .from('eleves')
      .insert({
        etablissement_id: etabId, nom: f.elNom.trim(), prenom: f.elPrenom.trim(),
        matricule: f.elMatricule.trim() || null,
      })
      .select('id')
      .single();
    if (error) { ko('Erreur : ' + error.message); return; }
    if (f.elClasse && anneeActive) {
      const { error: e2 } = await supabase
        .from('inscriptions')
        .insert({ eleve_id: data.id, classe_id: f.elClasse, annee_id: anneeActive.id });
      if (e2) { ko('Élève créé, mais inscription impossible : ' + e2.message); await charger(etabId); return; }
    }
    ok('Élève ajouté.');
    setF((p) => ({ ...p, elNom: '', elPrenom: '', elMatricule: '' }));
    await charger(etabId);
  }

  async function importerLot(e) {
    e.preventDefault();
    if (!f.lotClasse || !anneeActive) { ko('Choisissez une classe.'); return; }
    const liste = f.lotTexte
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const p = l.split(/\t|;/).map((x) => x.trim());
        return { etablissement_id: etabId, nom: p[0], prenom: p[1] || '', matricule: p[2] || null };
      })
      .filter((x) => x.nom && x.prenom);
    if (liste.length === 0) { ko('Aucune ligne valide. Format : Nom;Prénom;Matricule'); return; }
    const { data, error } = await supabase.from('eleves').insert(liste).select('id');
    if (error) { ko('Erreur : ' + error.message); return; }
    const { error: e2 } = await supabase
      .from('inscriptions')
      .insert(data.map((x) => ({ eleve_id: x.id, classe_id: f.lotClasse, annee_id: anneeActive.id })));
    if (e2) { ko('Élèves créés, mais inscription impossible : ' + e2.message); await charger(etabId); return; }
    ok(liste.length + ' élèves ajoutés.');
    set('lotTexte', '');
    await charger(etabId);
  }

  // ---------- Personnel et mode ----------
  async function enregistrerMode() {
    const { error } = await supabase.rpc('changer_mode_saisie', { p_etab: etabId, p_mode: mode });
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Mode de saisie enregistré.');
  }

  async function ajouterMembre(e) {
    e.preventDefault();
    if (!f.persEmail.trim()) { ko('Saisissez un email.'); return; }
    const { error } = await supabase.rpc('ajouter_membre', {
      p_etab: etabId, p_email: f.persEmail.trim(), p_role: f.persRole,
    });
    if (error) { ko('Erreur : ' + error.message); return; }
    ok('Membre ajouté.');
    set('persEmail', '');
    await charger(etabId);
  }

  // ---------- Affichage ----------
  const nomClasse = (id) => (d.classes.find((c) => c.id === id) || {}).nom || '—';
  const nomMatiere = (id) => (d.matieres.find((m) => m.id === id) || {}).nom || '—';
  const classeDe = (eleveId) => {
    const ins = d.inscriptions.find((i) => i.eleve_id === eleveId && (!anneeActive || i.annee_id === anneeActive.id));
    return ins ? nomClasse(ins.classe_id) : 'Sans classe';
  };

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

  return (
    <div className="page">
      <Link href="/" className="btn secondaire">← Accueil</Link>

      <div className="card" style={{ marginTop: 12 }}>
        <h1>Gestion — {ctx.etab.nom}</h1>
        <p className="muted">
          Année active : {anneeActive ? anneeActive.libelle : 'aucune (créez-en une dans l’onglet Année)'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ONGLETS.map((o) => (
            <button
              key={o}
              className={o === onglet ? '' : 'secondaire'}
              style={{ marginTop: 0 }}
              onClick={() => { setOnglet(o); setMsg({ texte: '', erreur: false }); }}
            >
              {o}
            </button>
          ))}
        </div>
        {msg.texte && <p className={msg.erreur ? 'erreur' : 'ok'}>{msg.texte}</p>}
      </div>

      {onglet === 'Année' && (
        <>
          <div className="card">
            <h2>Années scolaires</h2>
            <table>
              <tbody>
                {d.annees.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.libelle}
                      <div className="muted">{a.active ? 'active' : 'inactive'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!a.active && (
                        <button
                          type="button"
                          className="secondaire"
                          style={{ marginTop: 0, marginRight: 6, padding: '6px 12px', fontSize: '.85rem' }}
                          onClick={() => activerAnnee(a)}
                        >
                          Activer
                        </button>
                      )}
                      <BoutonSuppr onClick={() => supprAnnee(a)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Nouvelle année scolaire</h2>
            <p className="muted">À créer une seule fois par an. Pour un trimestre, utilisez la carte « Périodes » plus bas.</p>
            <form onSubmit={creerAnnee}>
              <label>Libellé (ex : 2026-2027)</label>
              <input value={f.anneeLibelle} onChange={(e) => set('anneeLibelle', e.target.value)} />
              <label>Date de début</label>
              <input type="date" value={f.anneeDebut} onChange={(e) => set('anneeDebut', e.target.value)} />
              <label>Date de fin</label>
              <input type="date" value={f.anneeFin} onChange={(e) => set('anneeFin', e.target.value)} />
              <button type="submit">Créer l'année</button>
            </form>
          </div>

          <div className="card">
            <h2>Périodes (trimestres, semestres)</h2>
            <table>
              <tbody>
                {d.periodes.filter((p) => !anneeActive || p.annee_id === anneeActive.id).map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.libelle}
                      <div className="muted">{p.date_debut} → {p.date_fin}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <BoutonSuppr onClick={() => supprPeriode(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form onSubmit={creerPeriode}>
              <label>Libellé (ex : Trimestre 1)</label>
              <input value={f.perLibelle} onChange={(e) => set('perLibelle', e.target.value)} />
              <label>Début</label>
              <input type="date" value={f.perDebut} onChange={(e) => set('perDebut', e.target.value)} />
              <label>Fin</label>
              <input type="date" value={f.perFin} onChange={(e) => set('perFin', e.target.value)} />
              <button type="submit">Ajouter la période</button>
            </form>
          </div>
        </>
      )}

      {onglet === 'Classes' && (
        <div className="card">
          <h2>Nouvelle classe</h2>
          <form onSubmit={creerClasse}>
            <label>Nom (ex : 6e A)</label>
            <input value={f.classeNom} onChange={(e) => set('classeNom', e.target.value)} />
            <label>Niveau (facultatif)</label>
            <input value={f.classeNiveau} onChange={(e) => set('classeNiveau', e.target.value)} />
            <button type="submit">Créer la classe</button>
          </form>
          <table style={{ marginTop: 12 }}>
            <tbody>
              {d.classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.nom}
                    <div className="muted">
                      {d.inscriptions.filter((i) => i.classe_id === c.id).length} élèves,{' '}
                      {d.cms.filter((x) => x.classe_id === c.id).length} matières
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <BoutonSuppr onClick={() => supprClasse(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'Matières' && (
        <>
          <div className="card">
            <h2>Nouvelle matière</h2>
            <form onSubmit={creerMatiere}>
              <label>Nom (ex : Mathématiques)</label>
              <input value={f.matNom} onChange={(e) => set('matNom', e.target.value)} />
              <label>Coefficient</label>
              <input inputMode="decimal" value={f.matCoef} onChange={(e) => set('matCoef', e.target.value)} />
              <button type="submit">Créer la matière</button>
            </form>
            <table style={{ marginTop: 12 }}>
              <tbody>
                {d.matieres.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.nom}
                      <div className="muted">coefficient {m.coefficient}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <BoutonSuppr onClick={() => supprMatiere(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Rattacher une matière à une classe</h2>
            <form onSubmit={lierMatiere}>
              <label>Classe</label>
              <select value={f.lienClasse} onChange={(e) => set('lienClasse', e.target.value)}>
                <option value="">— choisir —</option>
                {d.classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <label>Matière</label>
              <select value={f.lienMatiere} onChange={(e) => set('lienMatiere', e.target.value)}>
                <option value="">— choisir —</option>
                {d.matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <label>Enseignant (facultatif)</label>
              <select value={f.lienEns} onChange={(e) => set('lienEns', e.target.value)}>
                <option value="">Pas d'enseignant</option>
                {enseignants.map((en) => (
                  <option key={en.profil_id} value={en.profil_id}>{en.profils ? en.profils.nom : en.profil_id}</option>
                ))}
              </select>
              <button type="submit">Rattacher</button>
            </form>
          </div>

          <div className="card">
            <h2>Matières par classe</h2>
            {d.classes.map((c) => (
              <div key={c.id} style={{ marginBottom: 16 }}>
                <strong>{c.nom}</strong>
                {d.cms.filter((x) => x.classe_id === c.id).length === 0 && (
                  <p className="muted">Aucune matière.</p>
                )}
                {d.cms.filter((x) => x.classe_id === c.id).map((x) => (
                  <div key={x.id} className="ligne" style={{ padding: '6px 0' }}>
                    <span>{nomMatiere(x.matiere_id)}</span>
                    <select
                      style={{ maxWidth: 200 }}
                      value={x.enseignant_id || ''}
                      onChange={(e) => changerEns(x.id, e.target.value)}
                    >
                      <option value="">Pas d'enseignant</option>
                      {enseignants.map((en) => (
                        <option key={en.profil_id} value={en.profil_id}>{en.profils ? en.profils.nom : en.profil_id}</option>
                      ))}
                    </select>
                    <BoutonSuppr onClick={() => retirerMatiereClasse(x)}>Retirer</BoutonSuppr>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {onglet === 'Élèves' && (
        <>
          <div className="card">
            <h2>Ajouter un élève</h2>
            <form onSubmit={ajouterEleve}>
              <label>Nom</label>
              <input value={f.elNom} onChange={(e) => set('elNom', e.target.value)} />
              <label>Prénom</label>
              <input value={f.elPrenom} onChange={(e) => set('elPrenom', e.target.value)} />
              <label>Matricule (facultatif)</label>
              <input value={f.elMatricule} onChange={(e) => set('elMatricule', e.target.value)} />
              <label>Classe</label>
              <select value={f.elClasse} onChange={(e) => set('elClasse', e.target.value)}>
                <option value="">— choisir —</option>
                {d.classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <button type="submit">Ajouter</button>
            </form>
          </div>

          <div className="card">
            <h2>Ajouter plusieurs élèves d'un coup</h2>
            <p className="muted">
              Une ligne par élève : Nom;Prénom;Matricule (le matricule est facultatif).
              Vous pouvez aussi copier-coller des colonnes depuis Excel.
            </p>
            <form onSubmit={importerLot}>
              <label>Classe</label>
              <select value={f.lotClasse} onChange={(e) => set('lotClasse', e.target.value)}>
                <option value="">— choisir —</option>
                {d.classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <label>Liste</label>
              <textarea rows={6} value={f.lotTexte} onChange={(e) => set('lotTexte', e.target.value)}
                placeholder={'Diallo;Fatoumata;M010\nBah;Ibrahima;M011'} />
              <button type="submit">Importer</button>
            </form>
          </div>

          <div className="card">
            <h2>Élèves ({d.eleves.length})</h2>
            <table>
              <tbody>
                {d.eleves.map((el) => (
                  <tr key={el.id}>
                    <td>
                      {el.nom} {el.prenom}
                      <div className="muted">
                        {el.matricule ? el.matricule + ' · ' : ''}{classeDe(el.id)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <BoutonSuppr onClick={() => supprEleve(el)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {onglet === 'Personnel' && (
        <>
          <div className="card">
            <h2>Mode de saisie</h2>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="radio" style={{ width: 'auto', marginTop: 4 }} checked={mode === 'administration'}
                onChange={() => setMode('administration')} />
              <span>
                <strong>L'administration s'occupe de tout.</strong><br />
                Seuls les administrateurs saisissent les notes, absences et appréciations.
              </span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="radio" style={{ width: 'auto', marginTop: 4 }} checked={mode === 'enseignants'}
                onChange={() => setMode('enseignants')} />
              <span>
                <strong>Chaque enseignant gère sa matière.</strong><br />
                Il saisit les notes de ses matières et les absences de ses classes.
              </span>
            </label>
            <button onClick={enregistrerMode}>Enregistrer le mode</button>
          </div>

          <div className="card">
            <h2>Personnel de l'établissement</h2>
            <table>
              <tbody>
                {d.membres.map((m) => (
                  <tr key={m.profil_id}>
                    <td>
                      {m.profils ? m.profils.nom : m.profil_id}
                      <div className="muted">{m.role === 'admin' ? 'administrateur' : 'enseignant'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.profil_id !== user.id && (
                        <BoutonSuppr onClick={() => retirerMembre(m)}>Retirer</BoutonSuppr>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Ajouter un membre du personnel</h2>
            <p className="muted">
              Le compte (email et mot de passe) doit déjà exister. Pour l'instant, il se crée dans
              Supabase (Authentication, Users). Ensuite, rattachez-le ici par son email.
            </p>
            <form onSubmit={ajouterMembre}>
              <label>Email</label>
              <input type="email" value={f.persEmail} onChange={(e) => set('persEmail', e.target.value)} />
              <label>Rôle</label>
              <select value={f.persRole} onChange={(e) => set('persRole', e.target.value)}>
                <option value="enseignant">Enseignant</option>
                <option value="admin">Administrateur</option>
              </select>
              <button type="submit">Ajouter</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
// FIN DU FICHIER
