// src/components/Global/Header/Header.jsx
//
// ══════════════════════════════════════════════════════════════════════════
//  LA NAVIGATION DÉPEND DU RÔLE — C'EST CE QUI LA DÉSENCOMBRE
// ══════════════════════════════════════════════════════════════════════════
// Première version, tous les liens s'affichaient pour tout le monde : un
// recruteur connecté voyait « Correspondances », « Candidatures » et « Profil »
// — trois destinations qui ne le concernent pas — en plus des siennes. Dix
// entrées sur une ligne, dont la moitié inutile.
//
// Ajouter un menu escamotable n'aurait rien réglé : cacher dix liens derrière
// un clic, c'est ranger le désordre dans un tiroir. La vraie correction est de
// ne montrer QUE ce qui concerne la personne connectée.
//
// Ce qui reste visible se limite donc aux destinations de travail (quatre ou
// cinq au plus) ; tout ce qui relève du compte — profil, réglages, déconnexion
// — passe dans un menu sous le nom, où on le cherche naturellement.
//
// Le menu escamotable existe malgré tout, mais pour la raison qui le justifie :
// sous 900 px, quatre liens ne tiennent plus sur une ligne sans repousser le
// contenu sous le pli.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLogoutMutation } from "../../../slices/userApiSlice";
import { logout } from "../../../slices/authSlice";
import { APP_NAME, APP_NAME_COURT, LOGO } from "../../../constants";
import "./Header.css";

// Les destinations de travail, par rôle. `end` évite qu'un chemin parent reste
// marqué actif sur ses enfants.
const NAVIGATION = {
  visiteur: [
    { to: "/offres", libelle: "Les offres" },
    { to: "/metiers", libelle: "Les métiers" },
  ],
  candidat: [
    { to: "/offres", libelle: "Les offres" },
    { to: "/alertes", libelle: "Mes alertes" },
    { to: "/matchs", libelle: "Mes correspondances" },
    { to: "/candidatures", libelle: "Mes candidatures" },
    // ⚠️ Pas d'entrée « Assistant » ici : il est désormais accessible en
    // permanence par la bulle en bas à droite (`BulleAssistant`). Le garder
    // aussi dans la navigation principale aurait allongé une barre déjà
    // dense pour dupliquer un accès qui ne quitte jamais l'écran.
    // L'écran complet — historique, gestion des conversations, avertissement
    // d'usage — reste atteignable depuis le menu du compte et depuis le pied
    // de la bulle.
  ],
  recruteur: [
    { to: "/recruteur", libelle: "Tableau de bord", end: true },
    { to: "/vivier", libelle: "Les candidats", end: true },
    { to: "/alertes", libelle: "Mes alertes" },
    { to: "/recruteur/listes", libelle: "Mes listes" },
  ],
};

// Le menu du compte : ce qui relève de « moi » plutôt que du travail en cours.
const COMPTE = {
  candidat: [
    { to: "/espace", libelle: "Mon espace" },
    { to: "/profil", libelle: "Mon profil" },
    { to: "/assistant", libelle: "Mes conversations" },
    { to: "/metiers", libelle: "Les métiers" },
    { to: "/mes-signalements", libelle: "Modération" },
  ],
  recruteur: [
    { to: "/recruteur/profil", libelle: "Configurer mon profil" },
    { to: "/recruteur/suggestions", libelle: "Profils à regarder" },
    { to: "/offres", libelle: "Les offres" },
    { to: "/mes-signalements", libelle: "Mes signalements" },
  ],
};

const initiales = (user) =>
  [user?.prenom, user?.nom]
    .filter(Boolean)
    .map((m) => m[0]?.toUpperCase())
    .join("") || "?";

const Header = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutApi] = useLogoutMutation();

  const refEntete = useRef(null);
  const refCompte = useRef(null);

  // Le logo est présumé présent, et se retire de lui-même s'il ne charge pas.
  // L'inverse (présumer absent, tester à l'arrivée) ferait clignoter le sigle
  // puis le logo à chaque chargement de page.
  const [logoOk, setLogoOk] = useState(true);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);

  // Publie la hauteur RÉELLE de l'en-tête dans `--h-entete`, que le hero
  // retranche pour tenir exactement dans l'écran.
  //
  // Pourquoi la mesurer plutôt que l'écrire en dur : elle varie avec la taille
  // de police choisie par l'utilisateur, et avec l'ouverture du menu sur petit
  // écran.
  useEffect(() => {
    const el = refEntete.current;
    if (!el) return;

    const publier = () => {
      document.documentElement.style.setProperty(
        "--h-entete",
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };

    publier();

    // ResizeObserver n'existe pas dans certains environnements de test : on
    // dégrade vers la valeur de repli du CSS plutôt que de planter.
    if (typeof ResizeObserver === "undefined") return;

    const observateur = new ResizeObserver(publier);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [userInfo, menuOuvert]);

  // Toute navigation referme les menus. Sans cela, on change de page et le
  // panneau reste ouvert par-dessus le contenu qu'on vient d'appeler.
  useEffect(() => {
    setMenuOuvert(false);
    setCompteOuvert(false);
  }, [location.pathname]);

  // Échap ferme, et le clic à l'extérieur referme le menu du compte.
  //
  // Un menu qu'on ne peut fermer qu'en recliquant exactement sur son bouton
  // est un piège, au clavier comme à la souris.
  useEffect(() => {
    if (!compteOuvert && !menuOuvert) return;

    const surTouche = (e) => {
      if (e.key !== "Escape") return;
      setCompteOuvert(false);
      setMenuOuvert(false);
    };

    const surClic = (e) => {
      if (refCompte.current && !refCompte.current.contains(e.target)) {
        setCompteOuvert(false);
      }
    };

    document.addEventListener("keydown", surTouche);
    document.addEventListener("mousedown", surClic);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("mousedown", surClic);
    };
  }, [compteOuvert, menuOuvert]);

  const deconnexion = async () => {
    // On vide l'état local MÊME si l'appel échoue (réseau coupé, jeton déjà
    // expiré) : sinon l'interface resterait « connectée » sans session.
    try {
      await logoutApi().unwrap();
    } catch {
      // silencieux : la déconnexion locale prime
    }
    dispatch(logout());
    navigate("/");
  };

  const estRecruteur = ["recruteur", "admin"].includes(userInfo?.role);

  const liens = !userInfo
    ? NAVIGATION.visiteur
    : estRecruteur
      ? NAVIGATION.recruteur
      : NAVIGATION.candidat;

  // Un administrateur doit pouvoir vérifier ce que voient les deux autres
  // rôles sans changer de compte : son menu de compte réunit les deux.
  // Dédoublonné par destination : un administrateur cumule les entrées des
  // deux rôles, et « Mes signalements » comme « Modération » mènent au même
  // écran. Deux libellés différents vers la même page font douter qu'ils
  // fassent la même chose.
  const entreesCompte = !userInfo
    ? []
    : [
        ...(estRecruteur ? COMPTE.recruteur : COMPTE.candidat),
        ...(userInfo.role === "admin" ? COMPTE.candidat : []),
        ...(userInfo.role === "admin"
          ? [{ to: "/admin", libelle: "Administration" }]
          : []),
      ].filter(
        (e, i, liste) => liste.findIndex((x) => x.to === e.to) === i,
      );

  return (
    <header className="entete" ref={refEntete}>
      <div className="conteneur conteneur--large entete-inner">
        <Link to="/" className="entete-marque">
          {/* Le logo s'il existe, le sigle sinon.
              `onError` fait la bascule : un fichier absent produirait une
              icône d'image cassée dans l'en-tête de chaque page, ce qui est
              pire que pas de logo. Le sigle reste donc le repli, et déposer
              le fichier suffit à l'activer — aucun code à toucher. */}
          {logoOk ? (
            <img
              className="entete-logo"
              src={LOGO}
              alt=""
              onError={() => setLogoOk(false)}
            />
          ) : (
            <span className="entete-sigle" aria-hidden="true">
              {APP_NAME_COURT}
            </span>
          )}
          {/* Le nom complet disparaît sur les très petits écrans, mais reste
              lu par les technologies d'assistance grâce au libellé du lien. */}
          <span className="entete-nom">{APP_NAME}</span>
          <span className="sr-only">— accueil</span>
        </Link>


        {/* La navigation se replie ; l'IDENTITÉ, non.
            Ranger « Se connecter » ou le menu du compte derrière le bouton
            d'ouverture obligerait un visiteur à deviner où l'on se connecte.
            Le panneau ne contient donc que les destinations. */}
        <nav
          id="navigation-principale"
          aria-label="Navigation principale"
          className={`entete-panneau${menuOuvert ? " entete-panneau--ouvert" : ""}`}
        >
          <ul className="entete-nav">
            {liens.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className="entete-lien">
                  {l.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Le bouton d'ouverture n'existe que sous 1100 px (masqué en CSS).
            `aria-expanded` porte l'état et `aria-controls` désigne ce qui
            s'ouvre : sans eux, un lecteur d'écran annonce un bouton dont on ne
            sait ni ce qu'il fait, ni s'il est déjà actionné. */}
        <button
          type="button"
          className="entete-burger"
          aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOuvert}
          aria-controls="navigation-principale"
          onClick={() => setMenuOuvert((v) => !v)}
        >
          <span className="entete-burger-traits" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="entete-burger-mot">{menuOuvert ? "Fermer" : "Menu"}</span>
        </button>

        <div className="entete-identite">
          {userInfo ? (
            <div className="entete-compte" ref={refCompte}>
              <button
                type="button"
                className="entete-compte-bouton"
                aria-label={`Menu du compte de ${userInfo.prenom} ${userInfo.nom}`}
                aria-expanded={compteOuvert}
                aria-controls="menu-compte"
                onClick={() => setCompteOuvert((v) => !v)}
              >
                {/* La photo si elle existe, les initiales sinon. `aria-hidden`
                    dans les deux cas : l'identité est déjà portée par le nom
                    accessible du bouton, et un lecteur d'écran n'a pas besoin
                    de l'entendre deux fois. */}
                {userInfo.photo ? (
                  <img
                    className="entete-avatar entete-avatar--photo"
                    src={userInfo.photo}
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <span className="entete-avatar" aria-hidden="true">
                    {initiales(userInfo)}
                  </span>
                )}
                <span className="entete-compte-nom">{userInfo.prenom}</span>
                <span className="entete-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>

              {compteOuvert && (
                <div className="entete-menu" id="menu-compte">
                  <p className="entete-menu-identite">
                    <strong>
                      {userInfo.prenom} {userInfo.nom}
                    </strong>
                    <span>{userInfo.email}</span>
                  </p>

                  <ul>
                    {entreesCompte.map((e) => (
                      <li key={e.to}>
                        <NavLink to={e.to} end={e.end} className="entete-menu-lien">
                          {e.libelle}
                        </NavLink>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={deconnexion}
                    className="entete-menu-lien entete-menu-deconnexion"
                  >
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-principal btn-compact">
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
