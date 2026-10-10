'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ texte: '', erreur: false });

  async function valider(e) {
    e.preventDefault();
    setMsg({ texte: '', erreur: false });

    if (creation) {
      if (!nom.trim()) { setMsg({ texte: 'Saisissez votre nom.', erreur: true }); return; }
      if (password.length < 6) {
        setMsg({ texte: 'Le mot de passe doit avoir au moins 6 caractères.', erreur: true });
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom: nom.trim() } },
      });
      if (error) { setMsg({ texte: 'Erreur : ' + error.message, erreur: true }); return; }
      if (data.session) {
        router.replace('/');
      } else {
        setMsg({
          texte: 'Compte créé. Vérifiez votre email pour le confirmer, puis connectez-vous.',
          erreur: false,
        });
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg({ texte: 'Email ou mot de passe incorrect.', erreur: true });
    else router.replace('/');
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Suivi École</h1>
        <p className="muted">
          {creation ? 'Créer un compte parent' : 'Connexion'}
        </p>
        <form onSubmit={valider}>
          {creation && (
            <>
              <label>Votre nom</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} />
            </>
          )}
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">{creation ? 'Créer mon compte' : 'Se connecter'}</button>
          {msg.texte && <p className={msg.erreur ? 'erreur' : 'ok'}>{msg.texte}</p>}
        </form>
        <button
          type="button"
          className="secondaire"
          onClick={() => { setCreation(!creation); setMsg({ texte: '', erreur: false }); }}
        >
          {creation ? 'J’ai déjà un compte' : 'Parent : créer un compte'}
        </button>
      </div>
    </div>
  );
}
// FIN DU FICHIER
