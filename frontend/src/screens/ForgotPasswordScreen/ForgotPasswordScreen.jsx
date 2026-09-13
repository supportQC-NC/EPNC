// src/screens/ForgotPasswordScreen/ForgotPasswordScreen.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForgotPasswordMutation } from "../../slices/userApiSlice";
import "../auth.css";
import { messageErreur } from "../../utils/erreurApi";

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await forgotPassword({ email }).unwrap();
      // Le serveur répond la même chose que le compte existe ou non : on
      // affiche sa réponse telle quelle, sans chercher à en dire plus. Laisser
      // deviner qu'une adresse est inscrite transformerait ce formulaire en
      // annuaire.
      setMessage(res.message);
    } catch (err) {
      setError(messageErreur(err, "Envoi impossible. Réessayez plus tard."));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-carte">
        <div className="auth-entete">
          <h1>Mot de passe oublié</h1>
          <p>
            Indiquez votre adresse email : nous vous envoyons un lien pour en
            choisir un nouveau.
          </p>
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

          <div className="auth-actions">
            <button
              type="submit"
              className="btn btn-principal btn-bloc"
              disabled={isLoading}
            >
              {isLoading ? "Envoi…" : "Envoyer le lien"}
            </button>
          </div>
        </form>

        <div className="auth-pied">
          <p>
            <Link to="/login">Revenir à la connexion</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
