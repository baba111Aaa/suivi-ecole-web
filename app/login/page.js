'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');

  async function connexion(e) {
    e.preventDefault();
    setErreur('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErreur('Email ou mot de passe incorrect.');
    else router.replace('/');
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Suivi École</h1>
        <p className="muted">Espace établissement</p>
        <form onSubmit={connexion}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Se connecter</button>
          {erreur && <p className="erreur">{erreur}</p>}
        </form>
      </div>
    </div>
  );
}
