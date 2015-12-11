var serveur = require('tron-serveur');

serveur.setArenaSize(1000,800);
serveur.setFPS(60);
serveur.setPlayerSpeed(2);
serveur.setPlayerInvincibilityTime(3);
serveur.run(3000);