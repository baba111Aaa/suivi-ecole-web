'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

// Vérifie que l'utilisateur est connecté, sinon renvoie vers /login
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
      } else {
        setUser(data.session.user);
        setReady(true);
      }
    });
  }, [router]);

  return { user, ready };
}
