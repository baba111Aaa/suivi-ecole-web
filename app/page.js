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
  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState('Chargement…');

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { data: m, error } = await supabase
        .from('membres_etablissement')
        .select('role, etablissements(id, nom)')
        .eq('profil_id', user.id)
        .limit(1);

      if (error || !m || m.length === 0) {
        setMessage("Ce compte n'est rattaché à aucun établissement.");
        return;
      }
      setEtab(m[0].etablissements);

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

  return (
    <div className="page">
      <div className="card ligne">
        <div>
          <h1>{etab ? etab.nom : 'Suivi École'}</h1>
          <span className="muted">{user?.email}</span>
        </div>
        <button className="secondaire" onClick={deconnexion}>Déconnexion</button>
      </div>

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
    </div>
  );
}
