"use client";
import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
export default function Login() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState("");
  return (
    <main className="login-shell">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (res.ok) location.href = "/dashboard";
          else setError((await res.json()).error);
        }}
      >
        <div className="brand-icon">
          <ShieldCheck />
        </div>
        <p className="eyebrow">NORTHSTAR · LEAD INTELLIGENCE</p>
        <h1>Velkommen tilbage.</h1>
        <p>Log ind til jeres fælles arbejdsrum.</p>
        <label>
          Adgangskode
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary">
          Åbn dashboard <ArrowRight size={16} />
        </button>
      </form>
    </main>
  );
}
