// src/components/Global/Header/Header.jsx
import { useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLogoutMutation } from "../../../slices/userApiSlice";
import { logout } from "../../../slices/authSlice";
import { APP_NAME, APP_NAME_COURT } from "../../../constants";
import "./Header.css";

// En-tête volontairement sans menu escamotable. Avec deux ou trois
// destinations, un bouton « hamburger » cacherait la navigation derrière un
// clic supplémentaire sans rien faire gagner : les liens passent simplement à
// la ligne quand l'écran est étroit.
const Header = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logoutApi] = useLogoutMutation();
  const refEntete = useRef(null);

  // Publie la hauteur RÉELLE de l'en-tête dans `--h-entete`, que le hero
  // retranche pour tenir exactement dans l'écran.
  //
  // Pourquoi la mesurer plutôt que l'écrire en dur : elle varie. Sur un
  // téléphone étroit et en session ouverte, les liens passent à la ligne et
  // l'en-tête gagne une trentaine de pixels — le hero dépassait alors du pli.
  // Elle change aussi avec la taille de police choisie par l'utilisateur.
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
  }, [userInfo]);

  const handleLogout = async () => {
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

  return (
    <header className="entete" ref={refEntete}>
      <div className="conteneur entete-inner">
        <Link to="/" className="entete-marque">
          <span className="entete-sigle" aria-hidden="true">
            {APP_NAME_COURT}
          </span>
          {/* Le nom complet disparaît sur les très petits écrans, mais reste
              lu par les technologies d'assistance grâce au libellé du lien. */}
          <span className="entete-nom">{APP_NAME}</span>
          <span className="sr-only">— accueil</span>
        </Link>

        <nav aria-label="Navigation principale">
          <ul className="entete-nav">
            <li>
              <NavLink to="/offres" className="entete-lien">
                Les offres
              </NavLink>
            </li>
            <li>
              <NavLink to="/metiers" className="entete-lien">
                Les métiers
              </NavLink>
            </li>

            {userInfo ? (
              <>
                <li>
                  <NavLink to="/espace" className="entete-lien">
                    Mon espace
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/profil" className="entete-lien">
                    Profil
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/matchs" className="entete-lien">
                    Correspondances
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/candidatures" className="entete-lien">
                    Candidatures
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/assistant" className="entete-lien">
                    Assistant
                  </NavLink>
                </li>
                {userInfo.role === "admin" && (
                  <li>
                    <NavLink to="/admin" className="entete-lien">
                      Admin
                    </NavLink>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn-secondaire btn-compact"
                  >
                    Se déconnecter
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/login" className="btn btn-principal btn-compact">
                  Se connecter
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
