'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';

export default function PageClasse() {
  const { id } = useParams();
  const { ready } = useAuth();
  const [classe, setClasse] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [form, setForm] = useState({
    eleve_id: '', type: 'absence', date_absence: new Date().toISOString().slice(0, 10),
    duree_minutes: '', justifiee: false, motif: '',
  });
  const [msg, setMsg] = useState('');

  async function charger() {
    const { data: c } = await supabase
      .from('classes').select('id, nom, etablissement_id').eq('id', id).single();
    setClasse(c);

    const { data: ins } = await supabase
      .from('inscriptions').select('eleves(id, nom, prenom, matricule)').eq('classe_id', id);
    const liste = (ins || []).map((i) => i.eleves).sort((a, b) => a.nom.localeCompare(b.nom));
    setEleves(liste);

    if (liste.length > 0) {
      const { data: ab } = await supabase
        .from('absences')
        .select('id, eleve_id, date_absence, type, duree_minutes, justifiee, motif')
        .in('eleve_id', liste.map((e) => e.id))
        .order('date_absence', { ascending: false })
        .limit(20);
      setAbsences(ab || []);
    }
  }

  useEffect(() => {
    if (ready) charger();
    // eslint-disable-next-line
  }, [ready, id]);

  function nomEleve(eid) {
    const e = eleves.find((x) => x.id === eid);
    return e ? `${e.prenom} ${e.nom}` : '';
  }

  async function enregistrerAbsence(e) {
    e.preventDefault();
    setMsg('');
    if (!form.eleve_id) { setMsg('Choisissez un élève.'); return; }
    const { error } = await supabase.from('absences').insert({
      etablissement_id: classe.etablissement_id,
      eleve_id: form.eleve_id,
      type: form.type,
      date_absence: form.date_absence,
      duree_minutes: form.duree_minutes ? Number(form.duree_minutes) : null,
      justifiee: form.justifiee,
      motif: form.motif || null,
    });
    if (error) { setMsg('Erreur : ' + error.message); return; }
    setMsg('Enregistré.');
    setForm({ ...form, duree_minutes: '', motif: '', justifiee: false });
    charger();
  }

  return (
    <div className="page">
      <Link href="/" className="btn secondaire">← Classes</Link>

      <div className="card" style={{ marginTop: 12 }}>
        <h1>Classe {classe?.nom}</h1>
        <Link href={`/classe/${id}/notes`} className="btn">Saisir les notes</Link>
      </div>

      <div className="card">
        <h2>Élèves ({eleves.length})</h2>
        <table>
          <tbody>
            {eleves.map((el) => (
              <tr key={el.id}>
                <td>{el.nom} {el.prenom}</td>
                <td className="muted">{el.matricule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Enregistrer une absence ou un retard</h2>
        <form onSubmit={enregistrerAbsence}>
          <label>Élève</label>
          <select value={form.eleve_id} onChange={(e) => setForm({ ...form, eleve_id: e.target.value })}>
            <option value="">— choisir —</option>
            {eleves.map((el) => (
              <option key={el.id} value={el.id}>{el.nom} {el.prenom}</option>
            ))}
          </select>
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="absence">Absence</option>
            <option value="retard">Retard</option>
          </select>
          <label>Date</label>
          <input type="date" value={form.date_absence} onChange={(e) => setForm({ ...form, date_absence: e.target.value })} />
          <label>Durée en minutes (facultatif)</label>
          <input type="number" value={form.duree_minutes} onChange={(e) => setForm({ ...form, duree_minutes: e.target.value })} />
          <label>Motif (facultatif)</label>
          <input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          <label>
            <input type="checkbox" checked={form.justifiee} onChange={(e) => setForm({ ...form, justifiee: e.target.checked })} />{' '}
            Justifiée
          </label>
          <button type="submit">Enregistrer</button>
          {msg && <p className={msg.startsWith('Erreur') || msg.startsWith('Choisissez') ? 'erreur' : 'ok'}>{msg}</p>}
        </form>
      </div>

      <div className="card">
        <h2>Dernières absences et retards</h2>
        {absences.length === 0 && <p className="muted">Aucune pour l'instant.</p>}
        <table>
          <tbody>
            {absences.map((a) => (
              <tr key={a.id}>
                <td>{a.date_absence}</td>
                <td>{nomEleve(a.eleve_id)}</td>
                <td>{a.type}{a.duree_minutes ? ` (${a.duree_minutes} min)` : ''}</td>
                <td className="muted">{a.justifiee ? 'justifiée' : 'non justifiée'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
