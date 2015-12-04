var expressIO = require('express.io');

var app = expressIO();

// GAME PARAMETERS

// Paramètres système
var nextPlayerID = 1;

// Paramètres d'affichage
var fps = 60;

// Päaramètres de l'arène
var arenaWidth = 600;
var arenaHeight = 500;

// Paramètres des joueurs
var playerSpeed = 2;
var playerHitboxSize = 10;
var playerInvincibilityTime = 3;

// Paramètres des murs
var wallSize = 2;

var playersInfos = {};
var wallsInfos = {};

// EXPRESS

app.use(expressIO.static('public'));

app.get('/', function(req, res) {
	res.sendfile('./public/jeu.html');
});

// SOCKET.IO

app.http().io();

app.io.route('newPlayer', function(req) {
    var playerID = nextPlayerID;
    var playerName = req.data.playerName;
    //TODO Test du nom du joueur
    playerName = "Joueur"+playerID;

    nextPlayerID++;
	req.io.emit('init',
		{
            fps: fps,
			arenaWidth: arenaWidth,
			arenaHeight: arenaHeight,
            wallSize: wallSize,
			playerID: playerID,
            playerName: playerName
		});
    playersInfos[playerID] = {};
    playersInfos[playerID]["id"] = playerID;
    playersInfos[playerID]["idSocket"] = req.socket.id;
    playersInfos[playerID]["name"] = playerName;
    playersInfos[playerID]["position"] = {};
    playersInfos[playerID]["position"]["x"] = arenaWidth/2;
    playersInfos[playerID]["position"]["y"] = arenaHeight/2;
    playersInfos[playerID]["position"]["direction"] = 1;
    playersInfos[playerID]["invincibility"] = playerInvincibilityTime*fps;
    wallsInfos[playerID] = [];

    console.log("Joueur \""+playerName+"\" connecté");
    req.io.broadcast('newPlayerConnected', playerName);
});

app.io.route('changeDirection', function(req) {
    if(playersInfos[req.data.playerID] != undefined) {
        var ancienneDirection = playersInfos[req.data.playerID].position.direction;
        var nouvelleDirection = req.data.direction;
        if (nouvelleDirection != null && playersInfos[req.data.playerID] != null)
            if (
                (ancienneDirection == 0 && nouvelleDirection != 2) ||
                (ancienneDirection == 1 && nouvelleDirection != 3) ||
                (ancienneDirection == 2 && nouvelleDirection != 0) ||
                (ancienneDirection == 3 && nouvelleDirection != 1)
            ) playersInfos[req.data.playerID].position.direction = nouvelleDirection;
    }
});

app.io.route('disconnect', function(req) {
    var playerInfo = getPlayerInfosFromSocket(req.socket.id);
    if(playerInfo != null) {
        delete playersInfos[playerInfo.id];
        console.log("Joueur \""+playerInfo.name+"\" déconnecté (" + req.data + ")");
    }
});

app.io.route('command', function(req) {
    if(req.data == "clearwalls") {
        console.log("ClearWalls demandé");
        for(var playerID in wallsInfos) wallsInfos[playerID] = [];
    }
});

var runPlayers = function() {

    // Modifier la position des joueurs

    for(var player in playersInfos) {
        switch(playersInfos[player].position.direction) {
            case 0:
                playersInfos[player].position.y -= playerSpeed; break;
            case 1:
                playersInfos[player].position.x += playerSpeed; break;
            case 2:
                playersInfos[player].position.y += playerSpeed; break;
            case 3:
                playersInfos[player].position.x -= playerSpeed; break;
        }

        // Ajouter/agrandir un mur

        if(playersInfos[player].invincibility == 0) {
            if (wallsInfos[player].length == 0) {
                wallsInfos[player].push(
                    {
                        xStart: playersInfos[player].position.x,
                        yStart: playersInfos[player].position.y,
                        xEnd: playersInfos[player].position.x,
                        yEnd: playersInfos[player].position.y,
                        direction: playersInfos[player].position.direction
                    });
            }
            else if (wallsInfos[player][wallsInfos[player].length - 1].direction != playersInfos[player].position.direction) {
                wallsInfos[player].push(
                    {
                        xStart: playersInfos[player].position.x,
                        yStart: playersInfos[player].position.y,
                        xEnd: playersInfos[player].position.x,
                        yEnd: playersInfos[player].position.y,
                        direction: playersInfos[player].position.direction
                    });
            }
            else {
                wallsInfos[player][wallsInfos[player].length - 1].xEnd = playersInfos[player].position.x;
                wallsInfos[player][wallsInfos[player].length - 1].yEnd = playersInfos[player].position.y;
            }
        }
    }

    // Tester les colisions

    var colisions = colisionTest();
    var colisionsPlayerNames = [];

    for(var i in colisions) {
        colisionsPlayerNames.push(playersInfos[colisions[i]].name);
        delete playersInfos[colisions[i]];
    }

    if(colisions.length > 0) app.io.broadcast('colision', colisionsPlayerNames);

    // Modifier la valeur d'invincibilité
    for(var player in playersInfos) {
        if(playersInfos[player].invincibility > 0) playersInfos[player].invincibility--;
    }

    app.io.broadcast('tick', {playersInfos: playersInfos, wallsInfos: wallsInfos});
};

var colisionTest = function() {
    var colision = [];
    for(var player1 in playersInfos) {

        // Colision avec l'arène
        if (
            (playersInfos[player1].position.x < playerHitboxSize / 2) ||
            (playersInfos[player1].position.y < playerHitboxSize / 2) ||
            (playersInfos[player1].position.x > arenaWidth - (playerHitboxSize / 2)) ||
            (playersInfos[player1].position.y > arenaHeight - (playerHitboxSize / 2))
        ) {
            if (colision.indexOf(parseInt(player1, 10)) == -1) colision.push(playersInfos[player1].id);
        }

        if(playersInfos[player1].invincibility == 0) {

            // Colision entre joueur
            for (var player2 in playersInfos) {
                if (player1 != player2 && !(
                    (playersInfos[player1].position.x >= playersInfos[player2].position.x + playerHitboxSize) || // Trop à droite
                    (playersInfos[player1].position.x + playerHitboxSize <= playersInfos[player2].position.x) || // Trop à gauche
                    (playersInfos[player1].position.y >= playersInfos[player2].position.y + playerHitboxSize) || // Trop en bas
                    (playersInfos[player1].position.y + playerHitboxSize <= playersInfos[player2].position.y) // Trop en haut
                    )) {
                    // Colision du player1
                    if (colision.indexOf(parseInt(player1, 10)) == -1) colision.push(playersInfos[player1].id);
                }
            }

            // Colision avec un mur

            var bumper; // Hitbox gérant les colisions avec les murs afin d'éviter l'auto-colision avec son propre mur lors de sa génération
            switch(playersInfos[player1].position.direction) {
                case 0: // Vers le haut
                    bumper = {
                        x: playersInfos[player1].position.x - (playerHitboxSize/2),
                        y: playersInfos[player1].position.y - (playerHitboxSize/2),
                        width: playerHitboxSize,
                        height: (playerHitboxSize/2) - (wallSize/2)
                    };
                    break;
                case 1: // Vers la droite
                    bumper = {
                        x: playersInfos[player1].position.x + (wallSize/2),
                        y: playersInfos[player1].position.y - (playerHitboxSize/2),
                        width: (playerHitboxSize/2) - (wallSize/2),
                        height: playerHitboxSize
                    };
                    break;
                case 2: // Vers le bas
                    bumper = {
                        x: playersInfos[player1].position.x - (playerHitboxSize/2),
                        y: playersInfos[player1].position.y + (wallSize/2),
                        width: playerHitboxSize,
                        height: (playerHitboxSize/2) - (wallSize/2)
                    };
                    break;
                case 3: // Vers la gauche
                    bumper = {
                        x: playersInfos[player1].position.x - (playerHitboxSize/2),
                        y: playersInfos[player1].position.y - (playerHitboxSize/2),
                        width: (playerHitboxSize/2) - (wallSize/2),
                        height: playerHitboxSize
                    };
                    break;
            }

            for (var playerID in wallsInfos) {
                for (var i=0; i<wallsInfos[playerID].length; i++) {
                    var wall = boxWallInfos(wallsInfos[playerID][i]);
                    if (!(
                        (bumper.y + bumper.height <= wall.y) || // Trop en haut
                        (bumper.x >= wall.x + wall.width) || // Trop à droite
                        (bumper.y >= wall.y + wall.height) || // Trop en bas
                        (bumper.x + bumper.width <= wall.x) // Trop à gauche
                        )) {
                        if (colision.indexOf(parseInt(player1, 10)) == -1) colision.push(playersInfos[player1].id);
                    }
                }
            }
        }
    }
    return colision;
};

var getPlayerInfosFromSocket = function(idSocket) {
    for(var player in playersInfos) {
        if(playersInfos[player].idSocket == idSocket) return playersInfos[player];
    }
    return null;
};

var boxWallInfos = function(wall) {
    switch(wall.direction) {
        case 0: // Vers le haut
            return {
                x:wall.xEnd - (wallSize/2),
                y:wall.yEnd - (wallSize/2),
                width: wallSize,
                height: wall.yStart - wall.yEnd + wallSize
            };
            break;
        case 1: // Vers la droite
            return {
                x:wall.xStart - (wallSize/2),
                y:wall.yStart - (wallSize/2),
                width: wall.xEnd - wall.xStart + wallSize,
                height: wallSize
            };
            break;
        case 2: // Vers le bas
            return {
                x:wall.xStart - (wallSize/2),
                y:wall.yStart - (wallSize/2),
                width: wallSize,
                height: wall.yEnd - wall.yStart + wallSize
            };
            break;
        case 3: // Vers la gauche
            return {
                x:wall.xEnd - (wallSize/2),
                y:wall.yEnd - (wallSize/2),
                width: wall.xStart - wall.xEnd + wallSize,
                height: wallSize
            };
            break;
    }
};

// RUN

app.listen(3000);
setInterval(runPlayers, 1000/fps);
console.log("Serveur de jeu TRON démarré");