// src/screens/RegisterScreen/RegisterScreen.jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useRegisterMutation } from "../../slices/userApiSlice";
import { setCredentials } from "../../slices/authSlice";
import { messageErreur } from "../../utils/erreurApi";
import ChampMotDePasse from "../../components/Form/ChampMotDePasse";
import "../auth.css";

const LONGUEUR_MINI = 6;

const RegisterScreen = () => {
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");
  // Le consentement n'est PAS dans `form` : il n'est pas envoyé au serveur et
  // ne doit pas l'être. Ce qui compte est qu'il ait été donné ici, en toute
  // connaissance — l'enregistrer comme une donnée de plus n'ajouterait rien.
  const [accepte, setAccepte] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [register, { isLoading }] = useRegisterMutation();

  // Quelqu'un qui s'inscrit depuis une offre doit revenir SUR cette offre, pas
  // atterrir sur un espace vide : c'est la fiche qu'il voulait lire.
  const destination = location.state?.from?.pathname || "/espace";

  const maj = (champ) => (e) =>
    setForm((prec) => ({ ...prec, [champ]: e.target.value }));

  // Retours affichés PENDANT la frappe, et seulement une fois le champ
  // commencé : signaler « trop court » sur un champ vide revient à reprocher à
  // quelqu'un de ne pas avoir encore tapé.
  const restant = LONGUEUR_MINI - form.password.length;

  const etatMotDePasse = !form.password
    ? null
    : restant > 0
      ? {
          type: "erreur",
          message: `Encore ${restant} caractère${restant > 1 ? "s" : ""}.`,
        }
      : { type: "ok", message: "Longueur suffisante." };

  const etatConfirmation = !form.confirmation
    ? null
    : form.confirmation === form.password
      ? { type: "ok", message: "Les deux mots de passe correspondent." }
      : { type: "erreur", message: "Les deux mots de passe diffèrent." };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!accepte) {
      setError(
        "Pour créer un compte, il faut avoir pris connaissance des conditions et de l'usage fait de vos données.",
      );
      return;
    }

    // Le serveur refait ces contrôles — c'est lui qui fait autorité. Ceux-ci
    // évitent seulement un aller-retour inutile.
    if (form.password.length < LONGUEUR_MINI) {
      setError(
        `Le mot de passe doit contenir au moins ${LONGUEUR_MINI} caractères.`,
      );
      return;
    }
    if (form.password !== form.confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    try {
      const res = await register({
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        password: form.password,
      }).unwrap();
      dispatch(setCredentials(res));
      navigate(destination, { replace: true });
    } catch (err) {
      setError(messageErreur(err, "Inscription impossible. Réessayez."));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-carte">
        <div className="auth-entete">
          <h1>Créer un compte</h1>
          <p>
            Quelques secondes suffisent. Vous pourrez décrire votre parcours
            juste après — avec ou sans CV.
          </p>
        </div>

        {error && (
          <div className="message message-erreur" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-duo">
            <div className="champ">
              <label htmlFor="prenom">Prénom</label>
              <input
                id="prenom"
                name="prenom"
                type="text"
                autoComplete="given-name"
                value={form.prenom}
                onChange={maj("prenom")}
                required
              />
            </div>

            <div className="champ">
              <label htmlFor="nom">Nom</label>
              <input
                id="nom"
                name="nom"
                type="text"
                autoComplete="family-name"
                value={form.nom}
                onChange={maj("nom")}
                required
              />
            </div>
          </div>

          <div className="champ">
            <label htmlFor="email">Adresse email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={maj("email")}
              placeholder="vous@exemple.nc"
              required
            />
          </div>

          <ChampMotDePasse
            id="password"
            label="Mot de passe"
            valeur={form.password}
            onChange={maj("password")}
            aide={`${LONGUEUR_MINI} caractères minimum.`}
            etat={etatMotDePasse}
          />

          <ChampMotDePasse
            id="confirmation"
            label="Confirmer le mot de passe"
            valeur={form.confirmation}
            onChange={maj("confirmation")}
            etat={etatConfirmation}
          />

          {/* ══════════════════════════════════════════════════════════
              LE CONSENTEMENT DIT CE QU'IL ENGAGE
              ══════════════════════════════════════════════════════════
              Une case « j'accepte les CGU » cochée sans rien lire ne vaut
              rien — ni juridiquement, ni moralement. Les trois lignes
              au-dessus disent l'essentiel AVANT la case : ce qui est
              collecté, qui le voit, et le seul point qui peut faire changer
              d'avis — la transmission à un tiers au moment de la rédaction.

              La case n'est PAS pré-cochée : un consentement par défaut n'est
              pas un consentement. */}
          <div className="consentement">
            <p className="consentement-resume">
              Votre compte sert à conserver votre parcours et vos candidatures.{" "}
              <strong>Votre profil n'est visible d'aucun recruteur</strong> tant
              que vous ne l'avez pas décidé. Si vous demandez la rédaction d'une
              lettre ou d'un CV, le contenu de votre profil est alors{" "}
              <strong>transmis à un prestataire tiers</strong> (OpenAI) pour la
              produire.
            </p>

            <label className="consentement-case">
              <input
                type="checkbox"
                checked={accepte}
                onChange={(e) => setAccepte(e.target.checked)}
                required
              />
              <span>
                J'ai pris connaissance des{" "}
                <Link to="/mentions-legales" target="_blank">
                  conditions d'utilisation
                </Link>{" "}
                et de l'
                <Link to="/confidentialite" target="_blank">
                  usage fait de mes données
                </Link>
                .
              </span>
            </label>
          </div>

          <div className="auth-actions">
            <button
              type="submit"
              className="btn btn-principal btn-bloc"
              disabled={isLoading || !accepte}
            >
              {isLoading ? "Création…" : "Créer mon compte"}
            </button>
          </div>
        </form>

        <div className="auth-pied">
          <p>
            Vous avez déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
