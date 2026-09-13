// src/screens/LoginScreen/LoginScreen.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useLoginMutation } from "../../slices/userApiSlice";
import { setCredentials } from "../../slices/authSlice";
import "../auth.css";
import { messageErreur } from "../../utils/erreurApi";

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [login, { isLoading }] = useLoginMutation();

  // PrivateRoute mémorise la page demandée avant la redirection : on y revient
  // après connexion plutôt que d'atterrir systématiquement sur l'accueil.
  const destination = location.state?.from?.pathname || "/espace";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await login({ email, password }).unwrap();
      dispatch(setCredentials(res));
      navigate(destination, { replace: true });
    } catch (err) {
      setError(messageErreur(err, "Connexion impossible. Vérifiez vos identifiants."));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-carte">
        <div className="auth-entete">
          <h1>Se connecter</h1>
          <p>Retrouvez vos rapprochements et vos candidatures en cours.</p>
        </div>

        {/* role="alert" : le message est annoncé par les lecteurs d'écran dès
            son apparition, sans qu'il faille le chercher. */}
        {error && (
          <div className="message message-erreur" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="champ">
            <label htmlFor="email">Adresse email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.nc"
              required
            />
          </div>

          <div className="champ">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Link to="/mot-de-passe-oublie" className="auth-lien-oubli">
            Mot de passe oublié ?
          </Link>

          <div className="auth-actions">
            <button
              type="submit"
              className="btn btn-principal btn-bloc"
              disabled={isLoading}
            >
              {isLoading ? "Connexion…" : "Se connecter"}
            </button>
          </div>
        </form>

        <div className="auth-pied">
          <p>
            Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
