var app = angular.module("Tron", [ ]);


app.controller("TronController",
    function($http, $scope){
        $scope.io = io.connect();


        var dessin = document.getElementById('dessin');
        var context = dessin.getContext("2d");

        var gameInitialized = false;

// Ressources
        var imageBike = new Image();
        imageBike.src = "images/bike_empty.png";
        var audioNewPlayer = new Audio('sons/newPlayerVoice.mp3');
        var audioPlayerDestroyed = new Audio('sons/playerDestroyedVoice.mp3');

// Paramètres d'affichage
        var afficherNomJoueurs = true;

// Paramètres des annonces
        var announceShowTime = 2;
        var announceFadeTime = 1;
        var announceStack = 3;

        var gameInfos;
        var playerInfos;
        var announces = [];

        $scope.io.emit('newPlayer', "Joueur");

        $scope.io.on('init', function(data) {
            gameInfos = {
                fps: data.fps,
                arenaWidth: data.arenaWidth,
                arenaHeight: data.arenaHeight,
                wallSize: data.wallSize
            };
            playerInfos = {
                id: data.playerID,
                name: data.playerName
            };
            var styleWidth = 'width:'+gameInfos.arenaWidth+'px;';
            var styleHeight = 'height:'+gameInfos.arenaHeight+'px;';
            dessin.setAttribute('style', styleWidth+styleHeight);
            context.canvas.width  = gameInfos.arenaWidth;
            context.canvas.height = gameInfos.arenaHeight;
            gameInitialized = true;
        });

        $scope.io.on('tick', function(infos) {

            if(gameInitialized) {
                var playersInfos = infos.playersInfos;
                var wallsInfos = infos.wallsInfos;

                context.clearRect(0, 0, dessin.width, dessin.height);

                // Afficher murs

                for (var playerID in wallsInfos) {

                    // Choix couleur
                    if (playerInfos.id == playerID) context.fillStyle = "rgb(0, 255, 255)";
                    else context.fillStyle = "rgb(255, 0, 0)";

                    for (var wall in wallsInfos[playerID]) {
                        var wallInfos = wallsInfos[playerID][wall];

                        switch (wallInfos.direction) {
                            case 0: // Vers le haut
                                context.fillRect(
                                    wallInfos.xEnd - (gameInfos.wallSize / 2),
                                    wallInfos.yEnd - (gameInfos.wallSize / 2),
                                    gameInfos.wallSize,
                                    wallInfos.yStart - wallInfos.yEnd + gameInfos.wallSize
                                );
                                break;
                            case 1: // Vers la droite
                                context.fillRect(
                                    wallInfos.xStart - (gameInfos.wallSize / 2),
                                    wallInfos.yStart - (gameInfos.wallSize / 2),
                                    wallInfos.xEnd - wallInfos.xStart + gameInfos.wallSize,
                                    gameInfos.wallSize
                                );
                                break;
                            case 2: // Vers le bas
                                context.fillRect(
                                    wallInfos.xStart - (gameInfos.wallSize / 2),
                                    wallInfos.yStart - (gameInfos.wallSize / 2),
                                    gameInfos.wallSize,
                                    wallInfos.yEnd - wallInfos.yStart + gameInfos.wallSize
                                );
                                break;
                            case 3: // Vers la gauche
                                context.fillRect(
                                    wallInfos.xEnd - (gameInfos.wallSize / 2),
                                    wallInfos.yEnd - (gameInfos.wallSize / 2),
                                    wallInfos.xStart - wallInfos.xEnd + gameInfos.wallSize,
                                    gameInfos.wallSize
                                );
                                break;
                        }
                    }
                }

                // Afficher joueurs

                for (var player in playersInfos) {
                    var x = playersInfos[player].position.x;
                    var y = playersInfos[player].position.y;
                    var direction = playersInfos[player].position.direction;

                    // Choix couleur

                    if (playerInfos.id == playersInfos[player].id) context.fillStyle = "rgb(0, 255, 255)";
                    else context.fillStyle = "rgb(255, 0, 0)";

                    // Afficher moto

                    context.save();
                    context.translate(x, y);
                    switch (direction) {
                        case 1:
                            context.rotate(Math.PI * 0.5);
                            break;
                        case 2:
                            context.rotate(Math.PI * 1.0);
                            break;
                        case 3:
                            context.rotate(Math.PI * 1.5);
                            break;
                    }
                    context.fillRect(-3, -11, 6, 6);
                    context.fillRect(-3, 5, 6, 6);
                    context.fillRect(-2, -2, 4, 5);
                    context.drawImage(imageBike, -5, -11);

                    // Invincibilité
                    if (playersInfos[player].invincibility > 0) {
                        context.strokeStyle = 'blue';
                        context.lineWidth = 1;
                        context.strokeRect(-7, -13, 14, 26);
                    }

                    context.restore();

                    // Afficher nom joueur (optionnel)

                    if (afficherNomJoueurs) {
                        context.fillStyle = "rgba(0, 0, 0, 1)";
                        context.fillText(playersInfos[player].name, playersInfos[player].position.x - 18, playersInfos[player].position.y + imageBike.height);
                    }
                }

                // Affichage annonces

                for (var i in announces) {
                    var announce = announces[i];
                    if (announce.showFrames > 0) {
                        context.fillStyle = "rgba(0, 0, 0, 1)";
                        context.fillText(announce.text, 20, 20 + (i * 10));
                        announce.showFrames--;
                    }
                    else if (announce.fadeFrames > 0) {
                        var opacity = announce.fadeFrames / (announceFadeTime * gameInfos.fps);
                        context.fillStyle = "rgba(0, 0, 0, " + opacity + ")";
                        context.fillText(announce.text, 20, 20 + (i * 10));
                        announce.fadeFrames--;
                    }
                }

                // Effacer les annonces terminées
                clearAnnounces();
            }
        });

        $scope.io.on('newPlayerConnected', function(newPlayerName) {
            audioNewPlayer.play();
            addAnnounce("\""+newPlayerName+"\" à rejoint l'arène");
        });

        $scope.io.on('colision', function(colisions) {
            audioPlayerDestroyed.play();
            for(var i in colisions) {
                addAnnounce("\""+colisions[i]+"\" détruit");
            }
        });

        var changeDirection = function(e) {
            if(e.keyCode<=40 && e.keyCode>=37) {
                var data = {};
                switch (e.keyCode) {
                    case 38: // Haut
                        data["direction"] = 0;
                        break;
                    case 39: // Droite
                        data["direction"] = 1;
                        break;
                    case 40: // Bas
                        data["direction"] = 2;
                        break;
                    case 37: // Gauche
                        data["direction"] = 3;
                        break;
                }
                data["playerID"] = playerInfos.id;
                $scope.io.emit('changeDirection', data);
            }
        };

        var addAnnounce = function(text) {
            var newAnnounce = {text: text, showFrames: announceShowTime*gameInfos.fps, fadeFrames: announceFadeTime*gameInfos.fps};
            if(announceStack <= 0 || announces.length<announceStack) announces.push(newAnnounce);
            else {
                for(var i=0; i<announceStack-1; i++) {
                    announces[i] = announces[i+1];
                }
                announces[announceStack-1] = newAnnounce;
            }
        };

        var clearAnnounces = function() {
            for(var i=announces.length-1; i>=0; i--){
                if(announces[i].showFrames == 0 && announces[i].fadeFrames == 0) announces.splice(i, 1);
            }
        };

        var sendCommand = function(e) {
            if(e.keyCode == 222) {
                var command = prompt("Entrer une commande serveur :");
                if(command != null) {
                    $scope.io.emit('command', command);
                }
            }
        };

        addEventListener("keydown", changeDirection, true);
        addEventListener("keydown", sendCommand, true);

    });

