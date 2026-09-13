// src/screens/EspaceScreen/EspaceScreen.jsx
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetProfilQuery } from "../../slices/profilApiSlice";
import { useGetCandidaturesQuery } from "../../slices/candidatureApiSlice";
import { STATUTS } from "../../constants";
import "./EspaceScreen.css";

// Point d'entrée après connexion. Il répond à une seule question : qu'est-ce
// que j'ai à faire maintenant ? D'où l'ordre — d'abord ce qui bloque (profil
// incomplet), ensuite les dossiers en cours.
const EspaceScreen = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { data: profil } = useGetProfilQuery();
  const { data: suivi } = useGetCandidaturesQuery();

  const completude = profil?.completude ?? 0;
  const aDesDossiers = (suivi?.total ?? 0) > 0;
  const enCours = suivi
    ? (suivi.parStatut.brouillon || 0) + (suivi.parStatut.prete || 0)
    : 0;

  return (
    <div className="conteneur espace">
      <h1>Bonjour {userInfo?.prenom}</h1>

      {/* ── Ce qu'il y a à faire ─────────────────────────────────────── */}
      {completude < 60 && (
        <section className="espace-action">
          <h2>
            {completude === 0
              ? "Commencez par votre profil"
              : "Votre profil mérite d'être complété"}
          </h2>
          <p>
            {completude === 0
              ? "Sans profil, rien ne peut être produit. Comptez dix minutes, une seule fois."
              : `Il est rempli à ${completude} %. Plus il est précis, plus les rapprochements et les documents le sont.`}
          </p>
          <Link to="/profil" className="btn btn-principal">
            {completude === 0 ? "Remplir mon profil" : "Compléter mon profil"}
          </Link>
        </section>
      )}

      {/* ── Mes chiffres ─────────────────────────────────────────────── */}
      <div className="espace-cartes">
        <section className="espace-carte">
          <h2>Mon profil</h2>
          <p className="espace-chiffre">{completude}%</p>
          <p className="espace-precision">complété</p>
          <Link to="/profil">Ouvrir mon profil</Link>
        </section>

        <section className="espace-carte">
          <h2>Mes candidatures</h2>
          <p className="espace-chiffre">{suivi?.total ?? 0}</p>
          <p className="espace-precision">
            {enCours > 0 ? `dont ${enCours} à finir` : "dossiers au total"}
          </p>
          <Link to="/candidatures">Voir le suivi</Link>
        </section>

        <section className="espace-carte">
          <h2>Postes ouverts</h2>
          <p className="espace-precision espace-precision--seule">
            Les offres de l'OPT-NC, mises à jour à chaque publication.
          </p>
          <Link to="/offres">Parcourir les offres</Link>
        </section>
      </div>

      {/* ── Rappel des statuts en cours ──────────────────────────────── */}
      {aDesDossiers && (
        <section className="espace-statuts">
          <h2>Vos dossiers</h2>
          <ul>
            {STATUTS.filter((s) => suivi.parStatut[s.valeur] > 0).map((s) => (
              <li key={s.valeur}>
                <span>{s.libelle}</span>
                <span className="espace-statut-valeur">
                  {suivi.parStatut[s.valeur]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default EspaceScreen;
