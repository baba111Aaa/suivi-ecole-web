:root{--primaire:#4f46e5;--primaire-fonce:#3730a3;--accent:#06b6d4;--fond:#eef2ff;--texte:#1e293b;--gris:#64748b;--ok:#059669;--erreur:#dc2626}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--fond);color:var(--texte);min-height:100vh}
body::before{content:"";position:fixed;top:0;left:0;right:0;height:190px;background:linear-gradient(135deg,#4f46e5,#7c3aed,#06b6d4);z-index:-1}
.page{max-width:900px;margin:0 auto;padding:20px 16px 48px}
.card{background:#fff;border-radius:16px;padding:18px;margin-bottom:16px;box-shadow:0 6px 20px rgba(79,70,229,.12);border-top:4px solid var(--accent)}
.card:nth-of-type(2n){border-top-color:#7c3aed}
.card:nth-of-type(3n){border-top-color:#f59e0b}
h1{font-size:1.45rem;margin:0 0 6px;color:var(--primaire-fonce)}
h2{font-size:1.1rem;margin:0 0 12px;color:var(--primaire)}
label{display:block;font-size:.85rem;font-weight:600;margin:10px 0 4px;color:var(--gris)}
input,select,textarea{width:100%;padding:11px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:1rem;background:#f8fafc;color:var(--texte);font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--primaire);box-shadow:0 0 0 3px rgba(79,70,229,.18);background:#fff}
input[type="checkbox"]{width:auto;accent-color:var(--primaire);transform:scale(1.2)}
input[type="radio"]{accent-color:var(--primaire)}
button,.btn{display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:0;border-radius:12px;padding:11px 18px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none;margin-top:14px;box-shadow:0 4px 12px rgba(79,70,229,.3)}
button.secondaire,.btn.secondaire{background:#e0e7ff;color:var(--primaire-fonce);box-shadow:none}
.liste a{display:flex;justify-content:space-between;align-items:center;padding:14px 12px;margin-bottom:8px;border-radius:12px;border-left:5px solid var(--accent);background:#f1f5f9;color:var(--texte);font-weight:600;text-decoration:none}
.liste a::after{content:"›";font-size:1.4rem;color:var(--primaire)}
.erreur{color:var(--erreur);background:#fef2f2;padding:8px 12px;border-radius:10px;margin-top:10px}
.ok{color:var(--ok);background:#ecfdf5;padding:8px 12px;border-radius:10px;margin-top:10px}
.muted{color:var(--gris);font-size:.9rem}
table{width:100%;border-collapse:collapse}
td,th{padding:9px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
tbody tr:nth-child(even){background:#f8fafc}
.ligne{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
