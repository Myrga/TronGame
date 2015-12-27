var serveur = require('tron-serveur');

serveur.setArenaSize(800,600);
serveur.setFPS(60);
serveur.setPlayerSpeed(2);
serveur.setPlayerInvincibilityTime(3);
serveur.run(8001);