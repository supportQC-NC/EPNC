// src/screens/admin/AdminUtilisateurFormScreen.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} from "../../slices/adminApiSlice";
import { ROLES } from "../../constants";
import "./admin.css";
import { messageErreur } from "../../utils/erreurApi";

// Un seul écran pour la création et la modification : les deux formulaires
// portent les mêmes champs, et les maintenir en double revient à les laisser
// diverger. La présence d'un `id` dans l'URL décide du mode.
const AdminUtilisateurFormScreen = () => {
  const { id } = useParams();
  const modeEdition = Boolean(id);
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const soiMeme = modeEdition && id === userInfo?._id;

  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    role: "candidat",
    isActive: true,
    password: "",
  });
  const [erreur, setErreur] = useState("");

  const { data: compte, isLoading: chargement } = useGetUserQuery(id, {
    skip: !modeEdition,
  });

  const [creer, { isLoading: creation }] = useCreateUserMutation();
  const [modifier, { isLoading: modification }] = useUpdateUserMutation();

  // Remplit le formulaire dès que le compte arrive. Le mot de passe reste
  // vide : en édition, il ne sert qu'à en imposer un nouveau.
  useEffect(() => {
    if (!compte) return;
    setForm({
      prenom: compte.prenom || "",
      nom: compte.nom || "",
      email: compte.email || "",
      role: compte.role || "candidat",
      isActive: compte.isActive !== false,
      password: "",
    });
  }, [compte]);

  const maj = (champ) => (e) =>
    setForm((prec) => ({
      ...prec,
      [champ]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");

    if (!modeEdition && form.password.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (modeEdition && form.password && form.password.length < 6) {
      setErreur("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    try {
      if (modeEdition) {
        // Champ vide = ne pas toucher au mot de passe. L'envoyer vide
        // déclencherait une validation d'échec côté modèle.
        const { password, ...reste } = form;
        await modifier({ id, ...reste, ...(password ? { password } : {}) }).unwrap();
      } else {
        await creer(form).unwrap();
      }
      navigate("/admin/utilisateurs");
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    }
  };

  if (modeEdition && chargement) {
    return <p role="status">Chargement du compte…</p>;
  }

  const enCours = creation || modification;

  return (
    <>
      <p className="admin-fil">
        <Link to="/admin/utilisateurs">← Retour aux comptes</Link>
      </p>

      <h1 className="admin-titre">
        {modeEdition ? "Modifier le compte" : "Créer un compte"}
      </h1>

      {erreur && (
        <div className="message message-erreur" role="alert">
          {erreur}
        </div>
      )}

      <form className="carte formulaire" onSubmit={soumettre} noValidate>
        <div className="formulaire-duo">
          <div className="champ">
            <label htmlFor="prenom">Prénom</label>
            <input
              id="prenom"
              type="text"
              autoComplete="off"
              value={form.prenom}
              onChange={maj("prenom")}
              required
            />
          </div>

          <div className="champ">
            <label htmlFor="nom">Nom</label>
            <input
              id="nom"
              type="text"
              autoComplete="off"
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
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={maj("email")}
            required
          />
        </div>

        <div className="champ">
          <label htmlFor="role">Rôle</label>
          <select
            id="role"
            value={form.role}
            onChange={maj("role")}
            disabled={soiMeme}
            aria-describedby={soiMeme ? "aide-role" : undefined}
          >
            {ROLES.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.libelle}
              </option>
            ))}
          </select>
          {soiMeme && (
            <span id="aide-role" className="champ-aide">
              Vous ne pouvez pas modifier votre propre rôle : ce serait le moyen
              le plus simple de vous retirer l'accès à cet écran. Demandez à un
              autre administrateur.
            </span>
          )}
        </div>

        <div className="champ">
          <label htmlFor="password">
            {modeEdition ? "Nouveau mot de passe" : "Mot de passe"}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={maj("password")}
            aria-describedby="aide-mdp"
            required={!modeEdition}
          />
          <span id="aide-mdp" className="champ-aide">
            {modeEdition
              ? "Laissez vide pour ne pas le changer. Six caractères minimum sinon."
              : "Six caractères minimum. Communiquez-le de vive voix : aucun email ne l'envoie."}
          </span>
        </div>

        {modeEdition && (
          <div className="champ champ-case">
            <label>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={maj("isActive")}
                disabled={soiMeme}
              />
              Compte actif
            </label>
            <span className="champ-aide">
              Un compte désactivé ne peut plus se connecter, mais son historique
              est conservé. C'est préférable à une suppression dans presque tous
              les cas.
            </span>
          </div>
        )}

        <div className="actions formulaire-actions">
          <button type="submit" className="btn btn-principal" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          <Link to="/admin/utilisateurs" className="btn btn-secondaire">
            Annuler
          </Link>
        </div>
      </form>
    </>
  );
};

export default AdminUtilisateurFormScreen;
