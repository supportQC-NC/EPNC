// src/screens/ResetPasswordScreen/ResetPasswordScreen.jsx
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useResetPasswordMutation } from "../../slices/userApiSlice";
import "../auth.css";
import { messageErreur } from "../../utils/erreurApi";

const ResetPasswordScreen = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    try {
      await resetPassword({ token, password }).unwrap();
      setMessage("Mot de passe modifié. Redirection vers la connexion…");
      // Petit délai volontaire : sans lui, le message de confirmation
      // disparaîtrait avant d'avoir pu être lu — a fortiori par un lecteur
      // d'écran.
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      setError(
        messageErreur(
          err,
          "Lien invalide ou expiré. Refaites une demande de réinitialisation.",
        ),
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-carte">
        <div className="auth-entete">
          <h1>Nouveau mot de passe</h1>
          <p>Choisissez un mot de passe que vous n'utilisez pas ailleurs.</p>
        </div>

        {error && (
          <div className="message message-erreur" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="message message-succes" role="status">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="champ">
            <label htmlFor="password">Nouveau mot de passe</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="aide-mdp"
              required
            />
            <span id="aide-mdp" className="champ-aide">
              6 caractères minimum.
            </span>
          </div>

          <div className="champ">
            <label htmlFor="confirmation">Confirmer le mot de passe</label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </div>

          <div className="auth-actions">
            <button
              type="submit"
              className="btn btn-principal btn-bloc"
              disabled={isLoading}
            >
              {isLoading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>

        <div className="auth-pied">
          <p>
            <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
