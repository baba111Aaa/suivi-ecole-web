'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

export default function Accueil() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [etab, setEtab] = useState(null);
  const [role, setRole] = useState('');
  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState('Chargement…');

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: m, error } = await supabase
        .from('membres_etablissement')
        .select('role, etablissements(id, nom, mode_saisie)')
        .eq('profil_id', user.id)
        .limit(1);

      if (error) { setMessage('Erreur : ' + error.message); return; }

      // Pas membre d'une école : c'est un parent, direction son espace
      if (!m || m.length === 0) { router.replace('/parent'); return; }

      setEtab(m[0].etablissements);
      setRole(m[0].role);

      const { data: cl } = await supabase
        .from('classes')
        .select('id, nom, niveau')
        .eq('etablissement_id', m[0].etablissements.id)
        .order('nom');
      setClasses(cl || []);
      setMessage('');
    })();
  }, [ready, user]);

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const libelleMode =
    etab && etab.mode_saisie === 'enseignants'
      ? 'Saisie par les enseignants'
      : "Saisie par l'administration";

  return (
    <div className="page">
      <div className="card ligne">
        <div>
          <h1>{etab ? etab.nom : 'Suivi École'}</h1>
          <span className="muted">
            {user?.email}
            {role ? ` · ${role === 'admin' ? 'administrateur' : 'enseignant'}` : ''}
          </span>
          {etab && <div className="muted">{libelleMode}</div>}
        </div>
        <button className="secondaire" onClick={deconnexion}>Déconnexion</button>
      </div>

      {role === 'admin' && (
        <div className="card">
          <Link href="/gestion" className="btn" style={{ marginTop: 0 }}>
            Gestion de l'établissement
          </Link>
          <p className="muted">Année, classes, matières, élèves et personnel.</p>
          <Link href="/gestion/parents" className="btn" style={{ marginTop: 0 }}>
            Parents et annonces
          </Link>
          <p className="muted">Codes d'invitation pour les parents, annonces.</p>
        </div>
      )}

      <div className="card">
        <h2>Classes</h2>
        {message && <p className="muted">{message}</p>}
        <div className="liste">
          {classes.map((c) => (
            <Link key={c.id} href={`/classe/${c.id}`}>
              {c.nom} {c.niveau ? `(${c.niveau})` : ''}
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <Link href="/parent" className="btn secondaire" style={{ marginTop: 0 }}>
          Mon espace parent
        </Link>
      </div>
    </div>
  );
}
// FIN DU FICHIER

