'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../lib/useAuth';

export default function PageNotes() {
  const { id } = useParams();
  const { ready } = useAuth();
  const [classe, setClasse] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [cmId, setCmId] = useState('');
  const [evals, setEvals] = useState([]);
  const [evalId, setEvalId] = useState('');
  const [lignes, setLignes] = useState({});
  const [nouveau, setNouveau] = useState({ titre: '', type: 'devoir', bareme: 20 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: c } = await supabase
        .from('classes').select('id, nom, etablissement_id').eq('id', id).single();
      setClasse(c);

      const { data: ins } = await supabase
        .from('inscriptions').select('eleves(id, nom, prenom)').eq('classe_id', id);
      setEleves((ins || []).map((i) => i.eleves).sort((a, b) => a.nom.localeCompare(b.nom)));

      const { data: cm } = await supabase
        .from('classe_matieres').select('id, matieres(nom)').eq('classe_id', id);
      setMatieres(cm || []);
    })();
  }, [ready, id]);

  async function chargerEvals(cm) {
    setCmId(cm);
    setEvalId('');
    setLignes({});
    setMsg('');
    if (!cm) { setEvals([]); return; }
    const { data } = await supabase
      .from('evaluations')
      .select('id, titre, type, date_evaluation, bareme')
      .eq('classe_matiere_id', cm)
      .order('date_evaluation', { ascending: false });
    setEvals(data || []);
  }

  async function choisirEval(eid) {
    setEvalId(eid);
    setMsg('');
    if (!eid) { setLignes({}); return; }
    const { data } = await supabase
      .from('notes').select('eleve_id, valeur, publiee').eq('evaluation_id', eid);
    const l = {};
    (data || []).forEach((n) => {
      l[n.eleve_id] = { valeur: n.valeur === null ? '' : String(n.valeur), publiee: n.publiee };
    });
    setLignes(l);
  }

  async function creerEval(e) {
    e.preventDefault();
    if (!nouveau.titre || !cmId) return;
    const { data, error } = await supabase
      .from('evaluations')
      .insert({
        etablissement_id: classe.etablissement_id,
        classe_matiere_id: cmId,
        titre: nouveau.titre,
        type: nouveau.type,
        bareme: Number(nouveau.bareme) || 20,
      })
      .select()
      .single();
    if (error) { setMsg('Erreur : ' + error.message); return; }
    setNouveau({ ...nouveau, titre: '' });
    await chargerEvals(cmId);
    await choisirEval(data.id);
  }

  function modifier(eleveId, champ, val) {
    setLignes((prev) => ({
      ...prev,
      [eleveId]: { valeur: '', publiee: false, ...prev[eleveId], [champ]: val },
    }));
  }

  async function enregistrer(publierTout) {
    const rows = [];
    for (const el of eleves) {
      const l = lignes[el.id];
      if (!l || l.valeur === '') continue;
      const valeur = Number(String(l.valeur).replace(',', '.'));
      if (Number.isNaN(valeur)) { setMsg(`Note invalide pour ${el.prenom} ${el.nom}.`); return; }
      rows.push({
        etablissement_id: classe.etablissement_id,
        evaluation_id: evalId,
        eleve_id: el.id,
        valeur,
        publiee: publierTout ? true : !!l.publiee,
      });
    }
    if (rows.length === 0) { setMsg('Aucune note à enregistrer.'); return; }
    const { error } = await supabase
      .from('notes').upsert(rows, { onConflict: 'evaluation_id,eleve_id' });
    if (error) { setMsg('Erreur : ' + error.message); return; }
    await choisirEval(evalId);
    setMsg(publierTout ? 'Notes enregistrées et publiées.' : 'Notes enregistrées.');
  }

  const evalCourante = evals.find((x) => x.id === evalId);
  const estErreur = msg.startsWith('Erreur') || msg.startsWith('Note invalide') || msg.startsWith('Aucune');

  return (
    <div className="page">
      <Link href={`/classe/${id}`} className="btn secondaire">← Classe {classe?.nom}</Link>

      <div className="card" style={{ marginTop: 12 }}>
        <h1>Saisie des notes</h1>
        <label>Matière</label>
        <select value={cmId} onChange={(e) => chargerEvals(e.target.value)}>
          <option value="">— choisir —</option>
          {matieres.map((m) => (
            <option key={m.id} value={m.id}>{m.matieres?.nom}</option>
          ))}
        </select>
        {matieres.length === 0 && (
          <p className="muted">Aucune matière rattachée à cette classe.</p>
        )}
      </div>

      {cmId && (
        <div className="card">
          <h2>Évaluation</h2>
          <select value={evalId} onChange={(e) => choisirEval(e.target.value)}>
            <option value="">— choisir une évaluation —</option>
            {evals.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.titre} ({ev.date_evaluation})</option>
            ))}
          </select>

          <form onSubmit={creerEval} style={{ marginTop: 16 }}>
            <label>Ou créer une nouvelle évaluation</label>
            <input placeholder="Titre (ex : Devoir 2)" value={nouveau.titre}
              onChange={(e) => setNouveau({ ...nouveau, titre: e.target.value })} />
            <label>Type</label>
            <select value={nouveau.type} onChange={(e) => setNouveau({ ...nouveau, type: e.target.value })}>
              <option value="devoir">Devoir</option>
              <option value="composition">Composition</option>
              <option value="interrogation">Interrogation</option>
            </select>
            <label>Barème (sur combien)</label>
            <input type="number" value={nouveau.bareme}
              onChange={(e) => setNouveau({ ...nouveau, bareme: e.target.value })} />
            <button type="submit" className="secondaire">Créer</button>
          </form>
        </div>
      )}

      {evalId && (
        <div className="card">
          <h2>{evalCourante?.titre} — sur {evalCourante?.bareme}</h2>
          <table>
            <thead>
              <tr><th>Élève</th><th>Note</th><th>Publiée</th></tr>
            </thead>
            <tbody>
              {eleves.map((el) => (
                <tr key={el.id}>
                  <td>{el.nom} {el.prenom}</td>
                  <td style={{ width: 90 }}>
                    <input inputMode="decimal" value={lignes[el.id]?.valeur ?? ''}
                      onChange={(e) => modifier(el.id, 'valeur', e.target.value)} />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!lignes[el.id]?.publiee}
                      onChange={(e) => modifier(el.id, 'publiee', e.target.checked)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => enregistrer(false)} className="secondaire">Enregistrer (brouillon)</button>{' '}
          <button onClick={() => enregistrer(true)}>Enregistrer et publier tout</button>
          <p className="muted">Une note non publiée reste invisible pour les parents.</p>
          {msg && <p className={estErreur ? 'erreur' : 'ok'}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
