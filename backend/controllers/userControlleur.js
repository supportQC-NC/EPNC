// backend/controllers/userControlleur.js
import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/UserModel.js";
import Profil from "../models/ProfilModel.js";
import Candidature from "../models/CandidatureModel.js";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";

// Forme unique du compte renvoyé au client. Centralisée pour que login,
// inscription et profil ne divergent jamais — le front lit toujours les mêmes
// champs, et aucun champ sensible ne peut se glisser dans la réponse.
const publicUser = (user) => ({
  _id: user._id,
  email: user.email,
  nom: user.nom,
  prenom: user.prenom,
  role: user.role,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
});

// @desc    Connexion
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email et mot de passe requis");
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() })
    .select("+password");

  // Message volontairement identique pour « compte inconnu », « mot de passe
  // faux » et « compte désactivé » : distinguer les cas révélerait quels emails
  // sont inscrits.
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("Email ou mot de passe invalide");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Email ou mot de passe invalide");
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  generateToken(res, user._id);

  res.json(publicUser(user));
});

// @desc    Inscription publique d'un candidat
// @route   POST /api/users/register
// @access  Public (désactivable par ALLOW_PUBLIC_REGISTER=false)
//
// ⚠️ Écart assumé avec QC_tools, qui est un outil interne sans inscription :
// ici un candidat doit pouvoir créer son compte seul. Le rôle est FORCÉ à
// "candidat" — un `role` envoyé dans le corps de la requête est ignoré, sans
// quoi n'importe qui s'inscrirait administrateur.
const registerUser = asyncHandler(async (req, res) => {
  if (String(process.env.ALLOW_PUBLIC_REGISTER).toLowerCase() === "false") {
    res.status(403);
    throw new Error("Les inscriptions sont fermées. Contactez un administrateur.");
  }

  const { email, password, nom, prenom } = req.body;

  if (!email || !password || !nom || !prenom) {
    res.status(400);
    throw new Error("Nom, prénom, email et mot de passe sont requis");
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  }

  const normalise = String(email).toLowerCase().trim();

  if (await User.findOne({ email: normalise })) {
    res.status(400);
    throw new Error("Un compte existe déjà avec cet email");
  }

  const user = await User.create({
    email: normalise,
    password,
    nom,
    prenom,
    role: "candidat",
  });

  generateToken(res, user._id);

  res.status(201).json(publicUser(user));
});

// @desc    Déconnexion / purge du cookie
// @route   POST /api/users/logout
// @access  Public — doit fonctionner même avec un jeton expiré, sinon la
//          personne reste bloquée en 401 sans pouvoir nettoyer sa session.
const logoutUser = asyncHandler(async (req, res) => {
  // Mêmes options qu'à la pose (generateToken.js) : sans cela le navigateur
  // n'écrase pas le cookie existant et la session survit à la déconnexion.
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    expires: new Date(0),
  });

  res.status(200).json({ message: "Déconnexion réussie" });
});

// @desc    Profil de l'utilisateur connecté
// @route   GET /api/users/profile
// @access  Privé
//
// Le front appelle cette route au chargement pour revalider la session : le
// cookie httpOnly étant illisible en JavaScript, c'est le seul moyen de savoir
// si la session tient encore.
const getUserProfile = asyncHandler(async (req, res) => {
  res.json(publicUser(req.user));
});

// @desc    Mise à jour de son propre profil
// @route   PUT /api/users/profile
// @access  Privé
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  user.nom = req.body.nom || user.nom;
  user.prenom = req.body.prenom || user.prenom;
  user.email = req.body.email
    ? String(req.body.email).toLowerCase().trim()
    : user.email;

  // Le mot de passe ne se change QUE par /profile/password, qui exige
  // l'ancien. L'accepter ici ouvrirait un changement sans vérification pour
  // quiconque mettrait la main sur une session ouverte.

  const updatedUser = await user.save();

  res.json(publicUser(updatedUser));
});

// @desc    Changer son mot de passe (vérifie l'ancien)
// @route   PUT /api/users/profile/password
// @access  Privé
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Mot de passe actuel et nouveau mot de passe requis");
  }
  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error("Le nouveau mot de passe doit contenir au moins 6 caractères");
  }
  if (currentPassword === newPassword) {
    res.status(400);
    throw new Error("Le nouveau mot de passe doit être différent de l'actuel");
  }

  // `password` a select:false — il faut le demander explicitement.
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("Utilisateur non trouvé");
  }

  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    res.status(401);
    throw new Error("Le mot de passe actuel est incorrect");
  }

  user.password = newPassword; // haché par le hook pre("save")
  await user.save();

  res.json({ ok: true, message: "Mot de passe modifié avec succès" });
});

// @desc    Demande de réinitialisation
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Réponse identique que le compte existe ou non : sinon ce formulaire
  // devient un annuaire permettant de tester quels emails sont inscrits.
  const REPONSE = {
    message: "Si cet email existe, un lien de réinitialisation a été envoyé.",
  };

  const user = await User.findOne({
    email: String(email || "").toLowerCase().trim(),
  });

  if (!user) return res.json(REPONSE);

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Réinitialisation de votre mot de passe",
      html: generateResetEmail({
        prenom: user.prenom,
        nom: user.nom,
        resetUrl,
      }),
      text: `Bonjour ${user.prenom},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    });

    res.json(REPONSE);
  } catch (error) {
    // L'envoi a échoué : on annule le jeton, sinon il resterait valable 30 min
    // sans que personne ne puisse s'en servir.
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save({ validateBeforeSave: false });

    res.status(500);
    throw new Error("Erreur lors de l'envoi de l'email, réessayez plus tard.");
  }
});

// @desc    Réinitialisation par jeton
// @route   PUT /api/users/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password || String(password).length < 6) {
    res.status(400);
    throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  }

  // La base ne contient que l'empreinte : on hache le jeton reçu pour le
  // retrouver.
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Lien invalide ou expiré. Refaites une demande.");
  }

  user.password = password;
  user.resetPasswordToken = null;
  user.resetPasswordExpire = null;
  await user.save();

  res.json({ message: "Mot de passe réinitialisé avec succès" });
});

// Gabarit de l'email de réinitialisation.
// Styles en ligne et table de mise en page : les clients mail ignorent les
// feuilles de style externes et la plupart des règles modernes.
const generateResetEmail = ({ prenom, nom, resetUrl }) => `
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1c1f23;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e2e5ea;">
      <tr>
        <td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:19px;color:#1c1f23;">Réinitialisation de votre mot de passe</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">
            Bonjour ${prenom} ${nom},
          </p>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;">
            Vous avez demandé à changer le mot de passe de votre compte Emploi Public NC.
            Ce lien est valable <strong>30 minutes</strong>.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#14507d;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">
              Choisir un nouveau mot de passe
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#5a6068;">
            Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :
          </p>
          <p style="margin:0 0 22px;font-size:12px;line-height:1.6;color:#14507d;word-break:break-all;">
            ${resetUrl}
          </p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#5a6068;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :
            votre mot de passe restera inchangé.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

// =============================================================================
// ADMINISTRATION DES COMPTES
// -----------------------------------------------------------------------------
// Toutes les routes ci-dessous sont montées derrière `protect` + `admin`.
// =============================================================================

// Reste-t-il un administrateur actif si l'on met de côté ce compte-là ?
//
// C'est le garde-fou central de cette section. Sans lui, un administrateur peut
// se supprimer, se rétrograder ou se désactiver — et plus personne ne peut
// administrer l'application. La seule sortie serait alors une intervention
// directe en base de données.
const resteUnAdmin = async (idExclu) =>
  Boolean(
    await User.exists({
      role: "admin",
      isActive: true,
      _id: { $ne: idExclu },
    }),
  );

// Agir sur son propre compte depuis l'écran d'administration est refusé :
// changer son rôle, se désactiver ou se supprimer sont les trois façons de se
// verrouiller dehors. Les modifications de son propre compte passent par
// /profile, qui ne touche ni au rôle ni à l'activation.
const estSoiMeme = (req, id) => String(req.user._id) === String(id);

// @desc    Liste des comptes (recherche et filtre optionnels)
// @route   GET /api/users
// @access  Privé / Admin
const getUsers = asyncHandler(async (req, res) => {
  const { recherche, role, actif } = req.query;
  const filtre = {};

  if (recherche) {
    // `escapeRegExp` : sans échappement, un utilisateur qui tape « a+ » ou
    // « ( » dans la recherche provoque une expression invalide et une 500.
    const motif = String(recherche)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(motif, "i");
    filtre.$or = [{ nom: regex }, { prenom: regex }, { email: regex }];
  }

  if (role) filtre.role = role;
  if (actif === "1") filtre.isActive = true;
  if (actif === "0") filtre.isActive = false;

  const comptes = await User.find(filtre)
    .sort({ createdAt: -1 })
    // Garde-fou : le jour où la base grossit, cet écran ne doit pas tenter de
    // tout charger d'un coup. La recherche reste là pour atteindre le reste.
    .limit(200)
    .lean();

  res.json({
    total: await User.countDocuments(filtre),
    comptes: comptes.map((u) => ({
      _id: u._id,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      role: u.role,
      isActive: u.isActive,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    })),
  });
});

// @desc    Un compte
// @route   GET /api/users/:id
// @access  Privé / Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Compte introuvable");
  }

  res.json(publicUser(user));
});

// @desc    Créer un compte
// @route   POST /api/users
// @access  Privé / Admin
//
// Le mot de passe initial est choisi par l'administrateur et communiqué de vive
// voix. Volontairement, aucun email ne l'envoie : un mot de passe en clair dans
// une boîte mail y reste indéfiniment. La personne peut ensuite le changer
// depuis son profil, ou passer par « mot de passe oublié ».
const createUser = asyncHandler(async (req, res) => {
  const { email, password, nom, prenom, role } = req.body;

  if (!email || !password || !nom || !prenom) {
    res.status(400);
    throw new Error("Nom, prénom, email et mot de passe sont requis");
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  }

  const roles = User.schema.path("role").enumValues;
  if (role && !roles.includes(role)) {
    res.status(400);
    throw new Error("Rôle inconnu");
  }

  const normalise = String(email).toLowerCase().trim();

  if (await User.findOne({ email: normalise })) {
    res.status(400);
    throw new Error("Un compte existe déjà avec cet email");
  }

  const user = await User.create({
    email: normalise,
    password,
    nom,
    prenom,
    role: role || "candidat",
    createdBy: req.user._id,
  });

  res.status(201).json(publicUser(user));
});

// @desc    Modifier un compte
// @route   PUT /api/users/:id
// @access  Privé / Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Compte introuvable");
  }

  const { nom, prenom, email, role, isActive, password } = req.body;

  // ── Changement de rôle ────────────────────────────────────────────────
  if (role !== undefined && role !== user.role) {
    if (estSoiMeme(req, user._id)) {
      res.status(400);
      throw new Error(
        "Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre administrateur.",
      );
    }

    const roles = User.schema.path("role").enumValues;
    if (!roles.includes(role)) {
      res.status(400);
      throw new Error("Rôle inconnu");
    }

    if (user.role === "admin" && !(await resteUnAdmin(user._id))) {
      res.status(400);
      throw new Error(
        "Ce compte est le dernier administrateur actif : nommez-en un autre avant de le rétrograder.",
      );
    }

    user.role = role;
  }

  // ── Activation / désactivation ────────────────────────────────────────
  if (isActive !== undefined && Boolean(isActive) !== user.isActive) {
    if (estSoiMeme(req, user._id)) {
      res.status(400);
      throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
    }

    if (
      user.role === "admin" &&
      user.isActive &&
      !(await resteUnAdmin(user._id))
    ) {
      res.status(400);
      throw new Error(
        "Ce compte est le dernier administrateur actif : il ne peut pas être désactivé.",
      );
    }

    user.isActive = Boolean(isActive);
  }

  if (nom) user.nom = nom;
  if (prenom) user.prenom = prenom;
  if (email) user.email = String(email).toLowerCase().trim();

  // Réinitialisation par un administrateur : pas de vérification de l'ancien
  // mot de passe, c'est justement le cas d'usage (la personne l'a perdu).
  if (password) {
    if (String(password).length < 6) {
      res.status(400);
      throw new Error("Le mot de passe doit contenir au moins 6 caractères");
    }
    user.password = password;
  }

  const maj = await user.save();

  res.json(publicUser(maj));
});

// @desc    Supprimer un compte
// @route   DELETE /api/users/:id
// @access  Privé / Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Compte introuvable");
  }

  if (estSoiMeme(req, user._id)) {
    res.status(400);
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  if (user.role === "admin" && !(await resteUnAdmin(user._id))) {
    res.status(400);
    throw new Error(
      "Ce compte est le dernier administrateur actif : il ne peut pas être supprimé.",
    );
  }

  // Suppression en cascade des données rattachées.
  //
  // Mongoose ne la fait PAS tout seul : sans ces deux lignes, le profil et les
  // candidatures restent en base, rattachés à un compte qui n'existe plus. Ils
  // faussent les compteurs, encombrent la base, et — plus grave — un profil
  // contient des données personnelles qui n'ont plus aucune raison d'être
  // conservées une fois le compte supprimé.
  const [profils, candidatures] = await Promise.all([
    Profil.deleteMany({ user: user._id }),
    Candidature.deleteMany({ user: user._id }),
  ]);

  await user.deleteOne();

  res.json({
    message: "Compte supprimé",
    _id: req.params.id,
    supprimeAussi: {
      profil: profils.deletedCount,
      candidatures: candidatures.deletedCount,
    },
  });
});

// @desc    Activer / désactiver un compte
// @route   PATCH /api/users/:id/toggle-active
// @access  Privé / Admin
//
// Route dédiée plutôt qu'un PUT complet : c'est l'action la plus fréquente de
// l'écran, et la désactivation est la bonne réponse à un compte à suspendre —
// elle coupe l'accès sans détruire l'historique, contrairement à la suppression.
const toggleUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("Compte introuvable");
  }

  if (estSoiMeme(req, user._id)) {
    res.status(400);
    throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
  }

  if (user.isActive && user.role === "admin" && !(await resteUnAdmin(user._id))) {
    res.status(400);
    throw new Error(
      "Ce compte est le dernier administrateur actif : il ne peut pas être désactivé.",
    );
  }

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  res.json(publicUser(user));
});

export {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserActive,
};
